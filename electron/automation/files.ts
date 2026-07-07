import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { shell } from "electron";

import {
  AutomationError,
  type FileHit,
  type SearchFilesInput,
} from "../../shared/automation";
import { createLogger } from "../../shared/logger";

/**
 * # Filesystem automation (main process)
 *
 * Read-only file search across the user's common folders plus open /
 * reveal / open-containing-folder. Search is bounded (roots, depth,
 * entry cap) so it stays responsive and never walks the whole disk.
 */

const log = createLogger("main:automation:files");

const MAX_DEPTH = 4;
const MAX_ENTRIES = 20_000;
const DEFAULT_LIMIT = 10;
const SKIP_DIRS = new Set([
  "node_modules", ".git", "AppData", "$Recycle.Bin", "Windows",
  "Program Files", "Program Files (x86)", ".cache",
]);

function searchRoots(): string[] {
  const home = os.homedir();
  return [
    path.join(home, "Desktop"),
    path.join(home, "Documents"),
    path.join(home, "Downloads"),
    home,
  ];
}

/** Rank: exact base match > prefix > substring, tie-broken by recency. */
function scoreName(name: string, query: string): number {
  const lower = name.toLowerCase();
  const base = lower.replace(/\.[^.]+$/, "");
  if (base === query) return 3;
  if (lower.startsWith(query)) return 2;
  if (lower.includes(query)) return 1;
  return 0;
}

export async function searchFiles(input: SearchFilesInput): Promise<FileHit[]> {
  const query = input.query.trim().toLowerCase();
  if (!query) return [];
  const ext = input.fileType?.replace(/^\./, "").toLowerCase();
  const limit = input.limit ?? DEFAULT_LIMIT;

  const hits: (FileHit & { score: number })[] = [];
  let scanned = 0;
  const seen = new Set<string>();

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || scanned >= MAX_ENTRIES || seen.has(dir)) return;
    seen.add(dir);

    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir — skip
    }

    for (const entry of entries) {
      if (scanned >= MAX_ENTRIES) return;
      scanned += 1;
      if (entry.name.startsWith(".")) continue;

      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full, depth + 1);
        continue;
      }
      if (ext && !entry.name.toLowerCase().endsWith(`.${ext}`)) continue;

      const score = scoreName(entry.name, query);
      if (score === 0) continue;
      try {
        const stat = await fs.stat(full);
        hits.push({
          path: full,
          name: entry.name,
          directory: dir,
          size: stat.size,
          modifiedAt: stat.mtimeMs,
          score,
        });
      } catch {
        // file vanished between readdir and stat — ignore
      }
    }
  }

  for (const root of searchRoots()) await walk(root, 0);

  hits.sort((a, b) => b.score - a.score || b.modifiedAt - a.modifiedAt);
  log.info("file search", { query, scanned, matches: hits.length });
  return hits.slice(0, limit).map(({ score: _score, ...hit }) => hit);
}

async function assertExists(target: string): Promise<void> {
  try {
    await fs.access(target);
  } catch {
    throw new AutomationError("file-missing", `"${target}" no longer exists.`);
  }
}

export async function openFile(filePath: string): Promise<void> {
  await assertExists(filePath);
  const error = await shell.openPath(filePath);
  if (error) throw new AutomationError("unknown", error);
}

export async function revealFile(filePath: string): Promise<void> {
  await assertExists(filePath);
  shell.showItemInFolder(filePath);
}

export async function openFolder(folderPath: string): Promise<void> {
  await assertExists(folderPath);
  const error = await shell.openPath(folderPath);
  if (error) throw new AutomationError("unknown", error);
}
