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
];

export const TAG_COLOR_OPTIONS: TagColor[] = [
  "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red",
];

export function pickColor(index: number): TagColor {
  const palette: TagColor[] = ["gray", "blue", "green", "orange", "purple", "pink", "red", "yellow", "brown"];
  return palette[index % palette.length];
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
    default: return "Aa";
  }
}
