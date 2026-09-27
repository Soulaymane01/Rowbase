import { ColumnDef, FilterRule } from "../types";
import { joinMultiSelect } from "../csv-parser";

/**
 * Filter operators a new row can be made to satisfy by writing a value:
 *  - equals → write the exact value (visual filters, select/checkbox/date/etc.)
 *  - contains / starts-with → the search text itself satisfies the rule
 *
 * Everything else (is-not, does-not-contain, is-empty, is-not-empty, numeric
 * and date ranges) either already holds for an empty cell or has no
 * unambiguous satisfying value, so it is left alone.
 */
const PREFILLABLE_OPERATORS = new Set(["equals", "contains", "starts-with"]);

/**
 * Values implied by a view's filters, so a row created from a filtered view
 * (e.g. "+ New" on a filtered kanban board) stays visible instead of being
 * silently filtered out. One update per column; explicit values passed by the
 * caller (such as the kanban column's group value) should override these.
 */
export function getFilterPrefillValues(
  filters: FilterRule[],
  columns: ColumnDef[]
): { colIdx: number; value: string }[] {
  const updates = new Map<number, string>();

  for (const filter of filters) {
    const colIdx = columns.findIndex((c) => c.name === filter.column);
    if (colIdx === -1) continue;

    const column = columns[colIdx];
    // Computed columns can't be written back.
    if (column.type === "formula" || column.type === "rollup") continue;
    if (updates.has(colIdx)) continue;
    if (!PREFILLABLE_OPERATORS.has(filter.operator)) continue;

    const values = filter.value.filter((v) => v !== "");
    if (values.length === 0) continue;

    const multi =
      column.type === "multiselect" ||
      (column.type === "relation" && column.relationMultiple === true);
    updates.set(colIdx, multi ? joinMultiSelect(values) : values[0]);
  }

  return Array.from(updates, ([colIdx, value]) => ({ colIdx, value }));
}
