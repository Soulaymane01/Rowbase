import assert from "node:assert/strict";
import { test } from "node:test";
import { computeRollup } from "../src/query/rollup.ts";
import { runQuery, RelationResolver } from "../src/query/index.ts";
import { splitMultiSelect } from "../src/csv-parser.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef, DatabaseModel, ViewDef } from "../src/types.ts";

// --- computeRollup unit tests ---

function relRows(vals: string[][]): { row: string[] }[] {
  return vals.map((row) => ({ row }));
}

test("rollup count", () => {
  const rows = relRows([["10"], ["20"], ["30"]]);
  assert.equal(computeRollup(rows, 0, undefined, "count"), 3);
});

test("rollup sum", () => {
  const rows = relRows([["10"], ["20"], ["30"]]);
  assert.equal(computeRollup(rows, 0, undefined, "sum"), 60);
});

test("rollup avg", () => {
  const rows = relRows([["10"], ["20"], ["30"]]);
  assert.equal(computeRollup(rows, 0, undefined, "avg"), 20);
});

test("rollup min", () => {
  const rows = relRows([["30"], ["10"], ["20"]]);
  assert.equal(computeRollup(rows, 0, undefined, "min"), 10);
});

test("rollup max", () => {
  const rows = relRows([["10"], ["30"], ["20"]]);
  assert.equal(computeRollup(rows, 0, undefined, "max"), 30);
});

test("rollup list", () => {
  const rows = relRows([["10"], ["20"], ["30"]]);
  assert.equal(computeRollup(rows, 0, undefined, "list"), "10, 20, 30");
});

test("rollup with filter", () => {
  const rows = relRows([["10", "Done"], ["20", "Todo"], ["30", "Done"]]);
  assert.equal(computeRollup(rows, 0, { index: 1, equals: "Done" }, "sum"), 40);
  assert.equal(computeRollup(rows, 0, { index: 1, equals: "Done" }, "count"), 2);
});

test("rollup skips empty/non-numeric for sum", () => {
  const rows = relRows([["10"], [""], ["abc"], ["20"]]);
  assert.equal(computeRollup(rows, 0, undefined, "sum"), 30);
});

test("rollup count includes all rows", () => {
  const rows = relRows([["10"], [""], ["abc"], ["20"]]);
  assert.equal(computeRollup(rows, 0, undefined, "count"), 4);
});

// --- runQuery with mock resolver ---

const targetColumns: ColumnDef[] = [
  { name: "Title", type: "title" },
  { name: "Amount", type: "number" },
  { name: "Status", type: "select", options: [{ value: "Done" }, { value: "Todo" }] },
];

const targetModel: DatabaseModel = {
  columns: targetColumns,
  rows: [
    ["Task A", "10", "Done"],
    ["Task B", "20", "Todo"],
    ["Task C", "30", "Done"],
  ],
  views: [],
  formatVersion: 1,
};

const sourceColumns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Tasks", type: "relation", relationTargetPath: "target.csvdb", relationMultiple: true },
  { name: "Total", type: "rollup", rollup: { relationColumn: "Tasks", targetColumn: "Amount", handler: "sum" } },
  { name: "TaskCount", type: "rollup", rollup: { relationColumn: "Tasks", targetColumn: "Amount", handler: "count" } },
];

const sourceModel: DatabaseModel = {
  columns: sourceColumns,
  rows: [
    ["Project 1", "Task A|Task B", "", ""],
    ["Project 2", "Task C", "", ""],
  ],
  views: [],
  formatVersion: 1,
};

function makeResolver(): RelationResolver {
  return (opts) => {
    if (opts.targetPath === "target.csvdb") {
      const allRows = targetModel.rows.map((r) => ({ row: r }));
      if (opts.value) {
        const keys = new Set(splitMultiSelect(opts.value));
        return { rows: allRows.filter((r) => keys.has(r.row[0])), columns: targetModel.columns };
      }
      return { rows: allRows, columns: targetModel.columns };
    }
    return { rows: [], columns: [] };
  };
}

const dummyView: ViewDef = { name: "Test", sorts: [], filters: [], hiddenColumns: [] };

test("runQuery rollup sum across relation", () => {
  const rows = runQuery(sourceModel, dummyView, makeResolver());
  // Project 1 has Task A (10) + Task B (20) = 30
  const p1 = rows.find((r) => r.row[0] === "Project 1")!;
  assert.equal(p1.computed?.[2], "30"); // Total column
});

test("runQuery rollup count across relation", () => {
  const rows = runQuery(sourceModel, dummyView, makeResolver());
  const p1 = rows.find((r) => r.row[0] === "Project 1")!;
  assert.equal(p1.computed?.[3], "2"); // TaskCount column
});

test("runQuery rollup sum single related row", () => {
  const rows = runQuery(sourceModel, dummyView, makeResolver());
  const p2 = rows.find((r) => r.row[0] === "Project 2")!;
  assert.equal(p2.computed?.[2], "30"); // Task C = 30
});

test("runQuery rollup without resolver returns empty", () => {
  const rows = runQuery(sourceModel, dummyView);
  const p1 = rows.find((r) => r.row[0] === "Project 1")!;
  assert.equal(p1.computed?.[2], undefined);
});

// --- Formula with relations ---

const formulaColumns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Tasks", type: "relation", relationTargetPath: "target.csvdb", relationMultiple: true },
  { name: "AvgAmount", type: "formula", formula: "AVG(Tasks.Amount)" },
];

const formulaModel: DatabaseModel = {
  columns: formulaColumns,
  rows: [
    ["Project 1", "Task A|Task B", ""],
  ],
  views: [],
  formatVersion: 1,
};

test("runQuery formula AVG across relation", () => {
  const rows = runQuery(formulaModel, dummyView, makeResolver());
  const p1 = rows.find((r) => r.row[0] === "Project 1")!;
  // AVG(10, 20) = 15
  assert.equal(p1.computed?.[2], "15");
});

test("runQuery formula SUM across relation", () => {
  const sumColumns: ColumnDef[] = [
    { name: "Name", type: "text" },
    { name: "Tasks", type: "relation", relationTargetPath: "target.csvdb", relationMultiple: true },
    { name: "Total", type: "formula", formula: "SUM(Tasks.Amount)" },
  ];
  const sumModel: DatabaseModel = {
    columns: sumColumns,
    rows: [["Project 1", "Task A|Task B", ""]],
    views: [],
    formatVersion: 1,
  };
  const rows = runQuery(sumModel, dummyView, makeResolver());
  const p1 = rows.find((r) => r.row[0] === "Project 1")!;
  assert.equal(p1.computed?.[2], "30");
});
