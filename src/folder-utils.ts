import { App, TFolder } from "obsidian";
import { ColumnDef } from "./types";

export function getTitleFolderPath(value: string, column: ColumnDef, databasePath: string): string {
  if (!column.titleFolderEnabled) return "";

  const title = value.trim();
  if (!title) return "";

  const rawFolder = (column.titleFolderPath || "").trim();
  if (rawFolder.startsWith("/")) {
    const folder = rawFolder.replace(/^\/+|\/+$/g, "");
    return folder ? `${folder}/${title}` : title;
  }

  const currentFolder = databasePath.split("/").slice(0, -1).join("/");
  const folder = rawFolder.replace(/^\/+|\/+$/g, "");
  const baseFolder = [currentFolder, folder].filter(Boolean).join("/");
  return baseFolder ? `${baseFolder}/${title}` : title;
}

export function titleFolderExists(app: App, value: string, column: ColumnDef, databasePath: string): boolean {
  const path = getTitleFolderPath(value, column, databasePath);
  if (!path) return false;
  const file = app.vault.getAbstractFileByPath(path);
  return file instanceof TFolder;
}

export async function openTitleFolder(app: App, value: string, column: ColumnDef, databasePath: string): Promise<void> {
  const path = getTitleFolderPath(value, column, databasePath);
  if (!path) return;

  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFolder) {
    app.workspace.trigger("file-explorer:reveal", file);
  }
}
