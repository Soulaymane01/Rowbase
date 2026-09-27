import assert from "node:assert/strict";
import { test } from "node:test";
import { getFilterPrefillValues } from "../src/query/prefill.ts";
import { runQuery } from "../src/query/index.ts";
import { ColumnDef, DatabaseModel, FilterRule, ViewDef } from "../src/types.ts";

const columns: ColumnDef[] = [
  { name: "Name", type: "title" },
  {
    name: "Status",
    type: "select",
    options: [
      { value: "Todo", color: "red" },
      { value: "Done", color: "green" },
    ],
  },
  { name: "Notes", type: "text" },
  { name: "Tags", type: "multiselect", options: [] },
  { name: "Done", type: "checkbox" },
  { name: "Amount", type: "number" },
  { name: "Total", type: "formula", formula: "Amount * 2" },
];

test("equals on a select column sets the exact value", () => {
  const filters: FilterRule[] = [{ column: "Status", operator: "equals", value: ["Todo"] }];
  assert.deepEqual(getFilterPrefillValues(filters, columns), [{ colIdx: 1, value: "Todo" }]);
});

test("equals on a checkbox sets true/false", () => {
  const filters: FilterRule[] = [{ column: "Done", operator: "equals", value: ["true"] }];
  assert.deepEqual(getFilterPrefillValues(filters, columns), [{ colIdx: 4, value: "true" }]);
});

test("contains and starts-with write the search text", () => {
  assert.deepEqual(
    getFilterPrefillValues([{ column: "Notes", operator: "contains", value: ["work"] }], columns),
    [{ colIdx: 2, value: "work" }]
  );
  assert.deepEqual(
    getFilterPrefillValues([{ column: "Notes", operator: "starts-with", value: ["Q3"] }], columns),
    [{ colIdx: 2, value: "Q3" }]
  );
});

test("multiselect equals joins every filter value", () => {
  const filters: FilterRule[] = [{ column: "Tags", operator: "equals", value: ["work", "urgent"] }];
  assert.deepEqual(getFilterPrefillValues(filters, columns), [{ colIdx: 3, value: "work|urgent" }]);
});

test("rules that can't be satisfied by writing a value are skipped", () => {
  const skipped: FilterRule[] = [
    { column: "Status", operator: "is-not", value: ["Done"] },
    { column: "Notes", operator: "does-not-contain", value: ["draft"] },
    { column: "Notes", operator: "is-empty", value: [] },
    { column: "Notes", operator: "is-not-empty", value: [] },
    { column: "Amount", operator: "greater-than", value: ["10"] },
    { column: "Amount", operator: "between", value: ["1", "2"] },
  ];
  assert.deepEqual(getFilterPrefillValues(skipped, columns), []);
});

test("formula columns and unknown columns are skipped", () => {
  assert.deepEqual(
    getFilterPrefillValues([{ column: "Total", operator: "equals", value: ["40"] }], columns),
    []
  );
  assert.deepEqual(
    getFilterPrefillValues([{ column: "Missing", operator: "equals", value: ["x"] }], columns),
    []
  );
});

test("one update per column, first rule wins", () => {
  const filters: FilterRule[] = [
    { column: "Status", operator: "equals", value: ["Todo"] },
    { column: "Status", operator: "contains", value: ["ting"] },
  ];
  assert.deepEqual(getFilterPrefillValues(filters, columns), [{ colIdx: 1, value: "Todo" }]);
});

test("a prefilled new row matches the view it was created from", () => {
  const filters: FilterRule[] = [
    { column: "Status", operator: "equals", value: ["Todo"] },
    { column: "Notes", operator: "contains", value: ["work"] },
  ];
  const view: ViewDef = { name: "Filtered", sorts: [], filters, hiddenColumns: [] };
  const model: DatabaseModel = {
    columns,
    rows: [],
    views: [view],
    formatVersion: 1,
  };

  const emptyRow = columns.map(() => "");
  for (const { colIdx, value } of getFilterPrefillValues(filters, columns)) {
    emptyRow[colIdx] = value;
  }
  const withNewRow: DatabaseModel = { ...model, rows: [emptyRow] };

  assert.equal(runQuery(model, view).length, 0);
  assert.equal(runQuery(withNewRow, view).length, 1);
});
