import { useCallback, useRef, useState } from "react";
import { ColumnDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildDashboardData, HabitInfo, DayActivity, dayKey, localTodayKey } from "../query/dashboard";

interface DashboardViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onCardClick: (idx: number) => void;
}

const GAP = 3;
const DAY_MS = 86400000;

function StreakRing({ rate, size = 48, label }: { rate: number; size?: number; label?: string }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * Math.min(Math.max(rate, 0), 1);
  return (
    <svg width={size} height={size} className="csv-db-dash-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--background-modifier-border)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--interactive-accent)" strokeWidth={4}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="csv-db-dash-ring-text">{label ?? `${Math.round(rate * 100)}%`}</text>
    </svg>
  );
}

function HabitCard({ habit, todayRowIndex, todayLabel, onSetCell }: {
  habit: HabitInfo;
  todayRowIndex: number | null;
  todayLabel: string;
  onSetCell: (r: number, c: number, v: string) => void;
}) {
  const handleToggle = () => {
    if (todayRowIndex === null) return;
    const next = habit.type === "checkbox"
      ? (habit.isDoneToday ? "false" : "true")
      : (habit.doneValues.length > 0 ? habit.doneValues[0] : "Done");
    onSetCell(todayRowIndex, habit.colIdx, habit.isDoneToday ? "" : next);
  };

  return (
    <div className={`csv-db-dash-habit-card${habit.isDoneToday ? " is-done" : ""}`}>
      <div className="csv-db-dash-habit-top">
        <StreakRing rate={habit.completionRate} />
        <div className="csv-db-dash-habit-info">
          <div className="csv-db-dash-habit-name" title={habit.colName}>{habit.colName}</div>
          <div className="csv-db-dash-habit-streak">
            <span className="csv-db-dash-streak-num">{habit.currentStreak}</span> day streak
          </div>
        </div>
      </div>

      <div className="csv-db-dash-habit-strip" title="Last 7 entries">
        {habit.last7.length === 0 && <span className="csv-db-dash-habit-strip-empty">No entries</span>}
        {habit.last7.map((done, i) => (
          <span key={i} className={`csv-db-dash-strip-cell${done ? " is-done" : ""}`} />
        ))}
      </div>

      <div className="csv-db-dash-habit-meta">
        <span title="Best streak">Best: {habit.bestStreak}</span>
        <span title="Done / total rows">Done: {habit.totalDone}/{habit.totalRows}</span>
        <span title="Last 30 entries">{Math.round(habit.recentRate * 100)}% recent</span>
      </div>

      <button
        className={`csv-db-dash-habit-toggle${habit.isDoneToday ? " is-done" : ""}`}
        onClick={handleToggle}
        disabled={todayRowIndex === null}
        title={todayRowIndex === null ? "No rows to mark" : `Toggle ${todayLabel}`}
      >
        {habit.isDoneToday ? "✓ Done" : "Mark done"}
      </button>
    </div>
  );
}

function ActivityGrid({ activity, dateRange, today }: { activity: DayActivity[]; dateRange: { start: string; end: string } | null; today: string }) {
  const observerRef = useRef<ResizeObserver | null>(null);
  const [width, setWidth] = useState(900);

  const setRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const update = () => setWidth(Math.max(240, el.clientWidth));
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      observerRef.current = ro;
    }
  }, []);

  if (!dateRange || activity.length === 0) {
    return (
      <div className="csv-db-empty">
        <div className="csv-db-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
        </div>
        <div className="csv-db-empty-title">No activity yet</div>
        <div className="csv-db-empty-desc">Add dated rows to see your activity calendar.</div>
      </div>
    );
  }

  const parseKey = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };

  const endKey = dateRange.end > today ? dateRange.end : today;
  const endMs = parseKey(endKey);
  let startMs = Math.min(parseKey(dateRange.start), endMs);
  if (endMs - startMs > 52 * 7 * DAY_MS) startMs = endMs - 52 * 7 * DAY_MS;
  startMs -= new Date(startMs).getUTCDay() * DAY_MS;

  const days: string[] = [];
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) days.push(dayKey(new Date(ms)));
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const countMap = new Map(activity.map((a) => [a.date, a.count]));
  const maxCount = Math.max(1, ...activity.map((a) => a.count));

  // Size cells to fill the available width (clamped so short ranges stay sane).
  const n = Math.max(1, weeks.length);
  const dayColWidth = 30;
  const cell = Math.max(9, Math.min(22, (width - dayColWidth - (n - 1) * GAP) / n));
  const gridW = n * cell + (n - 1) * GAP;
  const gridH = 7 * cell + 6 * GAP;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabels: { label: string; x: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const first = w[0];
    if (!first) return;
    const m = new Date(parseKey(first)).getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: months[m], x: wi * (cell + GAP) });
      lastMonth = m;
    }
  });

  return (
    <div className="csv-db-dash-calendar" ref={setRef}>
      <div className="csv-db-dash-calendar-inner">
        <div className="csv-db-dash-calendar-months" style={{ marginLeft: `${dayColWidth}px`, width: `${gridW}px` }}>
          {monthLabels.map((ml) => (
            <span key={`${ml.label}-${ml.x}`} style={{ left: ml.x }}>{ml.label}</span>
          ))}
        </div>
        <div className="csv-db-dash-calendar-grid">
          <div className="csv-db-dash-calendar-days" style={{ gap: `${GAP}px` }}>
            {["", "M", "", "W", "", "F", ""].map((d, i) => <span key={i} style={{ height: `${cell}px` }}>{d}</span>)}
          </div>
          <svg width={gridW} height={gridH} className="csv-db-dash-calendar-svg">
            {weeks.map((week, wi) =>
              week.map((key, di) => {
                const count = countMap.get(key) || 0;
                const future = key > today;
                const opacity = future ? 0.04 : count > 0 ? 0.25 + 0.75 * (count / maxCount) : 0.08;
                const isToday = key === today;
                return (
                  <rect
                    key={key}
                    x={wi * (cell + GAP)}
                    y={di * (cell + GAP)}
                    width={cell}
                    height={cell}
                    rx={Math.max(2, Math.round(cell * 0.22))}
                    fill={count > 0 ? "var(--interactive-accent)" : "var(--text-muted)"}
                    opacity={opacity}
                    className={`csv-db-dash-cal-cell${isToday ? " is-today" : ""}`}
                  >
                    <title>{`${key}: ${count}`}</title>
                  </rect>
                );
              })
            )}
          </svg>
        </div>
        <div className="csv-db-dash-legend">
          <span className="csv-db-dash-legend-label">Less</span>
          {[0.08, 0.3, 0.5, 0.7, 1].map((o) => (
            <span key={o} className="csv-db-dash-legend-cell" style={{ opacity: o }} />
          ))}
          <span className="csv-db-dash-legend-label">More</span>
        </div>
      </div>
    </div>
  );
}

