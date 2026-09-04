import { QueryResultRow } from "./record";

export interface TimelineItem {
  label: string;
  start: Date;
  end: Date;
  originalIndex: number;
  row: string[];
}

function parseDate(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function findDateColumns(columns: { name: string; type: string }[]): { startIdx: number; endIdx: number } {
  const startIdx = columns.findIndex((c) => /^(start|from|begin)/i.test(c.name) || c.type === "date");
  const endIdx = columns.findIndex((c, i) => i !== startIdx && (/^(end|due|to|finish)/i.test(c.name) || c.type === "date"));
  return { startIdx, endIdx };
}

export function buildTimelineItems(rows: QueryResultRow[], startIdx: number, endIdx: number, labelIdx: number): TimelineItem[] {
  const items: TimelineItem[] = [];
  const now = new Date();
  for (const r of rows) {
    const sd = parseDate(r.row[startIdx]);
    let ed = parseDate(r.row[endIdx]);
    if (!sd) continue;
    if (!ed) ed = now;
    if (ed < sd) ed = new Date(sd.getTime() + 86400000);
    items.push({
      label: r.row[labelIdx] || `Row ${r.originalIndex}`,
      start: sd,
      end: ed,
      originalIndex: r.originalIndex,
      row: r.row,
    });
  }
  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return items;
}

export function getTimelineBounds(items: TimelineItem[]): { min: number; max: number } {
  if (items.length === 0) return { min: 0, max: 0 };
  const min = Math.min(...items.map((i) => i.start.getTime()));
  const max = Math.max(...items.map((i) => i.end.getTime()));
  const pad = Math.max((max - min) * 0.04, 86400000);
  return { min: min - pad, max: max + pad };
}
