import assert from "node:assert/strict";
import { test } from "node:test";
import { runQuery, getDisplayValue } from "../src/query/index.ts";
import { DatabaseModel, ColumnDef } from "../src/types.ts";

const columns: ColumnDef[] = [
  { name: "Price", type: "number" },
  { name: "Qty", type: "number" },
  { name: "Total", type: "formula", formula: "Price * Qty" },
];

const model: DatabaseModel = {
  columns,
  rows: [["4", "3", ""], ["10", "2", ""]],
  views: [{ name: "Default", sorts: [], filters: [], hiddenColumns: [] }],
  formatVersion: 1,
};

test("formula column computes per row", () => {
  const out = runQuery(model, model.views[0]);
  assert.equal(out[0].computed?.[2], "12");
  assert.equal(out[1].computed?.[2], "20");
  // the raw cell stays empty (not written back)
  assert.equal(out[0].row[2], "");
});

test("getDisplayValue prefers computed", () => {
  const out = runQuery(model, model.views[0]);
  assert.equal(getDisplayValue(out[0], 2), "12");
});
