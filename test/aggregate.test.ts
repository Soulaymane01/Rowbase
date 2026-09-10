import assert from "node:assert/strict";
import { test } from "node:test";
import { computeAggregate, getAggregateOptions, isValidAggregate } from "../src/query/aggregate.ts";
import { ColumnDef } from "../src/types.ts";

const numberCol: ColumnDef = { name: "Amount", type: "number" };
const textCol: ColumnDef = { name: "Name", type: "text" };
const dateCol: ColumnDef = { name: "Date", type: "date" };
const checkboxCol: ColumnDef = { name: "Done", type: "checkbox" };
const formulaCol: ColumnDef = { name: "Calc", type: "formula" };

const rows = [
  { row: ["10", "A", "2024-01-15", "true"], computed: undefined },
  { row: ["20", "B", "2024-02-01", "false"], computed: undefined },
  { row: ["30", "", "2024-03-10", "true"], computed: undefined },
];

test("options by column type", () => {
  assert.ok(getAggregateOptions(numberCol).some((o) => o.id === "sum"));
  assert.ok(getAggregateOptions(formulaCol).some((o) => o.id === "avg"));
  assert.ok(getAggregateOptions(dateCol).some((o) => o.id === "earliest"));
  assert.ok(getAggregateOptions(checkboxCol).some((o) => o.id === "checked"));
  assert.ok(getAggregateOptions(textCol).some((o) => o.id === "count-filled"));
  assert.ok(!getAggregateOptions(textCol).some((o) => o.id === "sum"));
});

test("isValidAggregate", () => {
  assert.equal(isValidAggregate(numberCol, "sum"), true);
  assert.equal(isValidAggregate(numberCol, "none"), false);
  assert.equal(isValidAggregate(numberCol, undefined), false);
  assert.equal(isValidAggregate(textCol, "sum"), false);
});

test("count aggregates", () => {
  assert.equal(computeAggregate(rows, 0, numberCol, "count-all"), "3");
  assert.equal(computeAggregate(rows, 1, textCol, "count-filled"), "2");
  assert.equal(computeAggregate(rows, 1, textCol, "count-empty"), "1");
  assert.equal(computeAggregate(rows, 1, textCol, "count-unique"), "2");
});

test("numeric aggregates", () => {
  assert.equal(computeAggregate(rows, 0, numberCol, "sum"), "60");
  assert.equal(computeAggregate(rows, 0, numberCol, "avg"), "20");
  assert.equal(computeAggregate(rows, 0, numberCol, "median"), "20");
  assert.equal(computeAggregate(rows, 0, numberCol, "min"), "10");
  assert.equal(computeAggregate(rows, 0, numberCol, "max"), "30");
  assert.equal(computeAggregate(rows, 0, numberCol, "range"), "20");
});

test("numeric aggregates skip empty cells", () => {
  const rowsWithEmpty = [
    { row: ["10"], computed: undefined },
    { row: [""], computed: undefined },
    { row: ["30"], computed: undefined },
  ];
  assert.equal(computeAggregate(rowsWithEmpty, 0, numberCol, "sum"), "40");
  assert.equal(computeAggregate(rowsWithEmpty, 0, numberCol, "avg"), "20");
});

test("numeric aggregates with no numbers", () => {
  assert.equal(computeAggregate([{ row: [""] }], 0, numberCol, "sum"), "—");
});

test("date aggregates", () => {
  assert.equal(computeAggregate(rows, 2, dateCol, "earliest"), "2024-01-15");
  assert.equal(computeAggregate(rows, 2, dateCol, "latest"), "2024-03-10");
});

test("checkbox aggregates", () => {
  assert.equal(computeAggregate(rows, 3, checkboxCol, "checked"), "2");
  assert.equal(computeAggregate(rows, 3, checkboxCol, "unchecked"), "1");
  assert.equal(computeAggregate(rows, 3, checkboxCol, "percent-checked"), "67%");
  assert.equal(computeAggregate(rows, 3, checkboxCol, "percent-unchecked"), "33%");
});

test("percent filled", () => {
  assert.equal(computeAggregate(rows, 1, textCol, "percent-filled"), "67%");
});

test("invalid aggregate returns empty", () => {
  assert.equal(computeAggregate(rows, 0, textCol, "sum"), "");
  assert.equal(computeAggregate(rows, 0, numberCol, undefined), "");
});

test("computed values are used", () => {
  const computedRows = [
    { row: ["", ""], computed: { 1: "5" } },
    { row: ["", ""], computed: { 1: "7" } },
  ];
  assert.equal(computeAggregate(computedRows, 1, formulaCol, "sum"), "12");
});
