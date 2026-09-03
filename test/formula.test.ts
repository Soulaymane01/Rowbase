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

test("division by zero produces error", () => {
  const r = evaluateFormula("10 / (2 - 2)", env({}));
  assert.equal(r.kind, "error");
});

test("comparison and IF conditional", () => {
  const r = evaluateFormula('IF(score >= 90, "A", "B")', env({ score: 95 }));
  assert.deepEqual(r, { kind: "string", value: "A" });
});

test("string concatenation with &", () => {
  const r = evaluateFormula('first & " " & last', env({ first: "Ada", last: "Lovelace" }));
  assert.deepEqual(r, { kind: "string", value: "Ada Lovelace" });
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
