import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChartData } from "../src/query/chart.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types";

const columns: ColumnDef[] = [
  { name: "Category", type: "select", options: [
    { value: "Food", color: "red" },
    { value: "Travel", color: "blue" },
  ]},
  { name: "Amount", type: "number" },
  { name: "Date", type: "date" },
];

function row(vals: string[], i: number) {
  return resolveRow(buildRow(vals, i), columns);
}

const rows = [
  row(["Food", "10", "2024-01-01"], 0),
  row(["Travel", "20", "2024-01-02"], 1),
  row(["Food", "30", "2024-01-03"], 2),
  row(["Food", "", "2024-01-04"], 3), // empty amount → skipped for sum/avg
];

test("count aggregation on categorical X", () => {
  const data = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "count" });
  assert.deepEqual(data.labels, ["Food", "Travel"]);
  assert.equal(data.series.length, 1);
  assert.deepEqual(data.series[0].values, [3, 1]);
});

test("sum aggregation on categorical X skips empty amounts", () => {
  const data = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "sum" });
  assert.deepEqual(data.labels, ["Food", "Travel"]);
  assert.deepEqual(data.series[0].values, [40, 20]);
});

test("avg aggregation", () => {
  const data = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "avg" });
  assert.deepEqual(data.series[0].values, [20, 20]);
});

test("pie returns a single series with a value per label", () => {
  const data = buildChartData(rows, columns, { type: "pie", xColumn: "Category", yColumn: "Amount", agg: "sum" });
  assert.equal(data.series.length, 1);
  assert.deepEqual(data.labels, ["Food", "Travel"]);
  assert.deepEqual(data.series[0].values, [40, 20]);
});

test("line/area with color-by splits into one series per color value", () => {
  const cols: ColumnDef[] = [
    { name: "Category", type: "select", options: [{ value: "Food", color: "red" }, { value: "Travel", color: "blue" }] },
    { name: "Owner", type: "select", options: [{ value: "A", color: "red" }, { value: "B", color: "blue" }] },
    { name: "Amount", type: "number" },
  ];
  const r = (vals: string[], i: number) => resolveRow(buildRow(vals, i), cols);
  const data = buildChartData(
    [
      r(["Food", "A", "1"], 0),
      r(["Travel", "B", "2"], 1),
      r(["Food", "A", "3"], 2),
    ],
    cols,
    { type: "line", xColumn: "Category", yColumn: "Amount", agg: "sum", colorByColumn: "Owner" },
  );
  // X labels from Category: Food, Travel (appearance order).
  assert.deepEqual(data.labels, ["Food", "Travel"]);
  // color-by over Owner → one series per Owner value, in FIRST-APPEARANCE order (A row0, B row1).
  assert.equal(data.series.length, 2);
  assert.equal(data.series[0].name, "A");
  assert.equal(data.series[1].name, "B");
  // Owner A: Food=1+3 → [4, 0] in label order (Food, Travel).
  assert.deepEqual(data.series[0].values, [4, 0]);
  // Owner B: Travel=2 → [0, 2].
  assert.deepEqual(data.series[1].values, [0, 2]);
});

test("min, max and median aggregations", () => {
  const min = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "min" });
  assert.deepEqual(min.series[0].values, [10, 20]);
  const max = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "max" });
  assert.deepEqual(max.series[0].values, [30, 20]);
  const median = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "median" });
  assert.deepEqual(median.series[0].values, [20, 20]);
});

test("sort by value asc/desc", () => {
  const asc = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "sum", sort: "asc" });
  assert.deepEqual(asc.labels, ["Travel", "Food"]);
  assert.deepEqual(asc.series[0].values, [20, 40]);
  const desc = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "sum", sort: "desc" });
  assert.deepEqual(desc.labels, ["Food", "Travel"]);
  assert.deepEqual(desc.series[0].values, [40, 20]);
});

test("date X column is sorted naturally by default", () => {
  const cols: ColumnDef[] = [
    { name: "Date", type: "date" },
    { name: "Amount", type: "number" },
  ];
  const r = (vals: string[], i: number) => resolveRow(buildRow(vals, i), cols);
  const data = buildChartData(
    [
      r(["2024-03-01", "1"], 0),
      r(["2024-01-01", "2"], 1),
      r(["2024-02-01", "3"], 2),
    ],
    cols,
    { type: "bar", xColumn: "Date", yColumn: "Amount", agg: "count" },
  );
  assert.deepEqual(data.labels, ["2024-01-01", "2024-02-01", "2024-03-01"]);
});

test("missing xColumn yields empty labels and series", () => {
  const data = buildChartData(rows, columns, { type: "bar", xColumn: "Nonexistent", yColumn: "Amount", agg: "sum" });
  assert.deepEqual(data.labels, []);
  assert.equal(data.series.length, 0);
});
