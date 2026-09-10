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

test("select grouping with colors includes unused options", () => {
  const data = buildStatsData([row(["A","Todo","High","10","2024-01-01"],0), row(["B","Todo","Low","20","2024-02-01"],1)], columns);
  const status = data.bySelect.get("Status")!;
  assert.equal(status.length, 2);
  assert.equal(status[0].label, "Todo");
  assert.equal(status[0].count, 2);
  assert.equal(status[0].color, "red");
  const done = status.find((g) => g.label === "Done")!;
  assert.equal(done.count, 0);
  assert.equal(done.color, "green");
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
  assert.equal(amt.range, 20);
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

test("date grouped by month per column", () => {
  const data = buildStatsData([
    row(["A","Todo","High","10","2024-01-15"],0),
    row(["B","Done","Low","20","2024-01-20"],1),
    row(["C","Todo","High","30","2024-02-05"],2),
  ], columns);
  const created = data.dateByColumn.get("Created")!;
  assert.equal(created.length, 2);
  assert.equal(created[0].label, "2024-01");
  assert.equal(created[0].count, 2);
  assert.equal(created[1].label, "2024-02");
  assert.equal(created[1].count, 1);
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

test("multiselect distribution counts each value", () => {
  const cols: ColumnDef[] = [
    { name: "Tags", type: "multiselect", options: [{ value: "Bug", color: "red" }, { value: "Feature", color: "blue" }] },
  ];
  const r = (vals: string[], i: number) => resolveRow(buildRow(vals, i), cols);
  const data = buildStatsData([
    r(["Bug|Feature"], 0),
    r(["Bug"], 1),
    r([""], 2),
  ], cols);
  const tags = data.bySelect.get("Tags")!;
  assert.equal(tags.find((g) => g.label === "Bug")!.count, 2);
  assert.equal(tags.find((g) => g.label === "Feature")!.count, 1);
  assert.equal(tags.find((g) => g.label === "No value")!.count, 1);
});

test("checkbox stats", () => {
  const cols: ColumnDef[] = [{ name: "Done", type: "checkbox" }];
  const r = (vals: string[], i: number) => resolveRow(buildRow(vals, i), cols);
  const data = buildStatsData([r(["true"], 0), r(["true"], 1), r(["false"], 2), r([""], 3)], cols);
  const done = data.checkboxStats[0];
  assert.equal(done.checked, 2);
  assert.equal(done.unchecked, 1);
});

test("field coverage", () => {
  const data = buildStatsData([
    row(["A","Todo","High","10","2024-01-01"],0),
    row(["B","","","",""],1),
  ], columns);
  const name = data.coverage.find((c) => c.name === "Name")!;
  assert.equal(name.filled, 2);
  const status = data.coverage.find((c) => c.name === "Status")!;
  assert.equal(status.filled, 1);
});
