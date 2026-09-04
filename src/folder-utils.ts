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

async function ensureFolder(app: App, path: string): Promise<void> {
  const parts = path.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      await app.vault.createFolder(current);
    }
  }
}

export async function openTitleFolder(app: App, value: string, column: ColumnDef, databasePath: string): Promise<void> {
  const path = getTitleFolderPath(value, column, databasePath);
  if (!path) return;

  let file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFolder)) {
    await ensureFolder(app, path);
    file = app.vault.getAbstractFileByPath(path);
  }
  if (file instanceof TFolder) {
    app.workspace.trigger("file-explorer:reveal", file);
  }
}
