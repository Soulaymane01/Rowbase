import { ColumnDef, DatabaseModel, ViewDef } from "../types";
import { QueryResultRow, buildRow, resolveRow, getDisplayValue } from "./record";
import { matchesFilter } from "./filter";
import { sortRows } from "./sort";
import { evaluateFormula, FormulaEnv, FormulaValue } from "./formula";
import { computeRollup } from "./rollup";
import { TypedValue } from "./resolve";

export type { QueryResultRow } from "./record";
export { buildRow, resolveRow, getDisplayValue } from "./record";
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
export { computeRollup } from "./rollup";
export type { RollupHandler, RollupValue } from "./rollup";

export type RelationResolver = (opts: { targetPath: string; column: string; value?: string; valueColumn?: string }) => { rows: Array<{ row: string[] }>; columns: ColumnDef[] };

function typedToFormulaValue(v: TypedValue): FormulaValue {
  if (v.kind === "number") return v.number;
  if (v.kind === "text") return v.text;
  if (v.kind === "date") return v.date.toISOString();
  if (v.kind === "multi") return v.multi.join(", ");
  return null;
}

function computeComputed(
  row: QueryResultRow,
  model: DatabaseModel,
  resolveRelation: RelationResolver | undefined,
): QueryResultRow {
  const computed: Record<number, string> = {};
  model.columns.forEach((col, colIdx) => {
    if (col.type === "formula" && col.formula) {
      const env: FormulaEnv = {
        getColumn: (name) => {
          const idx = model.columns.findIndex((c) => c.name === name);
          if (idx === -1) return null;
          return row.values[idx] !== undefined ? typedToFormulaValue(row.values[idx]) : null;
        },
        getRelatedNumbers: (relationColumn, valueColumn) => {
          const relIdx = model.columns.findIndex((c) => c.name === relationColumn);
          if (relIdx === -1 || !resolveRelation) return [];
          const relCol = model.columns[relIdx];
          const targetPath = relCol.relationTargetPath ?? "";
          const relValue = row.row[relIdx] ?? "";
          const { rows, columns } = resolveRelation({ targetPath, column: relationColumn, value: relValue, valueColumn });
          const vi = columns.findIndex((c) => c.name === valueColumn);
          if (vi === -1) return [];
          return rows.map((r) => {
            const raw = r.row[vi];
            const n = Number(raw);
            return Number.isNaN(n) ? 0 : n;
          });
        },
      };
      const cell = evaluateFormula(col.formula, env);
      computed[colIdx] = cell.kind === "error" ? `#ERROR: ${cell.message}` : String(cell.value);
    } else if (col.type === "rollup" && col.rollup && resolveRelation) {
      const relIdx = model.columns.findIndex((c) => c.name === col.rollup!.relationColumn);
      if (relIdx !== -1) {
        const relCol = model.columns[relIdx];
        const relValue = row.row[relIdx] ?? "";
        const related = resolveRelation({ targetPath: relCol.relationTargetPath ?? "", column: relCol.name, value: relValue });
        const targetIndex = related.columns?.findIndex((c) => c.name === col.rollup!.targetColumn) ?? -1;
        const filter = col.rollup!.targetFilter
          ? { index: related.columns?.findIndex((c) => c.name === col.rollup!.targetFilter!.column) ?? -1, equals: col.rollup!.targetFilter!.equals }
          : undefined;
        if (targetIndex !== -1) {
          const value = computeRollup(related.rows as any, targetIndex, filter, col.rollup!.handler);
          computed[colIdx] = value === null ? "" : String(value);
        }
      }
    }
  });
  if (Object.keys(computed).length) row.computed = computed;
  return row;
}

export function runQuery(model: DatabaseModel, view: ViewDef, resolveRelation?: RelationResolver): QueryResultRow[] {
  let result = model.rows.map((row, originalIndex) => computeComputed(resolveRow(buildRow(row, originalIndex), model.columns), model, resolveRelation));

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
