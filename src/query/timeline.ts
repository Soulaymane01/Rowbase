import { QueryResultRow } from "./record";

export interface TimelineItem { label: string; start: Date; end: Date; originalIndex: number; }

export function buildTimelineItems(rows: QueryResultRow[], startIdx: number, endIdx: number, labelIdx: number): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const r of rows) {
    const s = r.row[startIdx]; const e = r.row[endIdx] || new Date().toISOString().slice(0,10);
    const sd = new Date(s); const ed = new Date(e);
    if (!s || Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) continue;
    items.push({ label: r.row[labelIdx] || `Row ${r.originalIndex}`, start: sd, end: ed, originalIndex: r.originalIndex });
  }
  items.sort((a,b)=>a.start.getTime()-b.start.getTime());
  return items;
}
