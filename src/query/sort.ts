import { ColumnDef, SortRule } from "../types";
import { QueryResultRow } from "./record";
import { compareValues } from "./compare";

export function sortRows(
  rows: QueryResultRow[],
  sorts: SortRule[],
  columns: ColumnDef[],
): QueryResultRow[] {
  if (sorts.length === 0) return rows;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const sort of sorts) {
      const colIdx = columns.findIndex((c) => c.name === sort.column);
      if (colIdx === -1) continue;
      const cmp = compareValues(a.values[colIdx] ?? { kind: "empty" }, b.values[colIdx] ?? { kind: "empty" }, columns[colIdx]);
      if (cmp !== 0) return sort.direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}
