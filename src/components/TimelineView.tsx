import { useRef, useCallback, useState, useEffect } from "react";
import { ColumnDef, SelectOption } from "../types";
import { QueryResultRow } from "../query/record";
import { buildTimelineItems, TimelineItem } from "../query/timeline";

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

function groupByStatus(items: TimelineItem[], statusIdx: number): Map<string, TimelineItem[]> {
  const groups = new Map<string, TimelineItem[]>();
  for (const it of items) {
    const key = statusIdx !== -1 ? it.row[statusIdx] || "—" : "All";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  return groups;
}

interface TooltipState { x: number; y: number; item: TimelineItem; days: number; progress?: number; statusVal: string; }

export function TimelineView({ rows, columns, onCardClick }: TimelineViewProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const onHeaderScroll = useCallback(() => {
    if (bodyRef.current && headerRef.current) bodyRef.current.scrollLeft = headerRef.current.scrollLeft;
  }, []);
  const onBodyScroll = useCallback(() => {
    if (bodyRef.current && headerRef.current) headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
  }, []);

  const startIdx = columns.findIndex((c)=>/^(start|from|begin)/i.test(c.name) || c.type==="date");
  const endIdx = columns.findIndex((c,i)=>i!==startIdx && (/^(end|due|to|finish)/i.test(c.name) || c.type==="date"));
  const statusIdx = columns.findIndex((c)=>/^(status|state)/i.test(c.name) || c.type==="select");
  const statusOpt = statusIdx !== -1 ? columns[statusIdx].options : undefined;
  const progressIdx = columns.findIndex((c)=>/^(progress|percent|completion)/i.test(c.name) || c.type==="number");
  const labelIdx = 0;

  if (startIdx===-1 || endIdx===-1) return <div className="csv-db-stats-empty">Add Start and End/Due date columns to use Timeline.</div>;
  const allItems = buildTimelineItems(rows, startIdx, endIdx, labelIdx);
  if (allItems.length===0) return <div className="csv-db-stats-empty">No dated rows to show on Timeline.</div>;

  const min = Math.min(...allItems.map((i)=>i.start.getTime()));
  const max = Math.max(...allItems.map((i)=>i.end.getTime()));
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

  const groups = groupByStatus(allItems, statusIdx);
  const groupOrder = statusIdx !== -1
    ? Array.from(groups.keys()).sort((a,b) => {
        const aIdx = (columns[statusIdx].options || []).findIndex(o => o.value === a);
        const bIdx = (columns[statusIdx].options || []).findIndex(o => o.value === b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      })
    : ["All"];

  const toggleGroup = (g: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    next.has(g) ? next.delete(g) : next.add(g);
    return next;
  });

  const visibleItems: { item: TimelineItem; group: string }[] = [];
  for (const g of groupOrder) {
    const gi = groups.get(g) || [];
    for (const it of gi) visibleItems.push({ item: it, group: g });
  }

  useEffect(() => {
    if (todayPct > 0 && bodyRef.current) {
      const el = bodyRef.current;
      const target = (todayPct / 100) * el.scrollWidth - el.clientWidth / 2;
      el.scrollLeft = Math.max(0, target);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx(prev => Math.min(prev + 1, visibleItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx(prev => Math.max(prev - 1, 0)); }
    else if (e.key === "Enter" && focusedIdx >= 0 && focusedIdx < visibleItems.length) {
      onCardClick(visibleItems[focusedIdx].item.originalIndex);
    }
  }, [visibleItems.length, focusedIdx, onCardClick]);

  const showTooltip = (e: React.MouseEvent, it: TimelineItem, days: number, statusVal: string) => {
    const progress = progressIdx !== -1 ? Number(it.row[progressIdx]) : undefined;
    setTooltip({ x: e.clientX, y: e.clientY, item: it, days, progress: Number.isNaN(progress) ? undefined : progress, statusVal });
  };
  const hideTooltip = () => setTooltip(null);

  return (
    <div className="csv-db-gantt" tabIndex={0} onKeyDown={handleKeyDown}>
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
        {groupOrder.map((groupName) => {
          const items = groups.get(groupName) || [];
          const collapsed = collapsedGroups.has(groupName);
          const colorKey = statusIdx !== -1 ? getStatusColor(groupName, statusOpt) : "";
          const dotColor = colorKey && STATUS_COLORS[colorKey] ? STATUS_COLORS[colorKey] : "var(--text-muted)";
          return (
            <div key={groupName} className="csv-db-gantt-group">
              <div className="csv-db-gantt-group-header" onClick={() => toggleGroup(groupName)}>
                <span className="csv-db-gantt-group-arrow">{collapsed ? "▸" : "▾"}</span>
                <span className="csv-db-gantt-group-dot" style={{ background: dotColor }} />
                <span className="csv-db-gantt-group-name">{groupName}</span>
                <span className="csv-db-gantt-group-count">{items.length}</span>
              </div>
              {!collapsed && items.map((it) => {
                const left = pct(it.start.getTime());
                const right = pct(it.end.getTime());
                const width = Math.max(right - left, 0.6);
                const days = Math.round((it.end.getTime() - it.start.getTime()) / 86400000);
                const statusVal = statusIdx !== -1 ? it.row[statusIdx] || "" : "";
                const barStyle = resolveBarStyle(statusVal, now, it.start.getTime(), it.end.getTime(), statusOpt);
                const isFocused = focusedIdx >= 0 && visibleItems[focusedIdx]?.item.originalIndex === it.originalIndex;
                const progress = progressIdx !== -1 ? Math.min(100, Math.max(0, Number(it.row[progressIdx]) || 0)) : undefined;
                return (
                  <div key={it.originalIndex} className={`csv-db-gantt-row ${isFocused ? "focused" : ""}`} onClick={()=>onCardClick(it.originalIndex)}>
                    <div className="csv-db-gantt-label-col">
                      <span className="csv-db-gantt-row-label" title={it.label}>{it.label}</span>
                    </div>
                    <div className="csv-db-gantt-timeline-col">
                      <div className="csv-db-gantt-grid">
                        {ticks.map((_,i)=>(<div key={i} className="csv-db-gantt-gridline" style={{ left: `${pct(ticks[i].t)}%` }} />))}
                        {todayPct >= 0 && <div className="csv-db-gantt-today-line" style={{ left: `${todayPct}%` }} />}
                      </div>
                      <div className="csv-db-gantt-bar"
                        style={{ left: `${left}%`, width: `${width}%`, ...barStyle }}
                        onMouseEnter={(e)=>showTooltip(e, it, days, statusVal)}
                        onMouseMove={(e)=>setTooltip(prev=>prev ? {...prev, x: e.clientX, y: e.clientY} : null)}
                        onMouseLeave={hideTooltip}>
                        {progress !== undefined && <div className="csv-db-gantt-bar-progress" style={{ width: `${progress}%` }} />}
                        {width > 8 && <span className="csv-db-gantt-bar-text">{days > 0 ? `${days}d` : ""}{progress !== undefined ? ` · ${progress}%` : ""}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {tooltip && (
        <div className="csv-db-gantt-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}>
          <div className="csv-db-gantt-tooltip-title">{tooltip.item.label}</div>
          <div className="csv-db-gantt-tooltip-dates">{tooltip.item.start.toISOString().slice(0,10)} → {tooltip.item.end.toISOString().slice(0,10)} <span>({tooltip.days}d)</span></div>
          {tooltip.statusVal && <div className="csv-db-gantt-tooltip-status">Status: {tooltip.statusVal}</div>}
          {tooltip.progress !== undefined && <div className="csv-db-gantt-tooltip-progress">Progress: {tooltip.progress}%</div>}
        </div>
      )}
    </div>
  );
}
