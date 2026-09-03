import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesFilter } from "../src/query/filter.ts";
import { resolveValue } from "../src/query/resolve.ts";
import { ColumnDef } from "../src/types";

function col(type: ColumnDef["type"], opts?: ColumnDef["options"]): ColumnDef {
  return { name: "c", type, options: opts };
}

test("equals text", () => {
  assert.equal(matchesFilter(resolveValue("abc", "text"), col("text"), "equals", ["abc"]), true);
  assert.equal(matchesFilter(resolveValue("abc", "text"), col("text"), "equals", ["xyz"]), false);
});

test("contains and does-not-contain (case-insensitive substring)", () => {
  assert.equal(matchesFilter(resolveValue("HelloWorld", "text"), col("text"), "contains", ["world"]), true);
  assert.equal(matchesFilter(resolveValue("HelloWorld", "text"), col("text"), "does-not-contain", ["world"]), false);
});

test("starts-with", () => {
  assert.equal(matchesFilter(resolveValue("foo-bar", "text"), col("text"), "starts-with", ["foo"]), true);
  assert.equal(matchesFilter(resolveValue("xfoo", "text"), col("text"), "starts-with", ["foo"]), false);
});

test("is-empty / is-not-empty", () => {
  assert.equal(matchesFilter({ kind: "empty" }, col("text"), "is-empty", []), true);
  assert.equal(matchesFilter(resolveValue("a", "text"), col("text"), "is-not-empty", []), true);
});

test("greater-than / less-than / between for numbers", () => {
  assert.equal(matchesFilter(resolveValue("5", "number"), col("number"), "greater-than", ["3"]), true);
  assert.equal(matchesFilter(resolveValue("5", "number"), col("number"), "less-than", ["3"]), false);
  assert.equal(matchesFilter(resolveValue("5", "number"), col("number"), "between", ["3", "10"]), true);
  assert.equal(matchesFilter(resolveValue("20", "number"), col("number"), "between", ["3", "10"]), false);
});

test("before / after / between for dates", () => {
  assert.equal(matchesFilter(resolveValue("2024-05-01", "date"), col("date"), "before", ["2024-06-01"]), true);
  assert.equal(matchesFilter(resolveValue("2024-05-01", "date"), col("date"), "after", ["2024-04-01"]), true);
  assert.equal(matchesFilter(resolveValue("2024-05-01", "date"), col("date"), "between", ["2024-04-01", "2024-06-01"]), true);
  assert.equal(matchesFilter(resolveValue("2024-07-01", "date"), col("date"), "between", ["2024-04-01", "2024-06-01"]), false);
});

test("multi-select contains requires no matching value for does-not-contain", () => {
  assert.equal(matchesFilter(resolveValue("a|b", "multiselect"), col("multiselect"), "contains", ["b"]), true);
  assert.equal(matchesFilter(resolveValue("a|b", "multiselect"), col("multiselect"), "does-not-contain", ["b"]), false);
  assert.equal(matchesFilter(resolveValue("a|b", "multiselect"), col("multiselect"), "does-not-contain", ["z"]), true);
});

test("empty cell fails closed on non-empty operators", () => {
  assert.equal(matchesFilter({ kind: "empty" }, col("text"), "contains", ["a"]), false);
});
