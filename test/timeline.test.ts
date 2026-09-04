import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTimelineItems, findDateColumns, getTimelineBounds } from "../src/query/timeline.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types.ts";

const cols: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Start", type: "date" },
  { name: "End", type: "date" },
  { name: "Priority", type: "select" },
];
function r(vals: string[], i: number) { return resolveRow(buildRow(vals, i), cols); }

test("findDateColumns detects start/end", () => {
  const { startIdx, endIdx } = findDateColumns(cols);
  assert.equal(startIdx, 1);
  assert.equal(endIdx, 2);
});

test("items sorted by start date", () => {
  const items = buildTimelineItems(
    [r(["B", "2024-03-01", "2024-03-10"], 0), r(["A", "2024-01-01", "2024-01-05"], 1)],
    1, 2, 0,
  );
  assert.equal(items[0].label, "A");
  assert.equal(items[1].label, "B");
});

test("missing end defaults to today", () => {
  const items = buildTimelineItems([r(["X", "2024-06-01", ""], 0)], 1, 2, 0);
  assert.equal(items.length, 1);
  assert.ok(items[0].end.getTime() >= new Date("2024-06-01").getTime());
});

test("invalid start is skipped", () => {
  const items = buildTimelineItems([r(["X", "", "2024-01-01"], 0)], 1, 2, 0);
  assert.equal(items.length, 0);
});

test("end before start gets clamped", () => {
  const items = buildTimelineItems([r(["X", "2024-06-10", "2024-06-01"], 0)], 1, 2, 0);
  assert.ok(items[0].end.getTime() >= items[0].start.getTime());
});

test("getTimelineBounds pads range", () => {
  const items = buildTimelineItems(
    [r(["A", "2024-01-01", "2024-01-10"], 0)],
    1, 2, 0,
  );
  const b = getTimelineBounds(items);
  assert.ok(b.min < new Date("2024-01-01").getTime());
  assert.ok(b.max > new Date("2024-01-10").getTime());
});
