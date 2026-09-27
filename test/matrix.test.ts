import assert from "node:assert/strict";
import { test } from "node:test";
import { getMatrixAxisValue, getMatrixQuadrant, isMatrixImportant, isMatrixUrgent } from "../src/query/matrix.ts";
import { ColumnDef } from "../src/types.ts";

const selectCol: ColumnDef = {
  name: "Priority",
  type: "select",
  options: [
    { value: "High", color: "red" },
    { value: "Low", color: "gray" },
  ],
};

const checkboxCol: ColumnDef = { name: "Important", type: "checkbox" };
const dateCol: ColumnDef = { name: "Due", type: "date" };

test("select axis: explicit high value", () => {
  assert.equal(isMatrixImportant("High", selectCol, "High"), true);
  assert.equal(isMatrixImportant("Low", selectCol, "High"), false);
  assert.equal(isMatrixImportant("", selectCol, "High"), false);
});

test("select axis: falls back to hint words", () => {
  assert.equal(isMatrixImportant("High", selectCol), true);
  assert.equal(isMatrixImportant("critical", selectCol), true);
  assert.equal(isMatrixImportant("Low", selectCol), false);
});

test("checkbox axis", () => {
  assert.equal(isMatrixImportant("true", checkboxCol), true);
  assert.equal(isMatrixImportant("false", checkboxCol), false);
});

test("unsupported axis columns are never high", () => {
  const textCol: ColumnDef = { name: "Notes", type: "text" };
  assert.equal(isMatrixImportant("High", textCol), false);
  assert.equal(isMatrixUrgent("High", textCol), false);
});

test("date axis: overdue and within a week are urgent, later dates are not", () => {
  const now = Date.parse("2026-09-27T00:00:00.000Z");
  assert.equal(isMatrixUrgent("2026-09-20", dateCol, undefined, now), true); // overdue
  assert.equal(isMatrixUrgent("2026-09-27", dateCol, undefined, now), true); // today
  assert.equal(isMatrixUrgent("2026-10-04", dateCol, undefined, now), true); // +7 days
  assert.equal(isMatrixUrgent("2026-10-05", dateCol, undefined, now), false); // +8 days
  assert.equal(isMatrixUrgent("not-a-date", dateCol, undefined, now), false);
});

test("quadrant assignment", () => {
  assert.equal(getMatrixQuadrant(true, true), "q1");
  assert.equal(getMatrixQuadrant(true, false), "q2");
  assert.equal(getMatrixQuadrant(false, true), "q3");
  assert.equal(getMatrixQuadrant(false, false), "q4");
});

test("axis value for checkbox columns", () => {
  assert.equal(getMatrixAxisValue(checkboxCol, true), "true");
  assert.equal(getMatrixAxisValue(checkboxCol, false), "false");
});

test("axis value for select columns uses the configured high value", () => {
  assert.equal(getMatrixAxisValue(selectCol, true, "High"), "High");
  assert.equal(getMatrixAxisValue(selectCol, false, "High"), "Low");
});

test("axis value for select columns guesses the high option from hints", () => {
  assert.equal(getMatrixAxisValue(selectCol, true), "High");
  assert.equal(getMatrixAxisValue(selectCol, false), "Low");
});

test("axis value is null for columns that can't express the axis", () => {
  assert.equal(getMatrixAxisValue(dateCol, true), null);
  assert.equal(getMatrixAxisValue(undefined, true), null);
});

test("single-option select clears to move out of high", () => {
  const only: ColumnDef = { name: "P", type: "select", options: [{ value: "High" }] };
  assert.equal(getMatrixAxisValue(only, true), "High");
  assert.equal(getMatrixAxisValue(only, false), "");
});
