import { App, TFile } from "obsidian";
import { normalizeNoteValue } from "./note-utils";

export const IMG_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif"];

export function isImageUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value) || value.startsWith("data:");
}

export function findImageFile(app: App, raw: string): TFile | null {
  const value = normalizeNoteValue(raw);
  if (!value) return null;

  const byLink = app.metadataCache.getFirstLinkpathDest(value, "");
  if (byLink && IMG_EXTS.includes(byLink.extension.toLowerCase())) return byLink;

  const direct = app.vault.getAbstractFileByPath(value);
  if (direct instanceof TFile && IMG_EXTS.includes(direct.extension.toLowerCase())) return direct;

  const byName = app.vault
    .getFiles()
    .find((f) => f.path === value || f.name === value || f.basename === value);
  return byName && IMG_EXTS.includes(byName.extension.toLowerCase()) ? byName : null;
}

/** Resolve a cell value (vault path, wikilink embed, or URL) into an <img> src. */
export function resolveImageSrc(app: App, raw: string): string | null {
  const value = normalizeNoteValue(raw);
  if (!value) return null;
  if (isImageUrl(value)) return value;
  const file = findImageFile(app, value);
  return file ? app.vault.getResourcePath(file) : null;
}

/**
 * Whether a value is plausibly an image — used for gallery cover detection so
 * plain web links don't become broken covers. Vault values must resolve to an
 * image file; URLs must end in an image extension (query/hash ignored).
 */
export function isImageLikeValue(app: App, raw: string): boolean {
  const value = normalizeNoteValue(raw);
  if (!value) return false;
  if (isImageUrl(value)) {
    const path = value.split("?")[0].split("#")[0].toLowerCase();
    return IMG_EXTS.some((ext) => path.endsWith(`.${ext}`));
  }
  return findImageFile(app, value) !== null;
}

export function getImageDisplayName(raw: string): string {
  const value = normalizeNoteValue(raw);
  if (!value) return "";
  if (isImageUrl(value)) {
    const last = value.split("/").pop()?.split("?")[0] || value;
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  return value.split("/").pop() || value;
}
