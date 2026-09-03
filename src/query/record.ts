import { ColumnDef } from "../types";
import { TypedValue, resolveValue } from "./resolve";

export interface QueryResultRow {
  row: string[];
  originalIndex: number;
  id: string;
  values: TypedValue[];
  computed?: Record<number, string>;
}

export function buildRow(row: string[], originalIndex: number): QueryResultRow {
  return { row, originalIndex, id: String(originalIndex), values: [] };
}

export function resolveRow(row: QueryResultRow, columns: ColumnDef[]): QueryResultRow {
  row.values = columns.map((c, colIdx) => resolveValue(row.row[colIdx], c.type));
  return row;
}

export function getDisplayValue(row: QueryResultRow, colIdx: number): string {
  return row.computed?.[colIdx] ?? row.row[colIdx] ?? "";
}
