import { App, TFile } from "obsidian";
import { ColumnDef } from "./types";
import { joinMultiSelect, splitMultiSelect } from "./csv-parser";
import { ensureFolder } from "./folder-utils";

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

export type NoteOpenMode = "current" | "split";

/**
 * Open a note in a vertical split (to the right of the current pane).
 * Missing notes are created first, matching the current-pane CREATE behavior.
 */
async function openNoteInSplit(app: App, linkText: string): Promise<void> {
  let file = app.metadataCache.getFirstLinkpathDest(linkText, "");

  if (!file) {
    const path = linkText.endsWith(".md") ? linkText : `${linkText}.md`;
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      file = existing;
    } else {
      const folder = path.split("/").slice(0, -1).join("/");
      if (folder) await ensureFolder(app, folder);
      try {
        file = await app.vault.create(path, "");
      } catch {
        file = app.metadataCache.getFirstLinkpathDest(path, "");
      }
    }
  }

  if (!file) {
    // Let Obsidian resolve/create the link if the vault write didn't land.
    await app.workspace.openLinkText(linkText, "", "split");
    return;
  }

  const leaf = app.workspace.getLeaf("split", "vertical");
  await leaf.openFile(file);
}

export async function openNoteValue(
  app: App,
  value: string,
  options?: { mode?: NoteOpenMode }
): Promise<void> {
  const normalized = normalizeNoteValue(value);
  if (!normalized) return;

  if (options?.mode === "split") {
    await openNoteInSplit(app, normalized);
    return;
  }

  const resolved = resolveNoteFile(app, normalized);
  await app.workspace.openLinkText(resolved?.path || normalized, "");
}
