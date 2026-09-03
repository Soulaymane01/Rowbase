import assert from "node:assert/strict";
import { test } from "node:test";
import { sortRows } from "../src/query/sort.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef, SortRule } from "../src/types";

const columns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Qty", type: "number" },
  { name: "Status", type: "select", options: [{ value: "Done", color: "green" }, { value: "Todo", color: "red" }] },
];

const rows = resolveRow(buildRow(["Beta", "5", "Todo"], 0), columns);
const rows2 = resolveRow(buildRow(["alpha", "3", "Done"], 1), columns);
const rows3 = resolveRow(buildRow(["", "10", "Todo"], 2), columns);

test("sorts by single number ascending", () => {
  const out = sortRows([rows, rows2, rows3], [{ column: "Qty", direction: "asc" }], columns);
  assert.deepEqual(out.map((r) => r.originalIndex), [1, 0, 2]);
});

test("multi-column: number then text", () => {
  const out = sortRows([rows2, rows3, rows], [
    { column: "Qty", direction: "asc" },
    { column: "Name", direction: "asc" },
  ], columns);
  assert.deepEqual(out.map((r) => r.originalIndex), [1, 0, 2]);
});

test("select uses option order, empty last", () => {
  // rows2 = Done (option index 0), rows = Todo (index 1), rows3 = Todo (index 1)
  const out = sortRows([rows2, rows, rows3], [{ column: "Status", direction: "asc" }], columns);
  assert.deepEqual(out.map((r) => r.originalIndex), [1, 0, 2]);
});
