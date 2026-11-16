import { createLogger } from "../../../shared/logger";
import { EmbeddingService } from "../../documents/embeddings/embedding.service";
import { isPermissionAllowed, recordPermissionUse } from "../../permissions/permission.gate";
import type { TextEmbedder } from "./memory-search";

/**
 * # Local memory embedder
 *
 * Calls the same Ollama embedding model documents use. A memory embedding
 * is a model call, so Local AI off returns empty vectors and the search
 * falls back to token overlap. Nothing is sent off the machine.
 */

const log = createLogger("main:db:memory:embed");

export class LocalAiTextEmbedder implements TextEmbedder {
  private readonly embeddings = new EmbeddingService();

  get model(): string {
    return this.embeddings.model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!isPermissionAllowed("local-ai")) {
      log.debug("skipping memory embeddings; Local AI is off");
      return texts.map(() => []);
    }
    recordPermissionUse("local-ai");
    return this.embeddings.embedTexts(texts);
  }
}
