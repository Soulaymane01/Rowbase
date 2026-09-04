import { ColumnDef } from "../types";
import { QueryResultRow } from "./record";

export interface HabitInfo {
  colName: string;
  colIdx: number;
  type: "checkbox" | "select";
  doneValues: string[];
  currentStreak: number;
  bestStreak: number;
  totalDone: number;
  totalRows: number;
  completionRate: number;
}

export interface DayActivity {
  date: string;
  count: number;
}

export interface DashboardData {
  totalRows: number;
  habits: HabitInfo[];
  dateActivity: DayActivity[];
  dateRange: { start: string; end: string } | null;
}

export function detectHabitColumns(columns: ColumnDef[]): { col: ColumnDef; idx: number }[] {
  const habits: { col: ColumnDef; idx: number }[] = [];
  for (let i = 0; i < columns.length; i++) {
    const c = columns[i];
    if (c.type === "checkbox") {
      habits.push({ col: c, idx: i });
    } else if (c.type === "select" && c.options && c.options.length <= 6) {
      const lowerOpts = c.options.map((o) => o.value.toLowerCase());
      const hasDone = lowerOpts.some((v) => /^(done|completed|yes|true|✓|x|1)$/.test(v));
      if (hasDone) habits.push({ col: c, idx: i });
    }
  }
  return habits;
}

export function computeStreak(values: string[], doneValues: string[]): { current: number; best: number } {
  const doneSet = new Set(doneValues.map((v) => v.toLowerCase()));
  let current = 0;
  let best = 0;
  let run = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const v = (values[i] || "").toLowerCase();
    if (doneSet.has(v)) {
      if (i === values.length - 1 || current > 0) { current++; run = current; }
      else { run++; }
    } else {
      if (current === 0) run = 0;
    }
  }
  // Compute best streak forward
  run = 0;
  for (const v of values) {
    if (doneSet.has((v || "").toLowerCase())) { run++; best = Math.max(best, run); }
    else { run = 0; }
  }
  // Current streak: from end, consecutive done
  current = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (doneSet.has((values[i] || "").toLowerCase())) current++;
    else break;
  }
  return { current, best };
}

export function buildDateActivity(rows: QueryResultRow[], dateIdx: number): DayActivity[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const raw = r.row[dateIdx];
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildDashboardData(rows: QueryResultRow[], columns: ColumnDef[]): DashboardData {
  const habits: HabitInfo[] = [];
  const habitCols = detectHabitColumns(columns);

  for (const { col, idx } of habitCols) {
    const values = rows.map((r) => r.row[idx] || "");
    const doneValues = col.type === "checkbox"
      ? ["true", "yes", "1", "✓", "x"]
      : (col.options || []).filter((o) => /^(done|completed|yes|true|✓|x|1)$/i.test(o.value)).map((o) => o.value);
    // If no explicit "done" values found for select, use all non-empty as done
    const effectiveDone = doneValues.length > 0 ? doneValues : ["*"];
    const finalDone = effectiveDone.includes("*")
      ? [...new Set(values.filter((v) => v !== ""))]
      : effectiveDone;

    const { current, best } = computeStreak(values, finalDone);
    const totalDone = values.filter((v) => finalDone.some((d) => d.toLowerCase() === (v || "").toLowerCase())).length;

    habits.push({
      colName: col.name,
      colIdx: idx,
      type: col.type === "checkbox" ? "checkbox" : "select",
      doneValues: finalDone,
      currentStreak: current,
      bestStreak: best,
      totalDone,
      totalRows: rows.length,
      completionRate: rows.length > 0 ? totalDone / rows.length : 0,
    });
  }

  // Date activity
  const dateCols = columns.map((c, i) => ({ c, i })).filter(({ c }) => c.type === "date");
  let dateActivity: DayActivity[] = [];
  if (dateCols.length > 0) {
    dateActivity = buildDateActivity(rows, dateCols[0].i);
  }

  const dateRange = dateActivity.length > 0
    ? { start: dateActivity[0].date, end: dateActivity[dateActivity.length - 1].date }
    : null;

  return { totalRows: rows.length, habits, dateActivity, dateRange };
}
