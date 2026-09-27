import assert from "node:assert/strict";
import { test } from "node:test";
import { getRelatedRows, normalizeVaultPath, resolveRelationPath } from "../src/query/relation.ts";
import { DatabaseModel } from "../src/types.ts";

test("normalizeVaultPath collapses . and .. segments", () => {
  assert.equal(normalizeVaultPath("a/./b/../c.rbase"), "a/c.rbase");
  assert.equal(normalizeVaultPath("a//b.rbase"), "a/b.rbase");
  assert.equal(normalizeVaultPath("../up.rbase"), "up.rbase");
});

test("resolveRelationPath resolves relative paths against the database folder", () => {
  assert.equal(resolveRelationPath("Tasks.rbase", "Databases/Projects.rbase"), "Databases/Tasks.rbase");
});

test("resolveRelationPath collapses parent traversal (the cross-folder case)", () => {
  assert.equal(resolveRelationPath("../Tasks.rbase", "Databases/Projects.rbase"), "Tasks.rbase");
  assert.equal(resolveRelationPath("../../Tasks.rbase", "a/b/c.rbase"), "Tasks.rbase");
  assert.equal(resolveRelationPath("sub/../Tasks.rbase", "Databases/Projects.rbase"), "Databases/Tasks.rbase");
});

test("resolveRelationPath supports vault-root paths and empty input", () => {
  assert.equal(resolveRelationPath("/Root.rbase", "Databases/Projects.rbase"), "Root.rbase");
  assert.equal(resolveRelationPath("", "Databases/Projects.rbase"), "");
  assert.equal(resolveRelationPath("   ", "Databases/Projects.rbase"), "");
});

const model: DatabaseModel = {
  columns: [
    { name: "Name", type: "title" },
    { name: "Amount", type: "number" },
  ],
  rows: [
    ["Task A", "10"],
    ["Task B", "20"],
    ["Task C", "30"],
  ],
  views: [],
  formatVersion: 1,
};

test("getRelatedRows matches titles, including pipe-joined values", () => {
  assert.deepEqual(getRelatedRows(model, "Task A").rows.map((r) => r.row[0]), ["Task A"]);
  assert.deepEqual(getRelatedRows(model, "Task A|Task C").rows.map((r) => r.row[0]), ["Task A", "Task C"]);
});

test("getRelatedRows returns no rows for empty or unknown values", () => {
  assert.equal(getRelatedRows(model, "").rows.length, 0);
  assert.equal(getRelatedRows(model, "Missing").rows.length, 0);
});

test("getRelatedRows returns nothing when the target has no title column", () => {
  const noTitle: DatabaseModel = {
    columns: [{ name: "Amount", type: "number" }],
    rows: [["10"]],
    views: [],
    formatVersion: 1,
  };
  assert.equal(getRelatedRows(noTitle, "10").rows.length, 0);
});
