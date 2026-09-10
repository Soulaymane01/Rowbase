import assert from "node:assert/strict";
import { test } from "node:test";
import { detectHabitColumns, computeStreak, buildDateActivity, buildDashboardData, summarizeActivity } from "../src/query/dashboard.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types.ts";

const columns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Exercise", type: "select", options: [{ value: "Done", color: "green" }, { value: "Skip", color: "red" }] },
  { name: "Read", type: "checkbox" },
  { name: "Created", type: "date" },
  { name: "Amount", type: "number" },
];
function row(vals: string[], i: number) { return resolveRow(buildRow(vals, i), columns); }

test("detectHabitColumns finds select with done option", () => {
  const habits = detectHabitColumns(columns);
  assert.ok(habits.some((h) => h.col.name === "Exercise"));
});

test("detectHabitColumns finds checkbox", () => {
  const habits = detectHabitColumns(columns);
  assert.ok(habits.some((h) => h.col.name === "Read"));
});

test("detectHabitColumns ignores text/number/date", () => {
  const habits = detectHabitColumns(columns);
  assert.ok(!habits.some((h) => h.col.name === "Name"));
  assert.ok(!habits.some((h) => h.col.name === "Amount"));
  assert.ok(!habits.some((h) => h.col.name === "Created"));
});

test("computeStreak — current streak from end", () => {
  const { current, best } = computeStreak(["Done","Done","Skip","Done","Done"], ["Done"]);
  assert.equal(current, 2);
  assert.equal(best, 2);
});

test("computeStreak — all done", () => {
  const { current, best } = computeStreak(["Done","Done","Done"], ["Done"]);
  assert.equal(current, 3);
  assert.equal(best, 3);
});

test("computeStreak — best longer than current", () => {
  const { current, best } = computeStreak(["Done","Done","Done","Skip","Done"], ["Done"]);
  assert.equal(current, 1);
  assert.equal(best, 3);
});

test("computeStreak — empty values", () => {
  const { current, best } = computeStreak([], ["Done"]);
  assert.equal(current, 0);
  assert.equal(best, 0);
});

test("computeStreak — none done", () => {
  const { current, best } = computeStreak(["Skip","Skip","Skip"], ["Done"]);
  assert.equal(current, 0);
  assert.equal(best, 0);
});

test("buildDateActivity groups by day", () => {
  const data = buildDateActivity([
    row(["A","Done","true","2024-01-10","10"],0),
    row(["B","Done","true","2024-01-10","20"],1),
    row(["C","Skip","false","2024-01-11","30"],2),
  ], 3); // Created column index = 3
  assert.equal(data.length, 2);
  assert.equal(data[0].date, "2024-01-10");
  assert.equal(data[0].count, 2);
  assert.equal(data[1].date, "2024-01-11");
  assert.equal(data[1].count, 1);
});

test("buildDashboardData full integration", () => {
  const rows = [
    row(["A","Done","true","2024-01-10","10"],0),
    row(["B","Skip","false","2024-01-11","20"],1),
    row(["C","Done","true","2024-01-12","30"],2),
  ];
  const data = buildDashboardData(rows, columns);
  assert.equal(data.totalRows, 3);
  assert.ok(data.habits.length >= 2);
  const exercise = data.habits.find((h) => h.colName === "Exercise")!;
  assert.equal(exercise.totalDone, 2);
  assert.equal(exercise.totalRows, 3);
  assert.ok(data.dateActivity.length >= 1);
  assert.ok(data.dateRange !== null);
});

test("habit recent rate and last-7 strip", () => {
  const rows = [
    row(["A","Done","true","2024-01-01","1"],0),
    row(["B","Skip","false","2024-01-02","1"],1),
    row(["C","Done","true","2024-01-03","1"],2),
    row(["D","Done","true","2024-01-04","1"],3),
  ];
  const data = buildDashboardData(rows, columns);
  const exercise = data.habits.find((h) => h.colName === "Exercise")!;
  assert.deepEqual(exercise.last7, [true, false, true, true]);
  assert.equal(exercise.recentRate, 0.75);
});

test("today's row resolution falls back to the latest row", () => {
  const rows = [
    row(["A","Done","true","2024-01-01","1"],0),
    row(["B","Skip","false","2024-01-02","1"],1),
  ];
  const data = buildDashboardData(rows, columns);
  assert.equal(data.todayRowIndex, 1);
  assert.equal(data.todayLabel, "latest row");
});

test("summarizeActivity computes totals, best day and current streak", () => {
  const activity = [
    { date: "2024-01-01", count: 2 },
    { date: "2024-01-02", count: 5 },
    { date: "2024-01-04", count: 1 },
  ];
  const summary = summarizeActivity(activity, "2024-01-04");
  assert.equal(summary.total, 8);
  assert.equal(summary.activeDays, 3);
  assert.equal(summary.bestDay?.date, "2024-01-02");
  assert.equal(summary.bestDay?.count, 5);
  assert.equal(summary.maxCount, 5);
  // Streak counts 01-04 then 01-03 (absent → stops); 01-02 not counted.
  assert.equal(summary.currentStreak, 1);
});

test("summarizeActivity current streak across consecutive days", () => {
  const activity = [
    { date: "2024-02-08", count: 1 },
    { date: "2024-02-09", count: 1 },
    { date: "2024-02-10", count: 3 },
  ];
  const summary = summarizeActivity(activity, "2024-02-10");
  assert.equal(summary.currentStreak, 3);
});
