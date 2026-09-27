import { App, TFile } from "obsidian";
import { ColumnDef } from "./types";
import { joinMultiSelect, splitMultiSelect } from "./csv-parser";

export function normalizeNoteValue(value: string): string {
  const trimmed = value.trim();
  const wiki = trimmed.match(/^!?\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/);
  return (wiki ? wiki[1].trim() : trimmed).replace(/\\/g, "/");
}

/** Note values in a cell: multiple when the column allows it, single otherwise. */
export function splitNoteValues(value: string, column: ColumnDef): string[] {
  if (!value) return [];
  return column.noteMultiple ? splitMultiSelect(value) : [value];
}

export function joinNoteValues(values: string[]): string {
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  return cleaned.length > 1 ? joinMultiSelect(cleaned) : (cleaned[0] || "");
}

/** Resolve a column's default note folder against the database's folder. */
export function resolveNoteFolder(folder: string, databasePath: string): string {
  const raw = (folder || "").trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return raw.replace(/^\/+|\/+$/g, "");
  const currentFolder = databasePath.split("/").slice(0, -1).join("/");
  return [currentFolder, raw.replace(/^\/+|\/+$/g, "")].filter(Boolean).join("/");
}

/** Apply a default folder to a typed note name that has no folder of its own. */
export function applyNoteFolder(value: string, folder: string): string {
  const normalized = normalizeNoteValue(value);
  if (!normalized || !folder) return normalized;
  if (normalized.includes("/")) return normalized;
  return `${folder.replace(/\/+$/, "")}/${normalized}`;
}

export function getNoteDisplayName(path: string): string {
  return path.replace(/\.md$/, "").split("/").pop() || path;
}

export function resolveNoteFile(app: App, value: string): TFile | null {
  const normalized = normalizeNoteValue(value);
  if (!normalized) return null;

  return app.metadataCache.getFirstLinkpathDest(normalized, "");
}

export function notePathExists(app: App, value: string): boolean {
  return resolveNoteFile(app, value) !== null;
}

export async function openNoteValue(app: App, value: string): Promise<void> {
  const normalized = normalizeNoteValue(value);
  if (!normalized) return;

  const resolved = resolveNoteFile(app, normalized);
  await app.workspace.openLinkText(resolved?.path || normalized, "");
}
