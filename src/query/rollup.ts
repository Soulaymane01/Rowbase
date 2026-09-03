export type RollupHandler = "count" | "sum" | "avg" | "min" | "max" | "list";
export type RollupValue = number | string | null;

interface RelatedRow {
  row: string[];
}

export function computeRollup(
  related: RelatedRow[],
  targetIndex: number,
  filter: { index: number; equals: string } | undefined,
  handler: RollupHandler,
): RollupValue {
  const rows = filter
    ? related.filter((r) => (r.row[filter.index] ?? "") === filter.equals)
    : related;

  const values: number[] = [];
  for (const r of rows) {
    const raw = r.row[targetIndex];
    if (raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (Number.isNaN(n)) continue;
    values.push(n);
  }

  switch (handler) {
    case "count": return rows.length;
    case "sum": return values.length ? values.reduce((a, b) => a + b, 0) : null;
    case "avg": return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    case "min": return values.length ? Math.min(...values) : null;
    case "max": return values.length ? Math.max(...values) : null;
    case "list": return values.length ? values.join(", ") : "";
    default: return null;
  }
}
