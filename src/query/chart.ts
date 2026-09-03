import { ColumnDef } from "../types";
import { QueryResultRow } from "./record";

export type ChartKind = "bar" | "line" | "pie" | "area";
export type ChartAgg = "count" | "sum" | "avg";

export interface ChartConfig {
  type: ChartKind;
  xColumn: string;
  yColumn: string;
  agg: ChartAgg;
  colorByColumn?: string;
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

export function buildChartData(
  rows: QueryResultRow[],
  columns: ColumnDef[],
  config: ChartConfig,
): ChartData {
  const xIdx = columns.findIndex((c) => c.name === config.xColumn);
  const yIdx = config.agg === "count" ? -1 : columns.findIndex((c) => c.name === config.yColumn);

  // Determine label set from the X column's distinct values in appearance order.
  const labelOrder: string[] = [];
  const labelSeen = new Set<string>();
  for (const r of rows) {
    if (xIdx === -1) break;
    const label = r.row[xIdx] || "—";
    if (!labelSeen.has(label)) {
      labelSeen.add(label);
      labelOrder.push(label);
    }
  }
  const labels = xIdx === -1 ? [] : labelOrder;

  // If color-by is set and is a distinct column, split into one series per color value.
  const colorIdx = config.colorByColumn
    ? columns.findIndex((c) => c.name === config.colorByColumn)
    : -1;

  // Group keys: for color-by, "series|label"; else "label".
  const keyFor = (label: string, color: string) => (colorIdx === -1 ? label : `${color}\u0000${label}`);

  const seriesNames: string[] = [];
  const seriesSeen = new Set<string>();
  const aggregates = new Map<string, { count: number; sum: number; n: number }>();

  for (const r of rows) {
    const label = xIdx === -1 ? "" : (r.row[xIdx] || "—");
    const color = colorIdx === -1 ? "" : (r.row[colorIdx] || "—");
    const key = keyFor(label, color);
    let agg = aggregates.get(key);
    if (!agg) {
      agg = { count: 0, sum: 0, n: 0 };
      aggregates.set(key, agg);
      if (colorIdx !== -1 && !seriesSeen.has(color)) {
        seriesSeen.add(color);
        seriesNames.unshift(color);
      }
    }
    agg.count += 1;
    if (yIdx !== -1) {
      const n = numberValue(r.row[yIdx]);
      if (n !== null) { agg.sum += n; agg.n += 1; }
    }
  }

  const seriesOrder = colorIdx === -1 ? [""] : seriesNames;
  const series: ChartSeries[] = seriesOrder.map((color) => {
    const values = labels.map((label) => {
      const agg = aggregates.get(keyFor(label, color));
      if (!agg) return 0;
      if (config.agg === "count") return agg.count;
      if (config.agg === "avg") return agg.n > 0 ? agg.sum / agg.n : 0;
      return agg.sum;
    });
    return { name: color || "value", values };
  });

  return { labels, series };
}
