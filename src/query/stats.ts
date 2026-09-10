import { ColumnDef, SelectOption } from "../types";
import { QueryResultRow } from "./record";

export interface StatGroup {
  label: string;
  count: number;
  color?: string;
}

export interface NumericStat {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  median: number;
}

export interface DateGroup {
  label: string;
  count: number;
  date: string;
}

export interface StatsData {
  totalRows: number;
  bySelect: Map<string, StatGroup[]>;
  numericStats: NumericStat[];
  dateByMonth: DateGroup[];
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function resolveColor(val: string, options?: SelectOption[]): string | undefined {
  if (!options) return undefined;
  return options.find((o) => o.value.toLowerCase() === val.toLowerCase())?.color;
}

export function buildStatsData(rows: QueryResultRow[], columns: ColumnDef[]): StatsData {
  const bySelect = new Map<string, StatGroup[]>();
  const numericStats: NumericStat[] = [];
  const dateByMonth = new Map<string, number>();

  const selectCols = columns.map((c, i) => ({ c, i })).filter(({ c }) => c.type === "select");
  const numericCols = columns.map((c, i) => ({ c, i })).filter(({ c }) => c.type === "number" || c.type === "progress");
  const dateCols = columns.map((c, i) => ({ c, i })).filter(({ c }) => c.type === "date");

  for (const { c, i } of selectCols) {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = r.row[i] || "—";
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    const groups: StatGroup[] = Array.from(counts.entries()).map(([label, count]) => ({
      label, count, color: resolveColor(label, c.options),
    }));
    groups.sort((a, b) => b.count - a.count);
    bySelect.set(c.name, groups);
  }

  for (const { c, i } of numericCols) {
    const nums: number[] = [];
    for (const r of rows) {
      const raw = r.row[i];
      const n = Number(raw);
      if (raw !== "" && !Number.isNaN(n)) nums.push(n);
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    numericStats.push({
      name: c.name,
      count: nums.length,
      sum,
      avg: nums.length ? sum / nums.length : 0,
      min: nums.length ? Math.min(...nums) : 0,
      max: nums.length ? Math.max(...nums) : 0,
      median: median(nums),
    });
  }

  for (const { i } of dateCols) {
    for (const r of rows) {
      const raw = r.row[i];
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      dateByMonth.set(key, (dateByMonth.get(key) || 0) + 1);
    }
  }

  const dateGroups: DateGroup[] = Array.from(dateByMonth.entries())
    .map(([key, count]) => ({ label: key, count, date: key }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totalRows: rows.length, bySelect, numericStats, dateByMonth: dateGroups };
}
