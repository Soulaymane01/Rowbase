import { ColumnDef } from "../types";

export type AggregateId =
  | "none"
  | "count-all" | "count-filled" | "count-empty" | "count-unique"
  | "percent-filled" | "percent-empty"
  | "sum" | "avg" | "median" | "min" | "max" | "range"
  | "earliest" | "latest"
  | "checked" | "unchecked" | "percent-checked" | "percent-unchecked";

export interface AggregateOption {
  id: AggregateId;
  label: string;
}

const NONE: AggregateOption = { id: "none", label: "None" };
const COUNT_ALL: AggregateOption = { id: "count-all", label: "Count all" };
const COUNT_FILLED: AggregateOption = { id: "count-filled", label: "Count filled" };
const COUNT_EMPTY: AggregateOption = { id: "count-empty", label: "Count empty" };
const COUNT_UNIQUE: AggregateOption = { id: "count-unique", label: "Count unique" };
const PERCENT_FILLED: AggregateOption = { id: "percent-filled", label: "Percent filled" };
const SUM: AggregateOption = { id: "sum", label: "Sum" };
const AVG: AggregateOption = { id: "avg", label: "Average" };
const MEDIAN: AggregateOption = { id: "median", label: "Median" };
const MIN: AggregateOption = { id: "min", label: "Min" };
const MAX: AggregateOption = { id: "max", label: "Max" };
const RANGE: AggregateOption = { id: "range", label: "Range" };
const EARLIEST: AggregateOption = { id: "earliest", label: "Earliest" };
const LATEST: AggregateOption = { id: "latest", label: "Latest" };
const CHECKED: AggregateOption = { id: "checked", label: "Checked" };
const UNCHECKED: AggregateOption = { id: "unchecked", label: "Unchecked" };
const PERCENT_CHECKED: AggregateOption = { id: "percent-checked", label: "Percent checked" };
const PERCENT_UNCHECKED: AggregateOption = { id: "percent-unchecked", label: "Percent unchecked" };

const TEXT_OPTIONS: AggregateOption[] = [NONE, COUNT_ALL, COUNT_FILLED, COUNT_EMPTY, COUNT_UNIQUE, PERCENT_FILLED];
const NUMBER_OPTIONS: AggregateOption[] = [NONE, COUNT_ALL, COUNT_FILLED, COUNT_EMPTY, COUNT_UNIQUE, SUM, AVG, MEDIAN, MIN, MAX, RANGE];
const DATE_OPTIONS: AggregateOption[] = [NONE, COUNT_ALL, COUNT_FILLED, COUNT_EMPTY, COUNT_UNIQUE, EARLIEST, LATEST];
const CHECKBOX_OPTIONS: AggregateOption[] = [NONE, COUNT_ALL, CHECKED, UNCHECKED, PERCENT_CHECKED, PERCENT_UNCHECKED];

export function getAggregateOptions(column: ColumnDef): AggregateOption[] {
  switch (column.type) {
    case "number":
    case "formula":
    case "rollup":
      return NUMBER_OPTIONS;
    case "date":
      return DATE_OPTIONS;
    case "checkbox":
      return CHECKBOX_OPTIONS;
    default:
      return TEXT_OPTIONS;
  }
}

export function isValidAggregate(column: ColumnDef, aggregate: string | undefined): boolean {
  if (!aggregate || aggregate === "none") return false;
  return getAggregateOptions(column).some((o) => o.id === aggregate);
}

export function getAggregateLabel(column: ColumnDef, aggregate: string | undefined): string {
  if (!isValidAggregate(column, aggregate)) return "";
  return getAggregateOptions(column).find((o) => o.id === aggregate)!.label;
}

export interface AggregateRow {
  row: string[];
  computed?: Record<number, string>;
}

function cellValue(r: AggregateRow, colIdx: number): string {
  return r.computed?.[colIdx] ?? r.row[colIdx] ?? "";
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Number.isInteger(n) ? n : parseFloat(n.toFixed(2));
  return String(rounded);
}

function formatPercent(part: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

function numbersFrom(rows: AggregateRow[], colIdx: number): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const raw = cellValue(r, colIdx).trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

function numericAggregate(id: AggregateId, rows: AggregateRow[], colIdx: number): string {
  const nums = numbersFrom(rows, colIdx);
  if (nums.length === 0) return "—";
  const total = nums.reduce((a, b) => a + b, 0);
  switch (id) {
    case "sum": return formatNumber(total);
    case "avg": return formatNumber(total / nums.length);
    case "median": {
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return formatNumber(
        sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
      );
    }
    case "min": return formatNumber(Math.min(...nums));
    case "max": return formatNumber(Math.max(...nums));
    case "range": return formatNumber(Math.max(...nums) - Math.min(...nums));
    default: return "—";
  }
}

function dateAggregate(id: AggregateId, rows: AggregateRow[], colIdx: number): string {
  const values = rows
    .map((r) => cellValue(r, colIdx))
    .filter((v) => v.trim() !== "");
  if (values.length === 0) return "—";
  const sorted = [...values].sort((a, b) => a.localeCompare(b));
  return id === "earliest" ? sorted[0] : sorted[sorted.length - 1];
}

export function computeAggregate(
  rows: AggregateRow[],
  colIdx: number,
  column: ColumnDef,
  aggregate: string | undefined,
): string {
  if (!isValidAggregate(column, aggregate)) return "";
  const id = aggregate as AggregateId;

  const filled = rows.filter((r) => cellValue(r, colIdx).trim() !== "").length;
  const total = rows.length;

  switch (id) {
    case "count-all": return String(total);
    case "count-filled": return String(filled);
    case "count-empty": return String(total - filled);
    case "count-unique": {
      const unique = new Set(
        rows.map((r) => cellValue(r, colIdx)).filter((v) => v.trim() !== "")
      );
      return String(unique.size);
    }
    case "percent-filled": return formatPercent(filled, total);
    case "percent-empty": return formatPercent(total - filled, total);
    case "checked": {
      return String(rows.filter((r) => cellValue(r, colIdx) === "true").length);
    }
    case "unchecked": {
      return String(rows.filter((r) => cellValue(r, colIdx) === "false").length);
    }
    case "percent-checked": {
      const checked = rows.filter((r) => cellValue(r, colIdx) === "true").length;
      return formatPercent(checked, total);
    }
    case "percent-unchecked": {
      const unchecked = rows.filter((r) => cellValue(r, colIdx) === "false").length;
      return formatPercent(unchecked, total);
    }
    case "earliest":
    case "latest":
      return dateAggregate(id, rows, colIdx);
    default:
      return numericAggregate(id, rows, colIdx);
  }
}
