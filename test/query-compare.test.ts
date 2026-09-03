import assert from "node:assert/strict";
import { test } from "node:test";
import { compareValues } from "../src/query/compare.ts";
import { resolveValue } from "../src/query/resolve.ts";

function col(overrides: Partial<import("../src/types").ColumnDef>): import("../src/types").ColumnDef {
  return { name: "c", type: "text", ...overrides };
}

test("compares numbers numerically", () => {
  const c = col({ type: "number" });
  assert.equal(compareValues(resolveValue("5", "number"), resolveValue("10", "number"), c) < 0, true);
});

test("orders empty last", () => {
  const c = col({ type: "text" });
  assert.equal(compareValues({ kind: "empty" }, resolveValue("a", "text"), c) > 0, true);
});

test("uses select option order", () => {
  const c = col({ type: "select", options: [{ value: "Done", color: "green" }, { value: "Todo", color: "red" }] });
  assert.equal(compareValues(resolveValue("Done", "select"), resolveValue("Todo", "select"), c) < 0, true);
});

test("compares text case-insensitively", () => {
  const c = col({ type: "text" });
  assert.equal(compareValues(resolveValue("b", "text"), resolveValue("A", "text"), c) > 0, true);
});
