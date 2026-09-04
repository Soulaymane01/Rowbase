import { useRef, useCallback } from "react";
import { ColumnDef, SelectOption } from "../types";
import { QueryResultRow } from "../query/record";
import { buildTimelineItems } from "../query/timeline";

interface TimelineViewProps { rows: QueryResultRow[]; columns: ColumnDef[]; onCardClick: (idx:number)=>void; }

function getTickInterval(spanDays: number) {
  if (spanDays > 365) return { unit: "month" as const, step: 3 };
  if (spanDays > 120) return { unit: "month" as const, step: 1 };
  if (spanDays > 30) return { unit: "week" as const, step: 1 };
  return { unit: "day" as const, step: 1 };
}

function advanceDate(d: Date, unit: "day"|"week"|"month", step: number): Date {
  const r = new Date(d);
  if (unit === "day") r.setDate(r.getDate() + step);
  else if (unit === "week") r.setDate(r.getDate() + 7 * step);
  else { r.setMonth(r.getMonth() + step); r.setDate(1); }
  return r;
}

function formatTickLabel(d: Date, unit: "day"|"week"|"month"): string {
  if (unit === "month") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  if (unit === "week") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function generateTicks(min: number, max: number, unit: "day"|"week"|"month", step: number) {
  const ticks: { t: number; label: string }[] = [];
  const d = new Date(min);
  if (unit === "month") { d.setDate(1); d.setHours(0,0,0,0); }
  else if (unit === "week") { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); }
  else { d.setHours(0,0,0,0); }
  let cur = d.getTime();
  while (cur <= max + (max - min) * 0.02) {
    ticks.push({ t: cur, label: formatTickLabel(new Date(cur), unit) });
    cur = advanceDate(new Date(cur), unit, step).getTime();
  }
  return ticks;
}

function getStatusColor(val: string, options?: SelectOption[]): string {
  if (!options) return "";
  const opt = options.find((o) => o.value.toLowerCase() === val.toLowerCase());
  return opt?.color || "";
}

const STATUS_COLORS: Record<string, string> = {
  red: "hsl(0, 70%, 60%)", green: "hsl(140, 50%, 45%)", blue: "hsl(210, 70%, 55%)",
  yellow: "hsl(40, 80%, 50%)", purple: "hsl(270, 55%, 55%)", pink: "hsl(330, 65%, 58%)",
  orange: "hsl(24, 80%, 55%)", gray: "hsl(0, 0%, 55%)",
};

function resolveBarStyle(statusVal: string, now: number, start: number, end: number, statusOpt?: SelectOption[]): React.CSSProperties {
  const colorKey = getStatusColor(statusVal, statusOpt);
  if (colorKey && STATUS_COLORS[colorKey]) {
    const bg = STATUS_COLORS[colorKey];
    if (end < now) return { background: bg, opacity: 0.55 };
    if (start > now) return { background: bg, opacity: 0.8 };
    return { background: bg, boxShadow: "0 1px 4px rgba(0,0,0,0.2)" };
  }
  if (end < now) return { background: "var(--text-faint)", opacity: 0.6 };
  if (start > now) return { background: "var(--color-green)" };
  return { background: "var(--interactive-accent)" };
}

export function TimelineView({ rows, columns, onCardClick }: TimelineViewProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const onHeaderScroll = useCallback(() => {
    if (bodyRef.current && headerRef.current) {
      bodyRef.current.scrollLeft = headerRef.current.scrollLeft;
    }
  }, []);
  const onBodyScroll = useCallback(() => {
    if (bodyRef.current && headerRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  }, []);

  const startIdx = columns.findIndex((c)=>/^(start|from|begin)/i.test(c.name) || c.type==="date");
  const endIdx = columns.findIndex((c,i)=>i!==startIdx && (/^(end|due|to|finish)/i.test(c.name) || c.type==="date"));
  const statusIdx = columns.findIndex((c)=>/^(status|state)/i.test(c.name) || c.type==="select");
  const statusOpt = statusIdx !== -1 ? columns[statusIdx].options : undefined;
  const labelIdx = 0;

  if (startIdx===-1 || endIdx===-1) return <div className="csv-db-stats-empty">Add Start and End/Due date columns to use Timeline.</div>;
  const items = buildTimelineItems(rows, startIdx, endIdx, labelIdx);
  if (items.length===0) return <div className="csv-db-stats-empty">No dated rows to show on Timeline.</div>;

  const min = Math.min(...items.map((i)=>i.start.getTime()));
  const max = Math.max(...items.map((i)=>i.end.getTime()));
  const pad = Math.max((max - min) * 0.04, 86400000);
  const pMin = min - pad;
  const pMax = max + pad;
  const span = pMax - pMin;
  const spanDays = span / 86400000;
  const now = Date.now();
  const { unit, step } = getTickInterval(spanDays);
  const ticks = generateTicks(pMin, pMax, unit, step);

  const pct = (t: number) => ((t - pMin) / span) * 100;
  const todayPct = now >= pMin && now <= pMax ? pct(now) : -1;

  return (
    <div className="csv-db-gantt">
      <div className="csv-db-gantt-header" ref={headerRef} onScroll={onHeaderScroll}>
        <div className="csv-db-gantt-label-col" />
        <div className="csv-db-gantt-timeline-col">
          <div className="csv-db-gantt-date-axis">
            {ticks.map((tk,i)=>(
              <div key={i} className="csv-db-gantt-tick" style={{ left: `${pct(tk.t)}%` }}>
                <span className="csv-db-gantt-tick-text">{tk.label}</span>
                <div className="csv-db-gantt-tick-line" />
              </div>
            ))}
            {todayPct >= 0 && (
              <div className="csv-db-gantt-today-marker" style={{ left: `${todayPct}%` }}>
                <span className="csv-db-gantt-today-label">Today</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="csv-db-gantt-body" ref={bodyRef} onScroll={onBodyScroll}>
        {items.map((it, idx) => {
          const left = pct(it.start.getTime());
          const right = pct(it.end.getTime());
          const width = Math.max(right - left, 0.6);
          const days = Math.round((it.end.getTime() - it.start.getTime()) / 86400000);
          const statusVal = statusIdx !== -1 ? it.row[statusIdx] || "" : "";
          const barStyle = resolveBarStyle(statusVal, now, it.start.getTime(), it.end.getTime(), statusOpt);
          return (
            <div key={it.originalIndex} className={`csv-db-gantt-row ${idx % 2 === 0 ? "even" : "odd"}`} onClick={()=>onCardClick(it.originalIndex)}>
              <div className="csv-db-gantt-label-col">
                <span className="csv-db-gantt-row-label" title={it.label}>{it.label}</span>
                {statusVal && <span className="csv-db-gantt-row-status">{statusVal}</span>}
              </div>
              <div className="csv-db-gantt-timeline-col">
                <div className="csv-db-gantt-grid">
                  {ticks.map((_,i)=>(<div key={i} className="csv-db-gantt-gridline" style={{ left: `${pct(ticks[i].t)}%` }} />))}
                  {todayPct >= 0 && <div className="csv-db-gantt-today-line" style={{ left: `${todayPct}%` }} />}
                </div>
                <div className="csv-db-gantt-bar"
                  style={{ left: `${left}%`, width: `${width}%`, ...barStyle }}
                  title={`${it.start.toISOString().slice(0,10)} → ${it.end.toISOString().slice(0,10)} (${days}d)${statusVal ? " ["+statusVal+"]" : ""}`}>
                  {width > 8 && <span className="csv-db-gantt-bar-text">{days > 0 ? `${days}d` : ""}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
