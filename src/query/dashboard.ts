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
  recentRate: number;
  last7: boolean[];
  isDoneToday: boolean;
}

export interface DayActivity {
  date: string;
  count: number;
}

export interface ActivitySummary {
  total: number;
  activeDays: number;
  bestDay: { date: string; count: number } | null;
  currentStreak: number;
  maxCount: number;
}

export interface DashboardData {
  totalRows: number;
  habits: HabitInfo[];
  dateActivity: DayActivity[];
  dateRange: { start: string; end: string } | null;
  activity: ActivitySummary;
  todayRowIndex: number | null;
  todayLabel: string;
  todayDoneCount: number;
}

const DAY_MS = 86400000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** UTC day key for a Date, matching the way date-only strings round-trip. */
export function dayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d);
}

/** The user's local calendar date (what "today" means to them). */
export function localTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

/** Current streak = trailing consecutive done entries; best = longest run. */
export function computeStreak(values: string[], doneValues: string[]): { current: number; best: number } {
  const doneSet = new Set(doneValues.map((v) => v.toLowerCase()));
  const isDone = (v: string) => doneSet.has((v || "").toLowerCase());

  let best = 0;
  let run = 0;
  for (const v of values) {
    if (isDone(v)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  let current = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (isDone(values[i])) current += 1;
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
    const key = dayKey(d);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function summarizeActivity(activity: DayActivity[], today: string = localTodayKey()): ActivitySummary {
  if (activity.length === 0) {
    return { total: 0, activeDays: 0, bestDay: null, currentStreak: 0, maxCount: 0 };
  }
  const byDate = new Map(activity.map((a) => [a.date, a.count]));
  const total = activity.reduce((s, a) => s + a.count, 0);
  const maxCount = Math.max(...activity.map((a) => a.count));
  let bestDay = activity[0];
  for (const a of activity) if (a.count > bestDay.count) bestDay = a;

  let currentStreak = 0;
  let cursor = keyToUtcMs(today);
  while (!Number.isNaN(cursor) && (byDate.get(dayKey(new Date(cursor))) ?? 0) > 0) {
    currentStreak += 1;
    cursor -= DAY_MS;
  }

  return { total, activeDays: activity.length, bestDay, currentStreak, maxCount };
}

export function buildDashboardData(rows: QueryResultRow[], columns: ColumnDef[]): DashboardData {
  const habits: HabitInfo[] = [];
  const habitCols = detectHabitColumns(columns);

  const dateCols = columns.map((c, i) => ({ c, i })).filter(({ c }) => c.type === "date");
  const dateIdx = dateCols.length > 0 ? dateCols[0].i : -1;

  // Resolve "today's" row: the row dated today, else the last row.
  const today = localTodayKey();
  let todayRowIndex: number | null = rows.length > 0 ? rows[rows.length - 1].originalIndex : null;
  let todayLabel = rows.length > 0 ? "latest row" : "";
  if (dateIdx !== -1) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const raw = rows[i].row[dateIdx];
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      if (dayKey(d) === today) {
        todayRowIndex = rows[i].originalIndex;
        todayLabel = today;
        break;
      }
    }
  }

  for (const { col, idx } of habitCols) {
    const values = rows.map((r) => r.row[idx] || "");
    const doneValues = col.type === "checkbox"
      ? ["true", "yes", "1", "✓", "x"]
      : (col.options || []).filter((o) => /^(done|completed|yes|true|✓|x|1)$/i.test(o.value)).map((o) => o.value);
    const effectiveDone = doneValues.length > 0 ? doneValues : ["*"];
    const finalDone = effectiveDone.includes("*")
      ? [...new Set(values.filter((v) => v !== ""))]
      : effectiveDone;

    const doneSet = new Set(finalDone.map((v) => v.toLowerCase()));
    const isDone = (v: string) => doneSet.has((v || "").toLowerCase());

    const { current, best } = computeStreak(values, finalDone);
    const totalDone = values.filter((v) => isDone(v)).length;
    const recent = values.slice(-30);
    const recentDone = recent.filter((v) => isDone(v)).length;
    const last7 = values.slice(-7).map((v) => isDone(v));
    const todayValue = todayRowIndex !== null ? (rows.find((r) => r.originalIndex === todayRowIndex)?.row[idx] ?? "") : "";

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
      recentRate: recent.length > 0 ? recentDone / recent.length : 0,
      last7,
      isDoneToday: isDone(todayValue),
    });
  }

  const dateActivity = dateIdx !== -1 ? buildDateActivity(rows, dateIdx) : [];
  const dateRange = dateActivity.length > 0
    ? { start: dateActivity[0].date, end: dateActivity[dateActivity.length - 1].date }
    : null;

  const activity = summarizeActivity(dateActivity, today);
  const todayDoneCount = habits.filter((h) => h.isDoneToday).length;

  return {
    totalRows: rows.length,
    habits,
    dateActivity,
    dateRange,
    activity,
    todayRowIndex,
    todayLabel,
    todayDoneCount,
  };
}
