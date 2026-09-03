import { ColumnDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildTimelineItems } from "../query/timeline";

interface TimelineViewProps { rows: QueryResultRow[]; columns: ColumnDef[]; onCardClick: (idx:number)=>void; }

function formatTick(date: Date, spanDays: number): string {
  if (spanDays > 180) return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  if (spanDays > 30) return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return date.toISOString().slice(0,10);
}

export function TimelineView({ rows, columns, onCardClick }: TimelineViewProps) {
  const startIdx = columns.findIndex((c)=>/^(start|from|begin)/i.test(c.name) || c.type==="date");
  const endIdx = columns.findIndex((c,i)=>i!==startIdx && (/^(end|due|to|finish)/i.test(c.name) || c.type==="date"));
  const labelIdx = 0;
  if (startIdx===-1 || endIdx===-1) return <div className="csv-db-stats-empty">Needs Start and End/Due date columns.</div>;
  const items = buildTimelineItems(rows, startIdx, endIdx, labelIdx);
  if (items.length===0) return <div className="csv-db-stats-empty">No dated rows to show.</div>;
  const min = Math.min(...items.map((i)=>i.start.getTime()));
  const max = Math.max(...items.map((i)=>i.end.getTime()));
  const paddedMax = max + (max - min)*0.05;
  const paddedMin = min - (max - min)*0.02;
  const span = paddedMax - paddedMin || 1;
  const spanDays = span / 86400000;
  const now = Date.now();
  const tickCount = spanDays > 180 ? 8 : spanDays > 60 ? 6 : 5;
  const ticks = Array.from({length: tickCount+1}, (_,i)=> {
    const t = paddedMin + (span * i)/tickCount;
    return { t, label: formatTick(new Date(t), spanDays), left: (i/tickCount)*100 };
  });
  return (
    <div className="csv-db-timeline-v2">
      <div className="csv-db-timeline-header">
        <div className="csv-db-timeline-header-label">Task</div>
        <div className="csv-db-timeline-header-track">
          <div className="csv-db-timeline-grid">
            {ticks.map((tk,i)=>(
              <div key={i} className="csv-db-timeline-grid-line" style={{ left: `${tk.left}%` }} />
            ))}
            {now>=paddedMin && now<=paddedMax && <div className="csv-db-timeline-now" style={{ left: `${((now-paddedMin)/span)*100}%` }}><span>Today</span></div>}
          </div>
          <div className="csv-db-timeline-ticks">
            {ticks.map((tk,i)=>(
              <span key={i} className="csv-db-timeline-tick-label" style={{ left: `${tk.left}%` }}>{tk.label}</span>
            ))}
          </div>
        </div>
        <div className="csv-db-timeline-header-dates">Dates</div>
      </div>
      <div className="csv-db-timeline-body">
        {items.map((it)=> {
          const left = ((it.start.getTime()-paddedMin)/span)*100;
          const width = ((it.end.getTime()-it.start.getTime())/span)*100;
          const isPast = it.end.getTime() < now;
          const isFuture = it.start.getTime() > now;
          return (
            <div key={it.originalIndex} className="csv-db-timeline-row" onClick={()=>onCardClick(it.originalIndex)}>
              <span className="csv-db-timeline-label" title={it.label}>{it.label}</span>
              <div className="csv-db-timeline-track">
                <div className="csv-db-timeline-grid-bg">
                  {ticks.map((_,i)=>(<div key={i} className="csv-db-timeline-grid-line" style={{ left: `${(i/tickCount)*100}%` }} />))}
                </div>
                <div className={`csv-db-timeline-bar ${isPast ? "is-past" : isFuture ? "is-future" : "is-active"}`} style={{ left: `${left}%`, width: `${Math.max(width,0.8)}%` }} title={`${it.start.toISOString().slice(0,10)} → ${it.end.toISOString().slice(0,10)}`}>
                  <span className="csv-db-timeline-bar-label">{width>12 ? it.label : ""}</span>
                </div>
              </div>
              <span className="csv-db-timeline-dates">{it.start.toISOString().slice(0,10)} → {it.end.toISOString().slice(0,10)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
