import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateFormula, FormulaEnv, FormulaValue } from "../src/query/formula.ts";

function env(values: Record<string, FormulaValue>, related: Record<string, number[]> = {}): FormulaEnv {
  return {
    getColumn: (name) => values[name] ?? null,
    getRelatedNumbers: (rel, val) => related[`${rel}\u0000${val}`] ?? [],
  };
}

test("numeric arithmetic", () => {
  const r = evaluateFormula("price * quantity", env({ price: 4, quantity: 3 }));
  assert.deepEqual(r, { kind: "number", value: 12 });
});

test("precedence and parentheses", () => {
  const r = evaluateFormula("2 + 3 * 4", env({}));
  assert.deepEqual(r, { kind: "number", value: 14 });
  const r2 = evaluateFormula("(2 + 3) * 4", env({}));
  assert.deepEqual(r2, { kind: "number", value: 20 });
});

test("division operator", () => {
  assert.deepEqual(evaluateFormula("6 / 2", env({})), { kind: "number", value: 3 });
  assert.deepEqual(evaluateFormula("10 / 4", env({})), { kind: "number", value: 2.5 });
  assert.deepEqual(evaluateFormula("1 + 2 / 2", env({})), { kind: "number", value: 2 });
  assert.deepEqual(evaluateFormula("(a / b) * 3", env({ a: 9, b: 3 })), { kind: "number", value: 9 });
});

test("division without spaces around the operator", () => {
  assert.deepEqual(evaluateFormula("a/b", env({ a: 8, b: 2 })), { kind: "number", value: 4 });
  assert.deepEqual(evaluateFormula("100/5", env({})), { kind: "number", value: 20 });
});

test("division by zero produces error", () => {
  const r = evaluateFormula("10 / (2 - 2)", env({}));
  assert.equal(r.kind, "error");
});

test("comparison and IF conditional", () => {
  const r = evaluateFormula('IF(score >= 90, "A", "B")', env({ score: 95 }));
  assert.deepEqual(r, { kind: "string", value: "A" });
});

test("IF only evaluates the taken branch", () => {
  // The untaken branch would throw (division by zero / invalid DAYS).
  assert.deepEqual(evaluateFormula('IF(Done, "yes", 1 / 0)', env({ Done: "x" })), { kind: "string", value: "yes" });
  assert.deepEqual(evaluateFormula('IF(Done, 1 / 0, "no")', env({ Done: "" })), { kind: "string", value: "no" });
  assert.deepEqual(
    evaluateFormula('IF(Done, DAYS(Scheduled, Done), "")', env({ Scheduled: "2026-09-10", Done: "" })),
    { kind: "string", value: "" }
  );
});

test("string concatenation with &", () => {
  const r = evaluateFormula('first & " " & last', env({ first: "Ada", last: "Lovelace" }));
  assert.deepEqual(r, { kind: "string", value: "Ada Lovelace" });
});

test("DAYS between two date columns (ISO strings)", () => {
  const r = evaluateFormula("DAYS(Scheduled, Done)", env({ Scheduled: "2026-09-10T00:00:00.000Z", Done: "2026-09-17T00:00:00.000Z" }));
  assert.deepEqual(r, { kind: "number", value: 7 });
});

test("DAYS same day is zero", () => {
  const r = evaluateFormula('DAYS("2026-09-13", "2026-09-13")', env({}));
  assert.deepEqual(r, { kind: "number", value: 0 });
});

test("DAYS reversed order gives negative days", () => {
  const r = evaluateFormula('DAYS("2026-09-20", "2026-09-13")', env({}));
  assert.deepEqual(r, { kind: "number", value: -7 });
});

test("DAYS accepts bare YYYY-MM-DD strings", () => {
  const r = evaluateFormula('DAYS("2026-09-01", "2026-09-08")', env({}));
  assert.deepEqual(r, { kind: "number", value: 7 });
});

test("DAYS with a missing/invalid date produces error", () => {
  const r = evaluateFormula('DAYS(Scheduled, "not-a-date")', env({ Scheduled: "2026-09-10T00:00:00.000Z" }));
  assert.equal(r.kind, "error");
  const r2 = evaluateFormula("DAYS(Scheduled)", env({ Scheduled: "2026-09-10T00:00:00.000Z" }));
  assert.equal(r2.kind, "error");
});

test("DAYS composes inside arithmetic", () => {
  const r = evaluateFormula("DAYS(Done, Due) * 2", env({ Done: "2026-09-10T00:00:00.000Z", Due: "2026-09-13T00:00:00.000Z" }));
  assert.deepEqual(r, { kind: "number", value: 6 });
});

test("aggregate functions over related rows", () => {
  const withRel = env({}, { "items\u0000amount": [10, 20, 30] });
  const r = evaluateFormula("SUM(items.amount)", withRel);
  assert.deepEqual(r, { kind: "number", value: 60 });
  const avg = evaluateFormula("AVG(items.amount)", withRel);
  assert.deepEqual(avg, { kind: "number", value: 20 });
});

test("unknown column is null (not an error) and unknown function errors", () => {
  assert.deepEqual(evaluateFormula("missing", env({})), { kind: "number", value: 0 });
  const bad = evaluateFormula("NOPE(x)", env({ x: 1 }));
  assert.equal(bad.kind, "error");
});

test("malformed expression errors", () => {
  const r = evaluateFormula("2 + ", env({}));
  assert.equal(r.kind, "error");
});
