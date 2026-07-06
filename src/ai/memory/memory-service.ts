import type {
  MemoryCandidate,
  MemoryRecord,
  UpdateMemoryInput,
} from "@shared/memory";
import type { Logger } from "@shared/logger";

import type { MemoryExtractor } from "./memory-extractor";
import type { MemoryRepository } from "./memory-repository";

/**
 * # Memory service
 *
 * The orchestration hub of the Personal Memory Engine and the single
 * façade the renderer talks to. Coordinates the extractor, the
 * repository, and the user's standing rules; owns candidate lifecycle
 * and emits events the stores subscribe to.
 *
 * Privacy-first invariants:
 * - extraction only PROPOSES; a memory is saved only on explicit
 *   approval or a pre-existing "always" rule the user created
 * - a "never" rule silently suppresses matching candidates
 *
 * ## Ports
 * `ConversationMemoryPort` is the minimal surface the conversation
 * manager needs: retrieve relevant memories (for prompt injection) and
 * observe a completed exchange (to mine candidates). The manager
 * depends on that interface, not the whole service.
 */

export interface ConversationMemoryPort {
  /** Values of memories relevant to `query`, for prompt injection. */
  getRelevantMemories(query: string): Promise<string[]>;
  /** Fire-and-forget: mine a user message for candidates. */
  observeUserMessage(text: string, conversationId: string | null): void;
}

type CandidateListener = (candidate: MemoryCandidate) => void;
type ChangeListener = () => void;

export class MemoryService implements ConversationMemoryPort {
  private readonly candidateListeners = new Set<CandidateListener>();
  private readonly changeListeners = new Set<ChangeListener>();

  constructor(
    private readonly repository: MemoryRepository,
    private readonly extractor: MemoryExtractor,
    private readonly logger: Logger,
  ) {}

  // -- Events ---------------------------------------------------------------

  /** Fires when a candidate needs the user's decision. */
  onCandidate(listener: CandidateListener): () => void {
    this.candidateListeners.add(listener);
    return () => this.candidateListeners.delete(listener);
  }

  /** Fires after the stored memory set changes. */
  onMemoriesChanged(listener: ChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private emitCandidate(candidate: MemoryCandidate): void {
    for (const listener of this.candidateListeners) listener(candidate);
  }

  private emitChanged(): void {
    for (const listener of this.changeListeners) listener();
  }

  // -- ConversationMemoryPort ----------------------------------------------

  async getRelevantMemories(query: string): Promise<string[]> {
    try {
      const memories = await this.repository.getRelevantMemories(query);
      return memories.map((memory) => memory.value);
    } catch (error) {
      // Retrieval must never break generation.
      this.logger.warn("relevant-memory lookup failed", { error: String(error) });
      return [];
    }
  }

  observeUserMessage(text: string, conversationId: string | null): void {
    void this.mineCandidates(text, conversationId);
  }

  /**
   * Extracts candidates, then routes each by the user's standing rules:
   * never → drop, always → save silently, otherwise → ask the user.
   */
  private async mineCandidates(text: string, conversationId: string | null): Promise<void> {
    let extracted;
    try {
      extracted = await this.extractor.extract(text);
    } catch (error) {
      this.logger.warn("candidate extraction failed", { error: String(error) });
      return;
    }

    for (const partial of extracted) {
      const candidate: MemoryCandidate = { ...partial, sourceConversationId: conversationId };
      let disposition;
      try {
        disposition = await this.repository.classifyCandidate(candidate);
      } catch {
        disposition = "ask" as const;
      }

      if (disposition === "never") {
        this.logger.debug("candidate suppressed by never-rule", { key: candidate.key });
        continue;
      }
      if (disposition === "always") {
        await this.saveApproved(candidate);
        continue;
      }
      this.emitCandidate(candidate);
    }
  }

  // -- Candidate decisions (called by the memory store) ---------------------

  /** "Remember": persist this candidate. */
  async approve(candidate: MemoryCandidate): Promise<void> {
    await this.saveApproved(candidate);
  }

  /** "Always Remember Similar": persist and create an always-rule. */
  async alwaysRememberSimilar(candidate: MemoryCandidate): Promise<void> {
    await this.saveApproved(candidate);
    await this.addRule("always", candidate);
  }

  /** "Never Remember Similar": create a never-rule; save nothing. */
  async neverRememberSimilar(candidate: MemoryCandidate): Promise<void> {
    await this.addRule("never", candidate);
  }

  private async saveApproved(candidate: MemoryCandidate): Promise<void> {
    try {
      const result = await this.repository.saveMemory({
        category: candidate.category,
        key: candidate.key,
        value: candidate.value,
        confidence: candidate.confidence,
        sourceConversationId: candidate.sourceConversationId,
      });
      this.logger.info("memory saved", { id: result.memory.id, merged: result.duplicate });
      this.emitChanged();
    } catch (error) {
      this.logger.warn("saving approved memory failed", { error: String(error) });
      throw error;
    }
  }

  private async addRule(kind: "always" | "never", candidate: MemoryCandidate): Promise<void> {
    try {
      await window.luna?.memory.addRule({
        kind,
        category: candidate.category,
        tokens: tokenize(`${candidate.key} ${candidate.value}`),
      });
    } catch (error) {
      this.logger.warn("adding memory rule failed", { error: String(error) });
    }
  }

  // -- Memory page operations ----------------------------------------------

  listMemories(): Promise<MemoryRecord[]> {
    return this.repository.listMemories();
  }

  searchMemories(query: string): Promise<MemoryRecord[]> {
    return this.repository.searchMemories(query);
  }

  async updateMemory(input: UpdateMemoryInput): Promise<void> {
    await this.repository.updateMemory(input);
    this.emitChanged();
  }

  async archiveMemory(id: string, isArchived: boolean): Promise<void> {
    await this.repository.archiveMemory(id, isArchived);
    this.emitChanged();
  }

  async deleteMemory(id: string): Promise<void> {
    await this.repository.deleteMemory(id);
    this.emitChanged();
  }
}

/** Same tokenization the main-process search uses, for rule creation. */
function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 2),
    ),
  ];
}
