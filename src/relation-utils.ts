import { App, TFile } from "obsidian";
import { parseCSV, splitMultiSelect, joinMultiSelect } from "./csv-parser";
import { ColumnDef, DatabaseModel } from "./types";
import { getDatabaseFolder, normalizeVaultPath, resolveRelationPath } from "./query/relation";

export interface RelationRecord {
  key: string;
  display: string;
}

interface RelationRecordsCacheEntry {
  mtime: number;
  records?: RelationRecord[];
  promise?: Promise<RelationRecord[]>;
}

const relationRecordsCache = new Map<string, RelationRecordsCacheEntry>();

export function formatRelationTargetPath(filePath: string, databasePath: string): string {
  const fromParts = getDatabaseFolder(databasePath).split("/").filter(Boolean);
  const toParts = filePath.split("/").filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common++;
  }

  const relativeParts = [
    ...Array.from({ length: fromParts.length - common }, () => ".."),
    ...toParts.slice(common),
  ];
  return relativeParts.join("/") || filePath;
}

export function splitRelationValue(value: string, column: ColumnDef): string[] {
  if (!value) return [];
  return column.relationMultiple ? splitMultiSelect(value) : [value];
}

export function joinRelationValue(values: string[], column: ColumnDef): string {
  return column.relationMultiple ? joinMultiSelect(values) : (values[0] || "");
}

function getRelationRecordsFromModel(model: DatabaseModel): RelationRecord[] {
  const titleIdx = model.columns.findIndex((c) => c.type === "title");
  if (titleIdx === -1) return [];

  return model.rows
    .map((row) => {
      const title = row[titleIdx] || "";
      return { key: title, display: title };
    })
    .filter((record) => record.key);
}

export async function loadRelationRecords(app: App, column: ColumnDef, databasePath: string, currentModel?: DatabaseModel | null): Promise<RelationRecord[]> {
  const targetPath = column.relationTargetPath
    ? resolveRelationPath(column.relationTargetPath, databasePath)
    : "";
  if (!targetPath) return [];
  if (targetPath === normalizeVaultPath(databasePath)) {
    return currentModel ? getRelationRecordsFromModel(currentModel) : [];
  }

  const file = app.vault.getAbstractFileByPath(targetPath);
  if (!(file instanceof TFile)) return [];

  const cached = relationRecordsCache.get(file.path);
  if (cached && cached.mtime === file.stat.mtime) {
    if (cached.records) return cached.records;
    if (cached.promise) return cached.promise;
  }

  const promise = app.vault.read(file)
    .then((text) => {
      const model = parseCSV(text);
      const titleIdx = model.columns.findIndex((c) => c.type === "title");
      if (titleIdx === -1) return [];

      return model.rows
        .map((row) => {
          const title = row[titleIdx] || "";
          return { key: title, display: title };
        })
        .filter((record) => record.key);
    })
    .catch(() => []);

  relationRecordsCache.set(file.path, { mtime: file.stat.mtime, promise });
  const records = await promise;
  relationRecordsCache.set(file.path, { mtime: file.stat.mtime, records });
  return records;
}

export async function fileHasTitleColumn(app: App, file: TFile): Promise<boolean> {
  try {
    const model = parseCSV(await app.vault.read(file));
    return model.columns.some((column) => column.type === "title");
  } catch {
    return false;
  }
}

/** Columns of the database a relation column points at (empty when unresolvable). */
export async function loadRelationTargetColumns(app: App, targetPath: string, databasePath: string): Promise<ColumnDef[]> {
  const resolved = resolveRelationPath(targetPath, databasePath);
  if (!resolved) return [];
  const file = app.vault.getAbstractFileByPath(resolved);
  if (!(file instanceof TFile)) return [];
  try {
    return parseCSV(await app.vault.read(file)).columns;
  } catch {
    return [];
  }
}
