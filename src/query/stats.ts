import { ColumnDef, TagColor } from "../types";
import { QueryResultRow } from "./record";
import { splitMultiSelect } from "../csv-parser";

export interface StatGroup {
  label: string;
  count: number;
  color?: TagColor;
}

export interface NumericStat {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  median: number;
  range: number;
}

export interface DateGroup {
  label: string;
  count: number;
  date: string;
}

export interface CheckboxStat {
  name: string;
  checked: number;
  unchecked: number;
}

export interface CoverageStat {
  name: string;
  filled: number;
}

export interface StatsData {
  totalRows: number;
  bySelect: Map<string, StatGroup[]>;
  numericStats: NumericStat[];
  dateByColumn: Map<string, DateGroup[]>;
  checkboxStats: CheckboxStat[];
  coverage: CoverageStat[];
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Build distribution groups for a select/multiselect column, including unused options and a "No value" bucket. */
function buildDistribution(
  rows: QueryResultRow[],
  colIdx: number,
  col: ColumnDef,
): StatGroup[] {
  const counts = new Map<string, number>();
  let empty = 0;
  for (const r of rows) {
    const raw = r.row[colIdx] ?? "";
    if (!raw.trim()) {
      empty += 1;
      continue;
    }
    const values = col.type === "multiselect" ? splitMultiSelect(raw) : [raw];
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  }

  const optionValues = new Set((col.options || []).map((o) => o.value));
  const groups: StatGroup[] = (col.options || []).map((o) => ({
    label: o.value,
    count: counts.get(o.value) || 0,
    color: o.color,
  }));
  for (const [label, count] of counts) {
    if (!optionValues.has(label)) groups.push({ label, count });
  }
  if (empty > 0) groups.push({ label: "No value", count: empty });

  groups.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return groups;
}

export function buildStatsData(rows: QueryResultRow[], columns: ColumnDef[]): StatsData {
  const bySelect = new Map<string, StatGroup[]>();
  const numericStats: NumericStat[] = [];
  const dateByColumn = new Map<string, DateGroup[]>();
  const checkboxStats: CheckboxStat[] = [];
  const coverage: CoverageStat[] = [];

  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    let filled = 0;
    for (const r of rows) if ((r.row[i] ?? "").trim() !== "") filled += 1;
    coverage.push({ name: c.name, filled });
  }

  for (const { c, i } of columns.map((c, i) => ({ c, i }))) {
    if (c.type === "select" || c.type === "multiselect") {
      bySelect.set(c.name, buildDistribution(rows, i, c));
    } else if (c.type === "number" || c.type === "progress") {
      const nums: number[] = [];
      for (const r of rows) {
        const raw = r.row[i];
        const n = Number(raw);
        if (raw !== "" && !Number.isNaN(n)) nums.push(n);
      }
      const sum = nums.reduce((a, b) => a + b, 0);
      const min = nums.length ? Math.min(...nums) : 0;
      const max = nums.length ? Math.max(...nums) : 0;
      numericStats.push({
        name: c.name,
        count: nums.length,
        sum,
        avg: nums.length ? sum / nums.length : 0,
        min,
        max,
        median: median(nums),
        range: max - min,
      });
    } else if (c.type === "checkbox") {
      let checked = 0;
      let unchecked = 0;
      for (const r of rows) {
        const v = r.row[i];
        if (v === "true") checked += 1;
        else if (v === "false") unchecked += 1;
      }
      checkboxStats.push({ name: c.name, checked, unchecked });
    } else if (c.type === "date") {
      const map = new Map<string, number>();
      for (const r of rows) {
        const raw = r.row[i];
        if (!raw) continue;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
      const groups: DateGroup[] = Array.from(map.entries())
        .map(([key, count]) => ({ label: key, count, date: key }))
        .sort((a, b) => a.date.localeCompare(b.date));
      if (groups.length > 0) dateByColumn.set(c.name, groups);
    }
  }

  return { totalRows: rows.length, bySelect, numericStats, dateByColumn, checkboxStats, coverage };
}
