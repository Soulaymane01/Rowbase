import { ColumnDef } from "../types";
import { QueryResultRow } from "./record";

export type ChartKind = "bar" | "line" | "pie" | "area";
export type ChartAgg = "count" | "sum" | "avg" | "min" | "max" | "median";
export type ChartSort = "none" | "asc" | "desc";

export interface ChartConfig {
  type: ChartKind;
  xColumn: string;
  yColumn: string;
  agg: ChartAgg;
  colorByColumn?: string;
  sort?: ChartSort;
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

function numberValue(cell: string | undefined): number | null {
  if (cell === undefined || cell === "") return null;
  const n = Number(cell);
  return Number.isNaN(n) ? null : n;
}

function aggregateValues(agg: ChartAgg, values: number[], count: number): number {
  if (agg === "count") return count;
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum":
      return values.reduce((a, b) => a + b, 0);
    case "avg":
      return values.reduce((a, b) => a + b, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "median": {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    default:
      return 0;
  }
}

export function buildChartData(
  rows: QueryResultRow[],
  columns: ColumnDef[],
  config: ChartConfig,
): ChartData {
  const xIdx = columns.findIndex((c) => c.name === config.xColumn);
  if (xIdx === -1) return { labels: [], series: [] };
  const yIdx = config.agg === "count" ? -1 : columns.findIndex((c) => c.name === config.yColumn);
  const colorIdx = config.colorByColumn
    ? columns.findIndex((c) => c.name === config.colorByColumn)
    : -1;

  // Label set from the X column's distinct values, in appearance order.
  const labels: string[] = [];
  const labelSeen = new Set<string>();
  for (const r of rows) {
    const label = r.row[xIdx] || "—";
    if (!labelSeen.has(label)) {
      labelSeen.add(label);
      labels.push(label);
    }
  }

  const keyFor = (label: string, color: string) => (colorIdx === -1 ? label : `${color}\u0000${label}`);

  const seriesNames: string[] = [];
  const seriesSeen = new Set<string>();
  const acc = new Map<string, { count: number; values: number[] }>();

  for (const r of rows) {
    const label = r.row[xIdx] || "—";
    const color = colorIdx === -1 ? "" : (r.row[colorIdx] || "—");
    const key = keyFor(label, color);
    let a = acc.get(key);
    if (!a) {
      a = { count: 0, values: [] };
      acc.set(key, a);
      if (colorIdx !== -1 && !seriesSeen.has(color)) {
        seriesSeen.add(color);
        seriesNames.push(color);
      }
    }
    a.count += 1;
    if (yIdx !== -1) {
      const n = numberValue(r.row[yIdx]);
      if (n !== null) a.values.push(n);
    }
  }

  const seriesOrder = colorIdx === -1 ? [""] : seriesNames;
  const rawSeries: ChartSeries[] = seriesOrder.map((color) => ({
    name: color || "value",
    values: labels.map((label) => {
      const a = acc.get(keyFor(label, color));
      return a ? aggregateValues(config.agg, a.values, a.count) : 0;
    }),
  }));

  // Ordering: explicit value sort, otherwise natural sort for number/date X columns.
  const xCol = columns[xIdx];
  const sort = config.sort ?? "none";
  let order = labels.map((_, i) => i);
  if (sort === "asc" || sort === "desc") {
    order = order.sort((a, b) => {
      const ta = rawSeries.reduce((s, ser) => s + ser.values[a], 0);
      const tb = rawSeries.reduce((s, ser) => s + ser.values[b], 0);
      return sort === "asc" ? ta - tb : tb - ta;
    });
  } else if (xCol.type === "number" || xCol.type === "date") {
    order = order.sort((a, b) => {
      const na = Number(labels[a]);
      const nb = Number(labels[b]);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return labels[a].localeCompare(labels[b]);
    });
  }

  return {
    labels: order.map((i) => labels[i]),
    series: rawSeries.map((s) => ({ name: s.name, values: order.map((i) => s.values[i]) })),
  };
}
