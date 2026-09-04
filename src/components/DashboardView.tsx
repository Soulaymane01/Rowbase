import { ColumnDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildDashboardData, HabitInfo, DayActivity } from "../query/dashboard";

interface DashboardViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onCardClick: (idx: number) => void;
}

const CELL = 14;
const GAP = 3;

function StreakRing({ rate, size = 48 }: { rate: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * Math.min(rate, 1);
  return (
    <svg width={size} height={size} className="csv-db-dash-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--background-modifier-border)" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--interactive-accent)" strokeWidth={4}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        className="csv-db-dash-ring-text">{Math.round(rate * 100)}%</text>
    </svg>
  );
}

function HabitCard({ habit, rows, columns, onSetCell }: { habit: HabitInfo; rows: QueryResultRow[]; columns: ColumnDef[]; onSetCell: (r: number, c: number, v: string) => void }) {
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
  const isDone = lastRow ? habit.doneValues.some((d) => d.toLowerCase() === ((lastRow.row[habit.colIdx] || "").toLowerCase())) : false;

  const handleToggle = () => {
    if (!lastRow) return;
    const next = habit.type === "checkbox"
      ? (isDone ? "false" : "true")
      : (habit.doneValues.length > 0 ? habit.doneValues[0] : "Done");
    onSetCell(lastRow.originalIndex, habit.colIdx, isDone ? "" : next);
  };

  return (
    <div className="csv-db-dash-habit-card">
      <div className="csv-db-dash-habit-top">
        <StreakRing rate={habit.completionRate} />
        <div className="csv-db-dash-habit-info">
          <div className="csv-db-dash-habit-name">{habit.colName}</div>
          <div className="csv-db-dash-habit-streak">
            <span className="csv-db-dash-streak-num">{habit.currentStreak}</span> day streak
          </div>
        </div>
      </div>
      <div className="csv-db-dash-habit-meta">
        <span>Best: {habit.bestStreak}</span>
        <span>Done: {habit.totalDone}/{habit.totalRows}</span>
      </div>
      <button className="csv-db-dash-habit-toggle" onClick={handleToggle}>
        {isDone ? "✓ Done today" : "Mark done"}
      </button>
    </div>
  );
}

function ActivityGrid({ activity, dateRange }: { activity: DayActivity[]; dateRange: { start: string; end: string } | null }) {
  if (!dateRange || activity.length === 0) return (
    <div className="csv-db-empty">
      <div className="csv-db-empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
      </div>
      <div className="csv-db-empty-title">No dashboard data</div>
      <div className="csv-db-empty-desc">Add a Select, Checkbox, or Date column to see your dashboard.</div>
    </div>
  );

  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  // Pad start to Sunday
  const padStart = new Date(start);
  padStart.setDate(padStart.getDate() - padStart.getDay());

  const weeks: Date[][] = [];
  const cur = new Date(padStart);
  while (cur <= end || weeks.length % 52 !== 0) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (weeks.length >= 52) break;
  }

  const countMap = new Map(activity.map((a) => [a.date, a.count]));
  const maxCount = Math.max(1, ...activity.map((a) => a.count));

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthLabels: { label: string; x: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const m = w[0].getMonth();
    if (m !== lastMonth) { monthLabels.push({ label: months[m], x: wi * (CELL + GAP) }); lastMonth = m; }
  });

  return (
    <div className="csv-db-dash-calendar">
      <div className="csv-db-dash-calendar-months">
        {monthLabels.map((ml) => (
          <span key={ml.label + ml.x} style={{ left: ml.x }}>{ml.label}</span>
        ))}
      </div>
      <div className="csv-db-dash-calendar-grid">
        <div className="csv-db-dash-calendar-days">
          {["","M","","W","","F",""].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <svg width={weeks.length * (CELL + GAP)} height={7 * (CELL + GAP)} className="csv-db-dash-calendar-svg">
          {weeks.map((week, wi) =>
            week.map((day, di) => {
              const key = day.toISOString().slice(0, 10);
              const count = countMap.get(key) || 0;
              const inRange = day >= start && day <= end;
              const opacity = inRange ? (count > 0 ? 0.2 + 0.8 * (count / maxCount) : 0.06) : 0;
              return (
                <rect key={key} x={wi * (CELL + GAP)} y={di * (CELL + GAP)}
                  width={CELL} height={CELL} rx={3}
                  fill={count > 0 ? "var(--interactive-accent)" : "var(--text-muted)"}
                  opacity={opacity} className="csv-db-dash-cal-cell">
                  <title>{`${key}: ${count}`}</title>
                </rect>
              );
            })
          )}
        </svg>
      </div>
    </div>
  );
}

export function DashboardView({ rows, columns, onSetCell, onCardClick }: DashboardViewProps) {
  const data = buildDashboardData(rows, columns);
  const hasAny = data.habits.length > 0 || data.dateActivity.length > 0;
  const overallRate = data.habits.length > 0
    ? data.habits.reduce((s, h) => s + h.completionRate, 0) / data.habits.length
    : 0;

  return (
    <div className="csv-db-dash">
      <div className="csv-db-dash-summary">
        <div className="csv-db-dash-summary-card">
          <span className="csv-db-dash-summary-value">{data.totalRows}</span>
          <span className="csv-db-dash-summary-label">Total rows</span>
        </div>
        <div className="csv-db-dash-summary-card">
          <span className="csv-db-dash-summary-value">{data.habits.length}</span>
          <span className="csv-db-dash-summary-label">Habits tracked</span>
        </div>
        {data.habits.length > 0 && (
          <div className="csv-db-dash-summary-card">
            <span className="csv-db-dash-summary-value">{Math.round(overallRate * 100)}%</span>
            <span className="csv-db-dash-summary-label">Avg completion</span>
          </div>
        )}
      </div>
      {data.habits.length > 0 && (
        <div className="csv-db-dash-habits-section">
          <h4>Habits</h4>
          <div className="csv-db-dash-habits-grid">
            {data.habits.map((h) => (
              <HabitCard key={h.colName} habit={h} rows={rows} columns={columns} onSetCell={onSetCell} />
            ))}
          </div>
        </div>
      )}
      {data.dateActivity.length > 0 && (
        <div className="csv-db-dash-calendar-section">
          <h4>Activity</h4>
          <ActivityGrid activity={data.dateActivity} dateRange={data.dateRange} />
        </div>
      )}
      {!hasAny && (
        <div className="csv-db-empty">
          <div className="csv-db-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div className="csv-db-empty-title">No dashboard data</div>
          <div className="csv-db-empty-desc">Add a Select, Checkbox, or Date column to see your dashboard.</div>
        </div>
      )}
    </div>
  );
}
