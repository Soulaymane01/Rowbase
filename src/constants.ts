import { ColumnType, TagColor } from "./types";

export const TAG_COLORS: Record<TagColor, { bg: string; text: string }> = {
  gray:   { bg: "var(--csv-db-tag-gray-bg, #E3E2E080)", text: "var(--csv-db-tag-gray-text, #5A5A5A)" },
  brown:  { bg: "#EEE0DA",   text: "#6B4C3B" },
  orange: { bg: "#FADEC9",   text: "#AD5700" },
  yellow: { bg: "#FDECC8",   text: "#AD7700" },
  green:  { bg: "#DBEDDB",   text: "#2B6B2B" },
  blue:   { bg: "#D3E5EF",   text: "#24548F" },
  purple: { bg: "#E8DEEE",   text: "#6940A5" },
  pink:   { bg: "#F5E0E9",   text: "#AD1A72" },
  red:    { bg: "#FFE2DD",   text: "#C4554D" },
};

export const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Select" },
  { value: "multiselect", label: "Multi-select" },
  { value: "note", label: "Note" },
  { value: "title", label: "Title" },
  { value: "relation", label: "Relation" },
  { value: "url", label: "URL" },
  { value: "link", label: "Link" },
  { value: "image", label: "Image" },
  { value: "formula", label: "Formula" },
  { value: "rollup", label: "Rollup" },
  { value: "progress", label: "Progress" },
];

export const TAG_COLOR_OPTIONS: TagColor[] = [
  "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red",
];

export function pickColor(index: number): TagColor {
  const palette: TagColor[] = ["gray", "blue", "green", "orange", "purple", "pink", "red", "yellow", "brown"];
  return palette[index % palette.length];
}

/**
 * Columns added to every new database. The first column is a real Title
 * column so new databases get note/folder linking out of the box.
 */
export const DEFAULT_TEMPLATE_COLUMNS = JSON.stringify([
  { name: "Name", type: "title" },
  {
    name: "Status",
    type: "select",
    options: [
      { value: "Todo", color: "red" },
      { value: "In Progress", color: "yellow" },
      { value: "Done", color: "green" },
    ],
  },
  { name: "Date", type: "date" },
]);

/** The 0.1.3-era template, kept only to migrate stored settings. */
const LEGACY_DEFAULT_TEMPLATE_COLUMNS = JSON.stringify([
  { name: "Name", type: "text" },
  {
    name: "Status",
    type: "select",
    options: [
      { value: "Todo", color: "red" },
      { value: "In Progress", color: "yellow" },
      { value: "Done", color: "green" },
    ],
  },
  { name: "Date", type: "date" },
]);

/**
 * True when the stored template is the untouched legacy default. Used to
 * upgrade settings saved before the Title-first default; custom templates
 * are left alone.
 */
export function isLegacyDefaultTemplate(templateJson: string): boolean {
  try {
    return JSON.stringify(JSON.parse(templateJson)) === JSON.stringify(JSON.parse(LEGACY_DEFAULT_TEMPLATE_COLUMNS));
  } catch {
    return false;
  }
}

export function getTypeIcon(type: string): string {
  switch (type) {
    case "text": return "Aa";
    case "number": return "#";
    case "date": return "⊞";
    case "checkbox": return "☑";
    case "select": return "▾";
    case "multiselect": return "≡";
    case "note": return "↗";
    case "title": return "T";
    case "relation": return "⇄";
    case "url": return "↗";
    case "link": return "🔗";
    case "image": return "▣";
    case "formula": return "ƒ";
    case "rollup": return "Σ";
    case "progress": return "◐";
    default: return "Aa";
  }
}
