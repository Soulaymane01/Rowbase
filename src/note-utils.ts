import { App, TFile } from "obsidian";

export function normalizeNoteValue(value: string): string {
  return value.trim().replace(/\\/g, "/");
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
