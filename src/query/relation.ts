import { ColumnDef, DatabaseModel } from "../types";
import { splitMultiSelect } from "../csv-parser";

export interface RelatedRow {
  row: string[];
}

/** Collapse ".", "..", and duplicate separators in a vault path. */
export function normalizeVaultPath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

export function getDatabaseFolder(databasePath: string): string {
  return databasePath.split("/").slice(0, -1).join("/");
}

/**
 * Resolve a relation/rollup target path against the database's folder.
 * Relative paths are joined to the database folder; paths starting with "/"
 * resolve from the vault root. The result is normalized, so ".." segments
 * collapse before any vault lookup.
 */
export function resolveRelationPath(targetPath: string, databasePath: string): string {
  const trimmed = targetPath.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) {
    return normalizeVaultPath(trimmed);
  }
  return normalizeVaultPath([getDatabaseFolder(databasePath), trimmed].filter(Boolean).join("/"));
}

/**
 * Rows in `model` linked by a relation cell value. Relation values are row
 * titles (pipe-joined when the column allows multiple). An empty value means
 * "no related rows" — never the whole table.
 */
export function getRelatedRows(
  model: DatabaseModel,
  value: string
): { rows: RelatedRow[]; columns: ColumnDef[] } {
  const titleIdx = model.columns.findIndex((c) => c.type === "title");
  if (titleIdx === -1) return { rows: [], columns: model.columns };

  const keys = value ? splitMultiSelect(value) : [];
  if (keys.length === 0) return { rows: [], columns: model.columns };

  const keySet = new Set(keys);
  return {
    rows: model.rows.filter((r) => keySet.has(r[titleIdx] ?? "")).map((r) => ({ row: r })),
    columns: model.columns,
  };
}