export function DashboardView({ rows, columns, onSetCell }: DashboardViewProps) {
  const data = buildDashboardData(rows, columns);
  const today = localTodayKey();
  const hasAny = data.habits.length > 0 || data.dateActivity.length > 0;
  const overallRate = data.habits.length > 0
    ? data.habits.reduce((s, h) => s + h.completionRate, 0) / data.habits.length
    : 0;

  return (
    <div className="csv-db-dash">
      <div className="csv-db-dash-summary">
        <div className="csv-db-dash-summary-card">
          <span className="csv-db-dash-summary-value">{data.totalRows}</span>
          <span className="csv-db-dash-summary-label">Rows</span>
        </div>
        <div className="csv-db-dash-summary-card">
          <span className="csv-db-dash-summary-value">{data.habits.length}</span>
          <span className="csv-db-dash-summary-label">Habits</span>
        </div>
        {data.habits.length > 0 && (
          <>
            <div className="csv-db-dash-summary-card">
              <span className="csv-db-dash-summary-value">{Math.round(overallRate * 100)}%</span>
              <span className="csv-db-dash-summary-label">Avg completion</span>
            </div>
            <div className="csv-db-dash-summary-card">
              <span className="csv-db-dash-summary-value">{data.todayDoneCount}/{data.habits.length}</span>
              <span className="csv-db-dash-summary-label">Done today</span>
            </div>
          </>
        )}
        {data.dateActivity.length > 0 && (
          <>
            <div className="csv-db-dash-summary-card">
              <span className="csv-db-dash-summary-value">{data.activity.activeDays}</span>
              <span className="csv-db-dash-summary-label">Active days</span>
            </div>
            <div className="csv-db-dash-summary-card">
              <span className="csv-db-dash-summary-value">{data.activity.currentStreak}</span>
              <span className="csv-db-dash-summary-label">Activity streak</span>
            </div>
          </>
        )}
      </div>

      {data.habits.length > 0 && (
        <div className="csv-db-dash-habits-section">
          <h4>Habits</h4>
          <div className="csv-db-dash-habits-grid">
            {data.habits.map((h) => (
              <HabitCard
                key={h.colName}
                habit={h}
                todayRowIndex={data.todayRowIndex}
                todayLabel={data.todayLabel}
                onSetCell={onSetCell}
              />
            ))}
          </div>
        </div>
      )}

      {data.dateActivity.length > 0 && (
        <div className="csv-db-dash-calendar-section">
          <h4>
            Activity
            <span className="csv-db-dash-section-meta">
              {data.activity.total} entries
              {data.activity.bestDay ? ` · best ${data.activity.bestDay.count} on ${data.activity.bestDay.date}` : ""}
            </span>
          </h4>
          <ActivityGrid activity={data.dateActivity} dateRange={data.dateRange} today={today} />
        </div>
      )}

      {!hasAny && (
        <div className="csv-db-empty">
          <div className="csv-db-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div className="csv-db-empty-title">No dashboard data</div>
          <div className="csv-db-empty-desc">Add a Select, Checkbox, or Date column to see your dashboard.</div>
        </div>
      )}
    </div>
  );
}
