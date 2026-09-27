import { ColumnDef } from "../types";

/** Column names that explicitly mean "this holds the card cover". */
export const COVER_NAME_PATTERN = /^(cover|image|photo|img|poster|thumbnail|thumb)$/i;

export function isCoverColumnName(name: string): boolean {
  return COVER_NAME_PATTERN.test(name.trim());
}

/**
 * Pick the gallery cover column, in priority order:
 *   1. a column explicitly named cover/image/photo/...,
 *   2. an `image`-type column,
 *   3. a url/link column.
 *
 * Each candidate is only used when `hasCoverValue` reports that it actually
 * holds something cover-shaped. That keeps plain URL/Link columns (link
 * galleries) from turning into empty cover placeholders.
 */
export function pickCoverColumn(
  columns: ColumnDef[],
  hasCoverValue: (column: ColumnDef, columnIndex: number) => boolean
): ColumnDef | null {
  const passes = (column: ColumnDef) => hasCoverValue(column, columns.indexOf(column));

  return (
    columns.find((c) => isCoverColumnName(c.name) && passes(c)) ??
    columns.find((c) => c.type === "image" && passes(c)) ??
    columns.find((c) => (c.type === "url" || c.type === "link") && passes(c)) ??
    null
  );
}
