import { App, TFile } from "obsidian";
import { parseCSV, splitMultiSelect } from "./csv-parser";
import { ColumnDef, DatabaseModel } from "./types";
import type { RelationResolver } from "./query";

interface CacheEntry {
  mtime: number;
  model: DatabaseModel | null;
}

const cache = new Map<string, CacheEntry>();

function resolveTargetPath(targetPath: string, databasePath: string): string {
  const trimmed = targetPath.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  const folder = databasePath.split("/").slice(0, -1).join("/");
  return [folder, trimmed].filter(Boolean).join("/");
}

function normalizePath(p: string): string {
  const parts: string[] = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

async function loadModel(app: App, filePath: string): Promise<DatabaseModel | null> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) return null;

  const cached = cache.get(filePath);
  if (cached && cached.mtime === file.stat.mtime) return cached.model;

  try {
    const text = await app.vault.read(file);
    const model = parseCSV(text);
    cache.set(filePath, { mtime: file.stat.mtime, model });
    return model;
  } catch {
    cache.set(filePath, { mtime: file.stat.mtime, model: null });
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
  // Pre-populate cache for self-reference
  const selfFile = app.vault.getAbstractFileByPath(databasePath);
  if (selfFile instanceof TFile) {
    cache.set(databasePath, { mtime: selfFile.stat.mtime, model: currentModel });
  }

  const resolve = (opts: { targetPath: string; column: string; value?: string; valueColumn?: string }) => {
    const resolved = resolveTargetPath(opts.targetPath, databasePath);
    if (!resolved) return { rows: [], columns: [] };

    let model: DatabaseModel | null = null;

    // Self-reference: use current model directly
    if (normalizePath(resolved) === normalizePath(databasePath)) {
      model = currentModel;
    } else {
      const cached = cache.get(resolved);
      model = cached?.model ?? null;
    }

    if (!model) return { rows: [], columns: [] };

    // Filter by relation value (title column match)
    if (opts.value) {
      const titleIdx = model.columns.findIndex((c) => c.type === "title");
      if (titleIdx !== -1) {
        const keys = splitMultiSelect(opts.value);
        const keySet = new Set(keys);
        const filtered = model.rows.filter((r) => keySet.has(r[titleIdx] ?? ""));
        return { rows: filtered.map((r) => ({ row: r })), columns: model.columns };
      }
    }

    return { rows: model.rows.map((r) => ({ row: r })), columns: model.columns };
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
  const targets = new Set<string>();
  for (const col of columns) {
    if (col.type === "relation" && col.relationTargetPath) {
      const resolved = resolveTargetPath(col.relationTargetPath, databasePath);
      if (resolved && normalizePath(resolved) !== normalizePath(databasePath)) {
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
