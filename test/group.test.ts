import assert from "node:assert/strict";
import { test } from "node:test";
import { groupRowsBySelect } from "../src/query/group.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types";

const columns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Status", type: "select", options: [
    { value: "Todo", color: "red" },
    { value: "Done", color: "green" },
  ]},
];

function row(vals: string[], originalIndex: number) {
  return resolveRow(buildRow(vals, originalIndex), columns);
}

test("groups in option order, then a trailing 'No value' group", () => {
  const rows = [
    row(["A", "Done"], 0),
    row(["B", "Todo"], 1),
    row(["C", ""], 2),
  ];
  const groups = groupRowsBySelect(rows, columns, "Status");
  assert.deepEqual(groups.map((g) => g.groupValue), ["Todo", "Done", ""]);
  assert.equal(groups[0].option?.value, "Todo");
  assert.equal(groups[0].rows.length, 1);
  assert.equal(groups[0].rows[0].originalIndex, 1);
  assert.equal(groups[2].groupValue, "");
  assert.equal(groups[2].rows[0].originalIndex, 2);
});

test("orphaned values (in data, not options) fall into the 'No value' group", () => {
  const rows = [row(["X", "Archived"], 0)];
  const groups = groupRowsBySelect(rows, columns, "Status");
  assert.equal(groups.length, 3); // Todo, Done, "" group
  assert.equal(groups[2].rows[0].originalIndex, 0);
});

test("returns empty array when groupByColumn missing or not a select or not present", () => {
  assert.deepEqual(groupRowsBySelect(row([], 0) ? [row(["A", "Todo"], 0)] : [], columns, undefined), []);
  assert.deepEqual(groupRowsBySelect([row(["A", "Todo"], 0)], columns, "Name"), []);
  assert.deepEqual(groupRowsBySelect([row(["A", "Todo"], 0)], columns, "Nonexistent"), []);
});

test("single empty group omitted when no rows are ungrouped", () => {
  const rows = [row(["A", "Todo"], 0), row(["B", "Done"], 1)];
  const groups = groupRowsBySelect(rows, columns, "Status");
  assert.deepEqual(groups.map((g) => g.groupValue), ["Todo", "Done"]);
});
