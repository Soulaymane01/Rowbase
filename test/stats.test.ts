import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStatsData } from "../src/query/stats.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types.ts";

const columns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Status", type: "select", options: [{ value: "Todo", color: "red" }, { value: "Done", color: "green" }] },
  { name: "Category", type: "select", options: [{ value: "Food", color: "red" }] },
  { name: "Amount", type: "number" },
];
function row(vals: string[], i: number) { return resolveRow(buildRow(vals, i), columns); }

test("status breakdown", () => {
  const data = buildStatsData([row(["A","Todo","Food","10"],0), row(["B","Done","Food","20"],1)], columns);
  assert.equal(data.byStatus.find((s)=>s.label==="Todo")?.count, 1);
});
test("category counts", () => {
  const data = buildStatsData([row(["A","Todo","Food","10"],0), row(["B","Todo","Food","10"],1)], columns);
  assert.equal(data.byCategory.find((s)=>s.label==="Food")?.count, 2);
});
test("average per numeric", () => {
  const data = buildStatsData([row(["A","Todo","Food","10"],0), row(["B","Todo","Food","20"],1)], columns);
  assert.equal(data.avgByNumeric.find((s)=>s.name==="Amount")?.avg, 15);
});
