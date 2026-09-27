import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCSV, serializeCSV } from "../src/csv-parser.ts";
import { runQuery, RelationResolver } from "../src/query/index.ts";
import { getRelatedRows, normalizeVaultPath, resolveRelationPath } from "../src/query/relation.ts";
import { ColumnDef, DatabaseModel, ViewDef } from "../src/types.ts";

const dummyView: ViewDef = { name: "Default", sorts: [], filters: [], hiddenColumns: [] };

const tasksColumns: ColumnDef[] = [
  { name: "Title", type: "title" },
  { name: "Amount", type: "number" },
];

const tasksModel: DatabaseModel = {
  columns: tasksColumns,
  rows: [
    ["Task A", "10"],
    ["Task B", "20"],
  ],
  views: [],
  formatVersion: 1,
};

/**
 * Mirrors createRelationResolver: resolve the relative target against the
 * database's folder, look it up in the "vault", and return the linked rows.
 */
function buildVaultResolver(databasePath: string, files: Record<string, DatabaseModel>): RelationResolver {
  const models = new Map(Object.entries(files).map(([path, model]) => [normalizeVaultPath(path), model]));
  return (opts) => {
    const resolved = resolveRelationPath(opts.targetPath, databasePath);
    const model = models.get(resolved);
    if (!model) return { rows: [], columns: [] };
    return getRelatedRows(model, opts.value ?? "");
  };
}

function projectModel(targetPath: string): DatabaseModel {
  return {
    columns: [
      { name: "Name", type: "title" },
      { name: "Tasks", type: "relation", relationTargetPath: targetPath, relationMultiple: true },
      {
        name: "Total",
        type: "rollup",
        rollup: { relationColumn: "Tasks", targetColumn: "Amount", handler: "sum" },
      },
      {
        name: "TaskCount",
        type: "rollup",
        rollup: { relationColumn: "Tasks", targetColumn: "Amount", handler: "count" },
      },
    ],
    rows: [
      ["Project 1", "Task A|Task B", "", ""],
      ["Project 2", "", "", ""],
    ],
    views: [],
    formatVersion: 1,
  };
}

test("rollup resolves a target outside the database folder (../ path)", () => {
  const databasePath = "Databases/Projects.rbase";
  const source = parseCSV(serializeCSV(projectModel("../Tasks.rbase")));
  const resolver = buildVaultResolver(databasePath, { "../Tasks.rbase": parseCSV(serializeCSV(tasksModel)) });

  const out = runQuery(source, dummyView, resolver);
  const p1 = out.find((r) => r.row[0] === "Project 1")!;
  const p2 = out.find((r) => r.row[0] === "Project 2")!;

  assert.equal(p1.computed?.[2], "30");
  assert.equal(p1.computed?.[3], "2");
  // Empty relation must aggregate nothing, not the whole target table.
  assert.equal(p2.computed?.[2], "");
  assert.equal(p2.computed?.[3], "0");
});

test("rollup resolves a same-folder target", () => {
  const databasePath = "Databases/Projects.rbase";
  const source = parseCSV(serializeCSV(projectModel("Tasks.rbase")));
  const resolver = buildVaultResolver(databasePath, { "Databases/Tasks.rbase": parseCSV(serializeCSV(tasksModel)) });

  const out = runQuery(source, dummyView, resolver);
  assert.equal(out.find((r) => r.row[0] === "Project 1")!.computed?.[2], "30");
});

test("rollup resolves a vault-root target", () => {
  const databasePath = "Databases/Projects.rbase";
  const source = parseCSV(serializeCSV(projectModel("/Tasks.rbase")));
  const resolver = buildVaultResolver(databasePath, { "Tasks.rbase": parseCSV(serializeCSV(tasksModel)) });

  const out = runQuery(source, dummyView, resolver);
  assert.equal(out.find((r) => r.row[0] === "Project 1")!.computed?.[2], "30");
});

test("formula aggregates across a ../ relation too", () => {
  const databasePath = "Databases/Projects.rbase";
  const model: DatabaseModel = {
    columns: [
      { name: "Name", type: "title" },
      { name: "Tasks", type: "relation", relationTargetPath: "../Tasks.rbase", relationMultiple: true },
      { name: "Sum", type: "formula", formula: "SUM(Tasks.Amount)" },
    ],
    rows: [["Project 1", "Task A|Task B", ""]],
    views: [],
    formatVersion: 1,
  };
  const source = parseCSV(serializeCSV(model));
  const resolver = buildVaultResolver(databasePath, { "../Tasks.rbase": parseCSV(serializeCSV(tasksModel)) });

  const out = runQuery(source, dummyView, resolver);
  assert.equal(out[0].computed?.[2], "30");
});
