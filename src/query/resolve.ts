import { ColumnType } from "../types";
import { splitMultiSelect } from "../csv-parser";

export type TypedValue =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "date"; date: Date }
  | { kind: "multi"; multi: string[] };

export function resolveValue(cell: string | undefined, type: ColumnType): TypedValue {
  const raw = cell ?? "";
  if (type === "number") {
    const n = Number(raw);
    return raw === "" || Number.isNaN(n) ? { kind: "empty" } : { kind: "number", number: n };
  }
  if (type === "date") {
    if (!raw) return { kind: "empty" };
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? { kind: "empty" } : { kind: "date", date: d };
  }
  if (type === "multiselect" || type === "relation") {
    const parts = splitMultiSelect(raw);
    return parts.length === 0 ? { kind: "empty" } : { kind: "multi", multi: parts };
  }
  if (type === "select") {
    return raw === "" ? { kind: "empty" } : { kind: "text", text: raw };
  }
  if (type === "checkbox") {
    return raw === "" ? { kind: "empty" } : { kind: "text", text: raw };
  }
  return raw === "" ? { kind: "empty" } : { kind: "text", text: raw };
}
