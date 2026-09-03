import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue } from "../src/query/resolve.ts";

test("resolves numbers", () => {
  const v = resolveValue("42", "number" as const);
  assert.equal(v.kind, "number");
  if (v.kind === "number") assert.equal(v.number, 42);
});

test("resolves empty number as empty", () => {
  assert.equal(resolveValue("", "number" as const).kind, "empty");
  assert.equal(resolveValue("abc", "number" as const).kind, "empty");
});

test("resolves dates", () => {
  const v = resolveValue("2024-05-01", "date" as const);
  assert.equal(v.kind, "date");
});

test("resolves multi-select via split", () => {
  const v = resolveValue("a|b", "multiselect" as const);
  assert.equal(v.kind, "multi");
  if (v.kind === "multi") assert.deepEqual(v.multi, ["a", "b"]);
});

test("resolves text and empty", () => {
  assert.equal(resolveValue("hello", "text" as const).kind, "text");
  assert.equal(resolveValue("", "text" as const).kind, "empty");
});
