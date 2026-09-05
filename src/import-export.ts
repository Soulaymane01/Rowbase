import * as Papa from "papaparse";
import { ColumnDef, TagColor } from "./types";
import { TAG_COLORS } from "./constants";

function isDateString(v: string): boolean {
  if (!v) return false;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{2}\/\d{2}\/\d{4}/.test(v);
}

function isNumberString(v: string): boolean {
  if (v === "" || v.trim() === "") return false;
  return !Number.isNaN(Number(v));
}

function isCheckboxString(v: string): boolean {
  const l = v.toLowerCase().trim();
  return ["true", "false", "yes", "no", "1", "0", "checked", "unchecked"].includes(l);
}

export function inferColumnType(values: string[]): ColumnDef["type"] {
  const nonEmpty = values.filter((v) => v !== "" && v != null);
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.every(isDateString)) return "date";
  if (nonEmpty.every(isNumberString)) return "number";
  if (nonEmpty.every(isCheckboxString)) return "checkbox";
  const distinct = new Set(nonEmpty.map((v) => v.trim()));
  if (distinct.size <= 8 && distinct.size < nonEmpty.length * 0.5) return "select";
  return "text";
}

export function inferColumns(headers: string[], rows: string[][]): ColumnDef[] {
  return headers.map((name, idx) => {
    const colValues = rows.map((r) => r[idx] ?? "");
    const type = inferColumnType(colValues);
    const col: ColumnDef = { name: name || `Column ${idx + 1}`, type, columnIndex: idx };
    if (type === "select") {
      const distinct = Array.from(new Set(colValues.filter(Boolean).map((v) => v.trim()))).slice(0, 20);
      col.options = distinct.map((v, i) => ({ value: v, color: (Object.keys(TAG_COLORS) as TagColor[])[i % 9] || "gray" }));
    }
    return col;
  });
}

export function parsePlainCSV(text: string): { headers: string[]; rows: string[][] } {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const data = result.data;
  if (data.length === 0) return { headers: [], rows: [] };
  const headers = (data[0] || []).map((h) => h.trim());
  const rows = data.slice(1).map((row) => {
    const out: string[] = [];
    for (let i = 0; i < headers.length; i++) out.push(row[i] ?? "");
    return out;
  });
  return { headers, rows };
}

export function exportToPlainCSV(headers: string[], rows: string[][]): string {
  return Papa.unparse([headers, ...rows]);
}

export function exportToJSON(columns: ColumnDef[], rows: string[][]): string {
  const data = rows.map((row) => {
    const obj: Record<string, string> = {};
    columns.forEach((c, i) => { obj[c.name] = row[i] ?? ""; });
    return obj;
  });
  return JSON.stringify({ columns, data }, null, 2);
}
