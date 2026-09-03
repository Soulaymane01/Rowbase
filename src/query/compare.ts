import { ColumnDef } from "../types";
import { TypedValue } from "./resolve";

export function compareValues(a: TypedValue, b: TypedValue, column: ColumnDef): number {
  // Empty always sorts last.
  const aEmpty = a.kind === "empty";
  const bEmpty = b.kind === "empty";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (column.type === "number" && a.kind === "number" && b.kind === "number") {
    return a.number - b.number;
  }
  if (column.type === "date" && a.kind === "date" && b.kind === "date") {
    return a.date.getTime() - b.date.getTime();
  }

  // Select / multiselect respect configured option order.
  if (column.options && column.options.length > 0) {
    const order = new Map(column.options.map((o, i) => [o.value, i]));
    const key = (v: TypedValue): string =>
      v.kind === "text" ? v.text : v.kind === "multi" ? (v.multi[0] ?? "") : "";
    const ia = order.get(key(a)) ?? 999;
    const ib = order.get(key(b)) ?? 999;
    if (ia !== ib) return ia - ib;
  }

  const ta = a.kind === "text" ? a.text : a.kind === "multi" ? a.multi.join(", ") : "";
  const tb = b.kind === "text" ? b.text : b.kind === "multi" ? b.multi.join(", ") : "";
  return ta.localeCompare(tb);
}
