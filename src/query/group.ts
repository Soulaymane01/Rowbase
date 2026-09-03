import { ColumnDef, SelectOption } from "../types";
import { QueryResultRow } from "./record";

export interface Group {
  groupValue: string;
  option: SelectOption | null;
  rows: QueryResultRow[];
}

export function groupRowsBySelect(
  rows: QueryResultRow[],
  columns: ColumnDef[],
  groupByColumn: string | undefined,
): Group[] {
  if (!groupByColumn) return [];
  const dataIdx = columns.findIndex((c) => c.name === groupByColumn);
  if (dataIdx === -1) return [];
  const col = columns[dataIdx];
  if (col.type !== "select") return [];

  const options = col.options || [];
  const groupMap = new Map<string, QueryResultRow[]>();
  for (const opt of options) groupMap.set(opt.value, []);
  groupMap.set("", []);

  for (const entry of rows) {
    const cellValue = entry.row[dataIdx] || "";
    const bucket = groupMap.get(cellValue);
    if (bucket) {
      bucket.push(entry);
    } else {
      // Orphaned value not in options → "No value"
      groupMap.get("")!.push(entry);
    }
  }

  const result: Group[] = [];
  for (const opt of options) {
    result.push({ groupValue: opt.value, option: opt, rows: groupMap.get(opt.value)! });
  }
  const noValueRows = groupMap.get("")!;
  if (noValueRows.length > 0) {
    result.push({ groupValue: "", option: null, rows: noValueRows });
  }
  return result;
}
