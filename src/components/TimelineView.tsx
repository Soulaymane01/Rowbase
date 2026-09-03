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
  return (
    <div className="csv-db-timeline">
      <div className="csv-db-timeline-axis">
        {items.map((it)=> {
          const left = ((it.start.getTime()-min)/span)*100;
          const width = ((it.end.getTime()-it.start.getTime())/span)*100;
          return (
            <div key={it.originalIndex} className="csv-db-timeline-row" onClick={()=>onCardClick(it.originalIndex)}>
              <span className="csv-db-timeline-label">{it.label}</span>
              <div className="csv-db-timeline-track">
                <div className="csv-db-timeline-bar" style={{ left: `${left}%`, width: `${Math.max(width,2)}%` }} title={`${it.start.toISOString().slice(0,10)} → ${it.end.toISOString().slice(0,10)}`} />
                {now>=it.start.getTime() && now<=it.end.getTime() && <div className="csv-db-timeline-now" style={{ left: `${((now-min)/span)*100}%` }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
