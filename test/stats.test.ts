import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStatsData } from "../src/query/stats.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types.ts";

const columns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Status", type: "select", options: [{ value: "Todo", color: "red" }, { value: "Done", color: "green" }] },
  { name: "Priority", type: "select", options: [{ value: "High", color: "orange" }, { value: "Low", color: "blue" }] },
  { name: "Amount", type: "number" },
  { name: "Created", type: "date" },
];
function row(vals: string[], i: number) { return resolveRow(buildRow(vals, i), columns); }

test("total rows", () => {
  const data = buildStatsData([row(["A","Todo","High","10","2024-01-01"],0), row(["B","Done","Low","20","2024-02-01"],1)], columns);
  assert.equal(data.totalRows, 2);
});

test("select grouping with colors", () => {
  const data = buildStatsData([row(["A","Todo","High","10","2024-01-01"],0), row(["B","Todo","Low","20","2024-02-01"],1)], columns);
  const status = data.bySelect.get("Status")!;
  assert.equal(status.length, 1);
  assert.equal(status[0].label, "Todo");
  assert.equal(status[0].count, 2);
  assert.equal(status[0].color, "red");
});

test("multiple select columns", () => {
  const data = buildStatsData([row(["A","Todo","High","10","2024-01-01"],0), row(["B","Done","Low","20","2024-02-01"],1)], columns);
  assert.ok(data.bySelect.has("Status"));
  assert.ok(data.bySelect.has("Priority"));
});

test("numeric stats", () => {
  const data = buildStatsData([row(["A","Todo","High","10","2024-01-01"],0), row(["B","Done","Low","30","2024-02-01"],1)], columns);
  const amt = data.numericStats.find((s) => s.name === "Amount")!;
  assert.equal(amt.count, 2);
  assert.equal(amt.sum, 40);
  assert.equal(amt.avg, 20);
  assert.equal(amt.min, 10);
  assert.equal(amt.max, 30);
  assert.equal(amt.median, 20);
});

test("median for odd count", () => {
  const data = buildStatsData([
    row(["A","Todo","High","10","2024-01-01"],0),
    row(["B","Done","Low","30","2024-02-01"],1),
    row(["C","Todo","High","20","2024-03-01"],2),
  ], columns);
  const amt = data.numericStats.find((s) => s.name === "Amount")!;
  assert.equal(amt.median, 20);
});

test("date by month grouping", () => {
  const data = buildStatsData([
    row(["A","Todo","High","10","2024-01-15"],0),
    row(["B","Done","Low","20","2024-01-20"],1),
    row(["C","Todo","High","30","2024-02-05"],2),
  ], columns);
  assert.equal(data.dateByMonth.length, 2);
  assert.equal(data.dateByMonth[0].label, "2024-01");
  assert.equal(data.dateByMonth[0].count, 2);
  assert.equal(data.dateByMonth[1].label, "2024-02");
  assert.equal(data.dateByMonth[1].count, 1);
});

test("select sorted by count desc", () => {
  const data = buildStatsData([
    row(["A","Todo","High","10","2024-01-01"],0),
    row(["B","Todo","High","20","2024-02-01"],1),
    row(["C","Done","Low","30","2024-03-01"],2),
  ], columns);
  const status = data.bySelect.get("Status")!;
  assert.equal(status[0].label, "Todo");
  assert.equal(status[0].count, 2);
  assert.equal(status[1].label, "Done");
  assert.equal(status[1].count, 1);
});
