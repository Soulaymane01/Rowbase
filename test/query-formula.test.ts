import assert from "node:assert/strict";
import { test } from "node:test";
import { runQuery, getDisplayValue } from "../src/query/index.ts";
import { parseCSV, serializeCSV } from "../src/csv-parser.ts";
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

test("DAYS works end-to-end from a serialized .rbase file", () => {
  const columns: ColumnDef[] = [
    { name: "Name", type: "text" },
    { name: "Scheduled", type: "date" },
    { name: "Done", type: "date" },
    { name: "Days", type: "formula", formula: "DAYS(Scheduled, Done)" },
    { name: "Slipped", type: "formula", formula: 'IF(Done, DAYS(Scheduled, Done), "")' },
  ];
  const csv = serializeCSV({
    columns,
    rows: [
      ["Task A", "2026-09-10", "2026-09-17", "", ""],
      ["Task B", "2026-09-01", "", "", ""],
    ],
    views: [{ name: "Default", sorts: [], filters: [], hiddenColumns: [] }],
    formatVersion: 1,
  });

  const parsed = parseCSV(csv);
  const out = runQuery(parsed, parsed.views[0]);

  assert.equal(out[0].computed?.[3], "7");
  assert.equal(out[0].computed?.[4], "7");
  // empty end date: DAYS errors, IF returns the empty string fallback
  assert.match(out[1].computed?.[3] ?? "", /^#ERROR/);
  assert.equal(out[1].computed?.[4], "");
});
