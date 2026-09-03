import { App, TFile } from "obsidian";
import { parseCSV, splitMultiSelect, joinMultiSelect } from "./csv-parser";
import { ColumnDef, DatabaseModel } from "./types";

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

function normalizeVaultPath(path: string): string {
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

function getDatabaseFolder(databasePath: string): string {
  return databasePath.split("/").slice(0, -1).join("/");
}

export function resolveRelationTargetPath(targetPath: string, databasePath: string): string {
  const trimmed = targetPath.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) {
    return normalizeVaultPath(trimmed);
  }
  return normalizeVaultPath([getDatabaseFolder(databasePath), trimmed].filter(Boolean).join("/"));
}

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
    ? resolveRelationTargetPath(column.relationTargetPath, databasePath)
    : "";
  if (!targetPath) return [];
  if (targetPath === databasePath) {
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
