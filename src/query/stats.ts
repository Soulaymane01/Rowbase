import { ColumnDef } from "../types";
import { QueryResultRow } from "./record";

export interface StatsData {
  byStatus: { label: string; count: number }[];
  byCategory: { label: string; count: number }[];
  avgByNumeric: { name: string; avg: number }[];
}

export function buildStatsData(rows: QueryResultRow[], columns: ColumnDef[]): StatsData {
  const byStatus: Map<string, number> = new Map();
  const byCategory: Map<string, number> = new Map();
  const numericSums: Map<string, { sum: number; n: number }> = new Map();

  const statusIdx = columns.findIndex((c) => c.name.toLowerCase() === "status" || c.type === "select");
  const categoryIdx = columns.findIndex((c) => c.name.toLowerCase() === "category" || c.name.toLowerCase() === "type");
  const numericCols = columns.map((c, i) => ({ c, i })).filter(({ c }) => c.type === "number");

  for (const r of rows) {
    if (statusIdx !== -1) {
      const v = r.row[statusIdx] || "—";
      byStatus.set(v, (byStatus.get(v) || 0) + 1);
    }
    if (categoryIdx !== -1) {
      const v = r.row[categoryIdx] || "—";
      byCategory.set(v, (byCategory.get(v) || 0) + 1);
    }
    for (const { c, i } of numericCols) {
      const raw = r.row[i];
      const n = Number(raw);
      if (raw !== "" && !Number.isNaN(n)) {
        const cur = numericSums.get(c.name) || { sum: 0, n: 0 };
        cur.sum += n; cur.n += 1;
        numericSums.set(c.name, cur);
      }
    }
  }

  return {
    byStatus: Array.from(byStatus.entries()).map(([label, count]) => ({ label, count })),
    byCategory: Array.from(byCategory.entries()).map(([label, count]) => ({ label, count })),
    avgByNumeric: Array.from(numericSums.entries()).map(([name, v]) => ({ name, avg: v.n ? v.sum / v.n : 0 })),
  };
}
