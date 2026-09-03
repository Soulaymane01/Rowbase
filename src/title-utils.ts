import { App } from "obsidian";
import { ColumnDef } from "./types";
import { notePathExists, openNoteValue } from "./note-utils";

export function getTitleNotePath(value: string, column: ColumnDef, databasePath: string): string {
  if (column.titleNoteEnabled === false) return "";

  const title = value.trim();
  if (!title) return "";

  const filename = title.endsWith(".md") ? title : `${title}.md`;
  const rawFolder = (column.titleNoteFolder || "").trim();
  if (rawFolder.startsWith("/")) {
    const folder = rawFolder.replace(/^\/+|\/+$/g, "");
    return folder ? `${folder}/${filename}` : filename;
  }

  const currentFolder = databasePath.split("/").slice(0, -1).join("/");
  const folder = rawFolder.replace(/^\/+|\/+$/g, "");
  const baseFolder = [currentFolder, folder].filter(Boolean).join("/");
  return baseFolder ? `${baseFolder}/${filename}` : filename;
}

export function titleNoteExists(app: App, value: string, column: ColumnDef, databasePath: string): boolean {
  const path = getTitleNotePath(value, column, databasePath);
  return path ? notePathExists(app, path) : false;
}

export async function openTitleNote(app: App, value: string, column: ColumnDef, databasePath: string): Promise<void> {
  const path = getTitleNotePath(value, column, databasePath);
  if (path) {
    await openNoteValue(app, path);
  }
}
