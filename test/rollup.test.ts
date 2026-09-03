import assert from "node:assert/strict";
import { test } from "node:test";
import { computeRollup } from "../src/query/rollup.ts";

// Each related row is { row: ["category", "amount"], } and we target index 1 (amount).
const foodRows = [
  { row: ["Food", "10"] },
  { row: ["Food", "20"] },
  { row: ["Travel", "30"] },
  { row: ["Food", ""] },
];

test("sum over target index skips empty", () => {
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "sum"), 60);
});

test("count counts related rows", () => {
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "count"), 4);
});

test("avg skips empty", () => {
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "avg"), 20);
});

test("min / max / list", () => {
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "min"), 10);
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "max"), 30);
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "list"), "10, 20, 30");
});

test("filter narrows to matching rows", () => {
  const filter = { index: 0, equals: "Food" };
  assert.equal(computeRollup(foodRows as any, 1, filter as any, "sum"), 30); // 10 + 20, Travel(30) excluded
});

test("empty related set returns null for numeric, empty string for list", () => {
  assert.equal(computeRollup([], 1, undefined as any, "sum"), null);
  assert.equal(computeRollup([], 1, undefined as any, "list"), "");
});
