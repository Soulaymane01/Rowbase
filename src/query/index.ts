import { ColumnDef, DatabaseModel, ViewDef } from "../types";
import { QueryResultRow, buildRow, resolveRow } from "./record";
import { matchesFilter } from "./filter";
import { sortRows } from "./sort";

export type { QueryResultRow } from "./record";
export { buildRow, resolveRow } from "./record";
export type { TypedValue } from "./resolve";
export { resolveValue } from "./resolve";
export { matchesFilter } from "./filter";
export { sortRows } from "./sort";
export { compareValues } from "./compare";
export { groupRowsBySelect } from "./group";
export type { Group } from "./group";
export { buildChartData } from "./chart";
export type { ChartData, ChartSeries, ChartKind, ChartAgg, ChartConfig } from "./chart";
export { evaluateFormula } from "./formula";
export type { FormulaCell, FormulaValue, FormulaEnv } from "./formula";

export function runQuery(model: DatabaseModel, view: ViewDef): QueryResultRow[] {
  let result = model.rows.map((row, originalIndex) => resolveRow(buildRow(row, originalIndex), model.columns));

  if (view.filters.length > 0) {
    result = result.filter((r) =>
      view.filters.every((f) => {
        const colIdx = model.columns.findIndex((c) => c.name === f.column);
        if (colIdx === -1) return true;
        const column = model.columns[colIdx];
        return matchesFilter(r.values[colIdx] ?? { kind: "empty" }, column, f.operator, f.value);
      }),
    );
  }

  return sortRows(result, view.sorts.map((s) => ({ ...s })), model.columns);
}
