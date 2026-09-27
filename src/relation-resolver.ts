import { App, TFile } from "obsidian";
import { parseCSV } from "./csv-parser";
import { ColumnDef, DatabaseModel } from "./types";
import type { RelationResolver } from "./query";
import { getRelatedRows, normalizeVaultPath, resolveRelationPath } from "./query/relation";

interface CacheEntry {
  mtime: number;
  model: DatabaseModel | null;
}

const cache = new Map<string, CacheEntry>();

async function loadModel(app: App, filePath: string): Promise<DatabaseModel | null> {
  const path = normalizeVaultPath(filePath);
  if (!path) return null;
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return null;

  const cached = cache.get(path);
  if (cached && cached.mtime === file.stat.mtime) return cached.model;

  try {
    const text = await app.vault.read(file);
    const model = parseCSV(text);
    cache.set(path, { mtime: file.stat.mtime, model });
    return model;
  } catch {
    cache.set(path, { mtime: file.stat.mtime, model: null });
    return null;
  }
}

/**
 * Creates a RelationResolver that loads target .rbase files from the vault.
 * The resolver is async-compatible: it returns cached models synchronously
 * when possible, and loads from disk on cache miss.
 *
 * Since runQuery expects a synchronous resolver but vault reads are async,
 * this uses a pre-loading strategy: call `preload()` before runQuery to
 * ensure all relation targets are cached, then the resolver hits cache.
 */
export function createRelationResolver(
  app: App,
  databasePath: string,
  currentModel: DatabaseModel,
): RelationResolver {
  const selfPath = normalizeVaultPath(databasePath);

  // Pre-populate cache for self-reference
  const selfFile = app.vault.getAbstractFileByPath(selfPath);
  if (selfFile instanceof TFile) {
    cache.set(selfPath, { mtime: selfFile.stat.mtime, model: currentModel });
  }

  const resolve = (opts: { targetPath: string; column: string; value?: string; valueColumn?: string }) => {
    const resolved = resolveRelationPath(opts.targetPath, databasePath);
    if (!resolved) return { rows: [], columns: [] };

    // Self-reference: use current model directly
    const model = resolved === selfPath
      ? currentModel
      : cache.get(resolved)?.model ?? null;

    if (!model) return { rows: [], columns: [] };

    return getRelatedRows(model, opts.value ?? "");
  };

  return resolve;
}

/**
 * Pre-loads all relation target databases into cache.
 * Call this before runQuery to ensure resolvers hit cache.
 */
export async function preloadRelationTargets(
  app: App,
  databasePath: string,
  columns: ColumnDef[],
): Promise<void> {
  const selfPath = normalizeVaultPath(databasePath);
  const targets = new Set<string>();
  for (const col of columns) {
    if (col.type === "relation" && col.relationTargetPath) {
      const resolved = resolveRelationPath(col.relationTargetPath, databasePath);
      if (resolved && resolved !== selfPath) {
        targets.add(resolved);
      }
    }
  }

  await Promise.all(Array.from(targets).map((t) => loadModel(app, t)));
}

/** Clear the relation cache (for testing or after writes). */
export function clearRelationCache(): void {
  cache.clear();
}
