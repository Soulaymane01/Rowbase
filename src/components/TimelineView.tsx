import { ColumnDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildTimelineItems } from "../query/timeline";

interface TimelineViewProps { rows: QueryResultRow[]; columns: ColumnDef[]; onCardClick: (idx:number)=>void; }

export function TimelineView({ rows, columns, onCardClick }: TimelineViewProps) {
  const startIdx = columns.findIndex((c)=>/^(start|from|begin)/i.test(c.name) || c.type==="date");
  const endIdx = columns.findIndex((c,i)=>i!==startIdx && (/^(end|due|to|finish)/i.test(c.name) || c.type==="date"));
  const labelIdx = 0;
  if (startIdx===-1 || endIdx===-1) return <div className="csv-db-stats-empty">Needs Start and End/Due date columns.</div>;
  const items = buildTimelineItems(rows, startIdx, endIdx, labelIdx);
  if (items.length===0) return <div className="csv-db-stats-empty">No dated rows to show.</div>;
  const min = Math.min(...items.map((i)=>i.start.getTime()));
  const max = Math.max(...items.map((i)=>i.end.getTime()));
  const span = max - min || 1;
  const now = Date.now();
  const tickCount = 6;
  const ticks = Array.from({length: tickCount+1}, (_,i)=> {
    const t = min + (span * i)/tickCount;
    return { t, label: new Date(t).toISOString().slice(0,10), left: (i/tickCount)*100 };
  });
  return (
    <div className="csv-db-timeline">
      <div className="csv-db-timeline-axis-bar">
        <div className="csv-db-timeline-axis-line" />
        {ticks.map((tk,i)=>(
          <div key={i} className="csv-db-timeline-tick" style={{ left: `${tk.left}%` }}>
            <div className="csv-db-timeline-tick-dot" />
            <span className="csv-db-timeline-tick-label">{tk.label}</span>
          </div>
        ))}
        {now>=min && now<=max && <div className="csv-db-timeline-now-line" style={{ left: `${((now-min)/span)*100}%` }} title="Today" />}
      </div>
      <div className="csv-db-timeline-items">
        {items.map((it)=> {
          const left = ((it.start.getTime()-min)/span)*100;
          const width = ((it.end.getTime()-it.start.getTime())/span)*100;
          return (
            <div key={it.originalIndex} className="csv-db-timeline-row" onClick={()=>onCardClick(it.originalIndex)}>
              <span className="csv-db-timeline-label">{it.label}</span>
              <div className="csv-db-timeline-track">
                <div className="csv-db-timeline-line" style={{ left: `${left}%`, width: `${Math.max(width,1)}%` }}>
                  <span className="csv-db-timeline-dot start" />
                  <span className="csv-db-timeline-dot end" />
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
