import { useRef, useCallback, useState, useEffect, useMemo, useLayoutEffect } from "react";
import { ColumnDef, SelectOption, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildTimelineItems, getTimelineBounds, TimelineItem } from "../query/timeline";
import { useClickOutside } from "../hooks/useClickOutside";

const DAY = 86400000;
const MIN_SPAN = DAY;
const AUTO = "__auto";
const NONE = "__none";

interface TimelineViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  activeView: ViewDef;
  onCardClick: (idx: number) => void;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onSetCells: (updates: { rowIdx: number; colIdx: number; value: string }[]) => void;
  onDeleteRow: (rowIdx: number) => void;
  onUpdateView: (view: ViewDef) => void;
}

function getTickInterval(spanDays: number) {
  if (spanDays > 900) return { unit: "year" as const, step: 1 };
  if (spanDays > 365) return { unit: "month" as const, step: 3 };
  if (spanDays > 120) return { unit: "month" as const, step: 1 };
  if (spanDays > 45) return { unit: "week" as const, step: 2 };
  if (spanDays > 14) return { unit: "week" as const, step: 1 };
  if (spanDays > 3) return { unit: "day" as const, step: 2 };
  return { unit: "day" as const, step: 1 };
}

type TickUnit = "day" | "week" | "month" | "year";

function advanceDate(d: Date, unit: TickUnit, step: number): Date {
  const r = new Date(d);
  if (unit === "day") r.setDate(r.getDate() + step);
  else if (unit === "week") r.setDate(r.getDate() + 7 * step);
  else if (unit === "month") { r.setMonth(r.getMonth() + step); r.setDate(1); }
  else { r.setFullYear(r.getFullYear() + step); r.setMonth(0); r.setDate(1); }
  return r;
}

function formatTickLabel(d: Date, unit: TickUnit): string {
  if (unit === "year") return String(d.getFullYear());
  if (unit === "month") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function generateTicks(min: number, max: number, unit: TickUnit, step: number) {
  const ticks: { t: number; label: string }[] = [];
  const d = new Date(min);
  if (unit === "year") { d.setMonth(0); d.setDate(1); d.setHours(0, 0, 0, 0); }
  else if (unit === "month") { d.setDate(1); d.setHours(0, 0, 0, 0); }
  else if (unit === "week") { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); }
  else { d.setHours(0, 0, 0, 0); }
  let cur = d.getTime();
  let guard = 0;
  while (cur <= max && guard < 2000) {
    ticks.push({ t: cur, label: formatTickLabel(new Date(cur), unit) });
    cur = advanceDate(new Date(cur), unit, step).getTime();
    guard++;
  }
  return ticks;
}

function formatSpan(days: number): string {
  if (days < 2) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 60) return `${Math.round(days)}d`;
  if (days < 730) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function getStatusColor(val: string, options?: SelectOption[]): string {
  if (!options) return "";
  const opt = options.find((o) => o.value.toLowerCase() === val.toLowerCase());
  return opt?.color || "";
}

const STATUS_COLORS: Record<string, string> = {
  red: "hsl(0, 70%, 60%)", green: "hsl(140, 50%, 45%)", blue: "hsl(210, 70%, 55%)",
  yellow: "hsl(40, 80%, 50%)", purple: "hsl(270, 55%, 55%)", pink: "hsl(330, 65%, 58%)",
  orange: "hsl(24, 80%, 55%)", gray: "hsl(0, 0%, 55%)", brown: "hsl(24, 40%, 45%)",
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

function indexByName(columns: ColumnDef[], name: string | undefined): number {
  if (!name || name === AUTO || name === NONE) return -1;
  return columns.findIndex((c) => c.name === name);
}

interface TooltipState { x: number; y: number; item: TimelineItem; days: number; progress?: number; statusVal: string; }
interface ContextMenuState { x: number; y: number; item: TimelineItem; }

export function TimelineView({ rows, columns, activeView, onCardClick, onSetCell, onSetCells, onDeleteRow, onUpdateView }: TimelineViewProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelColRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const justPannedRef = useRef(false);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [viewWindow, setViewWindow] = useState<{ start: number; end: number } | null>(null);
  const [barDrag, setBarDrag] = useState<{ originalIndex: number; start: number; end: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [labelWidth, setLabelWidth] = useState(180);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useClickOutside([settingsRef], () => setSettingsOpen(false), settingsOpen);

  // --- Column resolution (configured, else heuristic) ---
  const dateCols = useMemo(
    () => columns.map((c, i) => ({ c, i })).filter(({ c }) => c.type === "date"),
    [columns]
  );

  const startIdx = useMemo(() => {
    const named = indexByName(columns, activeView.timelineStartColumn);
    if (named !== -1 && columns[named].type === "date") return named;
    const byName = columns.findIndex((c) => c.type === "date" && /^(start|from|begin)/i.test(c.name));
    if (byName !== -1) return byName;
    return dateCols[0]?.i ?? -1;
  }, [columns, activeView.timelineStartColumn, dateCols]);

  const endIdx = useMemo(() => {
    const named = indexByName(columns, activeView.timelineEndColumn);
    if (named !== -1 && columns[named].type === "date" && named !== startIdx) return named;
    const byName = columns.findIndex((c, i) => i !== startIdx && c.type === "date" && /^(end|due|to|finish)/i.test(c.name));
    if (byName !== -1) return byName;
    const other = dateCols.find(({ i }) => i !== startIdx);
    return other ? other.i : -1;
  }, [columns, activeView.timelineEndColumn, startIdx, dateCols]);

  const statusIdx = useMemo(() => {
    if (activeView.timelineStatusColumn === NONE) return -1;
    const named = indexByName(columns, activeView.timelineStatusColumn);
    if (named !== -1 && columns[named].type === "select") return named;
    const byName = columns.findIndex((c) => c.type === "select" && /^(status|state)/i.test(c.name));
    if (byName !== -1) return byName;
    return columns.findIndex((c) => c.type === "select");
  }, [columns, activeView.timelineStatusColumn]);

  const labelIdx = useMemo(() => {
    if (activeView.timelineLabelColumn === NONE) return -1;
    const named = indexByName(columns, activeView.timelineLabelColumn);
    return named !== -1 ? named : 0;
  }, [columns, activeView.timelineLabelColumn]);

  const groupByIdx = useMemo(() => {
    if (activeView.timelineGroupBy === NONE) return -1;
    if (activeView.timelineGroupBy) {
      const named = indexByName(columns, activeView.timelineGroupBy);
      if (named !== -1) return named;
    }
    return statusIdx;
  }, [activeView.timelineGroupBy, columns, statusIdx]);

  const progressIdx = useMemo(() => {
    const byType = columns.findIndex((c) => c.type === "progress");
    if (byType !== -1) return byType;
    return columns.findIndex((c) => /^(progress|percent|completion)/i.test(c.name));
  }, [columns]);

  const items = useMemo(() => {
    if (startIdx === -1 || endIdx === -1) return [];
    return buildTimelineItems(rows, startIdx, endIdx, labelIdx);
  }, [rows, startIdx, endIdx, labelIdx]);

  const bounds = useMemo(() => getTimelineBounds(items), [items]);
  const dataSpan = Math.max(bounds.max - bounds.min, DAY);
  const maxSpan = Math.max(dataSpan * 12, DAY * 366 * 2);

  const clampWindow = useCallback((start: number, end: number) => {
    const span = Math.min(Math.max(end - start, MIN_SPAN), maxSpan);
    const minStart = bounds.min - span * 0.9;
    const maxStart = Math.max(minStart, bounds.max + span * 0.9 - span);
    const s = Math.min(Math.max(start, minStart), maxStart);
    return { start: s, end: s + span };
  }, [bounds.min, bounds.max, maxSpan]);

  const eff = useMemo(
    () => (viewWindow ? clampWindow(viewWindow.start, viewWindow.end) : { start: bounds.min, end: bounds.max }),
    [viewWindow, clampWindow, bounds.min, bounds.max]
  );
  const span = Math.max(eff.end - eff.start, MIN_SPAN);
  const spanDays = span / DAY;
  const { unit, step } = getTickInterval(spanDays);
  const ticks = useMemo(() => generateTicks(eff.start, eff.end, unit, step), [eff.start, eff.end, unit, step]);
  const pct = useCallback((t: number) => ((t - eff.start) / span) * 100, [eff.start, span]);
  const now = Date.now();
  const todayPct = now >= eff.start && now <= eff.end ? pct(now) : -1;

  const zoomBy = useCallback((factor: number, anchorT?: number) => {
    const cur = eff;
    const curSpan = cur.end - cur.start;
    const anchor = anchorT ?? (cur.start + cur.end) / 2;
    const ratio = (anchor - cur.start) / curSpan;
    const newSpan = Math.min(Math.max(curSpan / factor, MIN_SPAN), maxSpan);
    const newStart = anchor - ratio * newSpan;
    setViewWindow(clampWindow(newStart, newStart + newSpan));
  }, [eff, clampWindow, maxSpan]);

  const panBy = useCallback((ms: number) => {
    setViewWindow(clampWindow(eff.start + ms, eff.end + ms));
  }, [eff, clampWindow]);

  const goToday = useCallback(() => {
    const curSpan = eff.end - eff.start;
    setViewWindow(clampWindow(now - curSpan / 2, now + curSpan / 2));
  }, [eff, clampWindow, now]);

  const fit = useCallback(() => setViewWindow(null), []);

  // Measure the label column so the resize handles can overlay the time area
  useLayoutEffect(() => {
    const el = labelColRef.current;
    if (!el) return;
    const update = () => setLabelWidth(el.offsetWidth);
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [items.length]);

  // Measure the body scrollbar so the right resize handle sits over content, not the scrollbar
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setScrollbarWidth(Math.max(0, el.offsetWidth - el.clientWidth));
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [items.length]);

  // Wheel: ctrl/cmd = zoom (anchored at cursor), otherwise pan the window
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = bodyRef.current?.querySelector<HTMLElement>(".csv-db-gantt-timeline-col")?.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        let anchorT: number | undefined;
        if (rect && rect.width > 0) {
          const ratio = (e.clientX - rect.left) / rect.width;
          anchorT = eff.start + ratio * span;
        }
        zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2, anchorT);
      } else {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        const width = rect?.width ?? 1;
        panBy((delta / width) * span);
      }
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [eff.start, eff.end, span, zoomBy, panBy]);

  // Center on today once data is available
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current || items.length === 0) return;
    centeredRef.current = true;
    if (todayPct < 0 || todayPct > 100) {
      const curSpan = eff.end - eff.start;
      setViewWindow(clampWindow(now - curSpan / 2, now + curSpan / 2));
    }
  }, [items.length]);

  // --- Grouping ---
  const groups = useMemo(() => {
    if (groupByIdx === -1) return [{ key: "All", items }];
    const map = new Map<string, TimelineItem[]>();
    for (const it of items) {
      const key = it.row[groupByIdx] || "No value";
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    const col = columns[groupByIdx];
    const keys = Array.from(map.keys());
    if (col.type === "select" && col.options) {
      const order = new Map(col.options.map((o, i) => [o.value, i]));
      keys.sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
    } else {
      keys.sort((a, b) => a.localeCompare(b));
    }
    return keys.map((key) => ({ key, items: map.get(key)! }));
  }, [items, groupByIdx, columns]);

  const visibleItems = useMemo(() => {
    const out: TimelineItem[] = [];
    for (const g of groups) {
      if (!collapsedGroups.has(g.key)) out.push(...g.items);
    }
    return out;
  }, [groups, collapsedGroups]);

  const groupColor = useCallback((key: string) => {
    const col = groupByIdx !== -1 ? columns[groupByIdx] : null;
    if (col?.type === "select") {
      const c = getStatusColor(key, col.options);
      if (c && STATUS_COLORS[c]) return STATUS_COLORS[c];
    }
    if (statusIdx !== -1) {
      const c = getStatusColor(key, columns[statusIdx].options);
      if (c && STATUS_COLORS[c]) return STATUS_COLORS[c];
    }
    return "var(--text-muted)";
  }, [columns, groupByIdx, statusIdx]);

  const toggleGroup = useCallback((g: string) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    return next;
  }), []);

  // --- Drag to pan (works anywhere over the timeline: ruler, rows, bars) ---
  const onRootMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".csv-db-gantt-toolbar, .csv-db-gantt-resize-handle, .csv-db-gantt-group-header, .csv-db-gantt-bar, .csv-db-gantt-ctx, button, select, input, textarea")) return;
    const timelineEl = bodyRef.current?.querySelector<HTMLElement>(".csv-db-gantt-timeline-col");
    const width = timelineEl?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;

    e.preventDefault();
    const startView = eff;
    const pxPerMs = width / (startView.end - startView.start);
    const startX = e.clientX;
    const doc = activeDocument;
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      if (!moved) {
        moved = true;
        justPannedRef.current = true;
        doc.body.classList.add("csv-db-gantt-panning");
      }
      setViewWindow(clampWindow(startView.start - dx / pxPerMs, startView.end - dx / pxPerMs));
    };
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseup", onUp);
      doc.body.classList.remove("csv-db-gantt-panning");
      if (moved) window.requestAnimationFrame(() => { justPannedRef.current = false; });
    };
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
  }, [eff, clampWindow]);

  // --- Drag edges to resize the window ---
  const startResize = useCallback((side: "left" | "right") => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = bodyRef.current?.querySelector<HTMLElement>(".csv-db-gantt-timeline-col")?.getBoundingClientRect();
    const width = rect?.width ?? 1;
    const startView = eff;
    const pxPerMs = width / (startView.end - startView.start);
    const startX = e.clientX;
    const doc = activeDocument;
    const onMove = (ev: MouseEvent) => {
      const dms = (ev.clientX - startX) / pxPerMs;
      if (side === "left") setViewWindow(clampWindow(startView.start + dms, startView.end));
      else setViewWindow(clampWindow(startView.start, startView.end + dms));
    };
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseup", onUp);
      doc.body.classList.remove("csv-db-gantt-resizing");
    };
    doc.body.classList.add("csv-db-gantt-resizing");
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
  }, [eff, clampWindow]);

  // --- Drag a bar to move it, or its edges to resize it (edits the date cells) ---
  const startBarDrag = useCallback((e: React.MouseEvent, it: TimelineItem, mode: "move" | "start" | "end") => {
    if (e.button !== 0) return;
    if (startIdx === -1 || endIdx === -1) return;
    e.preventDefault();
    e.stopPropagation();

    const timelineEl = bodyRef.current?.querySelector<HTMLElement>(".csv-db-gantt-timeline-col");
    const width = timelineEl?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;

    const pxPerMs = width / span;
    const startX = e.clientX;
    const s0 = it.start.getTime();
    const e0 = it.end.getTime();
    const doc = activeDocument;
    let moved = false;
    let preview = { originalIndex: it.originalIndex, start: s0, end: e0 };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      if (!moved) {
        moved = true;
        justPannedRef.current = true;
        doc.body.classList.add("csv-db-gantt-bar-dragging");
        setTooltip(null);
      }
      const dms = Math.round(dx / pxPerMs / DAY) * DAY;
      let s = s0;
      let en = e0;
      if (mode === "move") {
        s = s0 + dms;
        en = e0 + dms;
      } else if (mode === "start") {
        s = Math.min(s0 + dms, e0);
      } else {
        en = Math.max(e0 + dms, s0);
      }
      preview = { originalIndex: it.originalIndex, start: s, end: en };
      setBarDrag(preview);
    };

    const onUp = () => {
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseup", onUp);
      doc.body.classList.remove("csv-db-gantt-bar-dragging");
      if (moved) {
        const oldStart = new Date(s0).toISOString().slice(0, 10);
        const oldEnd = new Date(e0).toISOString().slice(0, 10);
        const newStart = new Date(preview.start).toISOString().slice(0, 10);
        const newEnd = new Date(preview.end).toISOString().slice(0, 10);
        const updates: { rowIdx: number; colIdx: number; value: string }[] = [];
        if (newStart !== oldStart) updates.push({ rowIdx: it.originalIndex, colIdx: startIdx, value: newStart });
        if (newEnd !== oldEnd) updates.push({ rowIdx: it.originalIndex, colIdx: endIdx, value: newEnd });
        if (updates.length > 0) onSetCells(updates);
        window.requestAnimationFrame(() => { justPannedRef.current = false; });
      }
      setBarDrag(null);
    };

    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
  }, [span, startIdx, endIdx, onSetCells]);

  const handleRowClick = useCallback((originalIndex: number) => {
    if (justPannedRef.current) return;
    onCardClick(originalIndex);
  }, [onCardClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("select, input, textarea")) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((prev) => Math.min(prev + 1, visibleItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((prev) => Math.max(prev - 1, 0)); }
    else if (e.key === "Enter" && focusedIdx >= 0 && focusedIdx < visibleItems.length) {
      onCardClick(visibleItems[focusedIdx].originalIndex);
    }
  }, [visibleItems, focusedIdx, onCardClick]);

  const showTooltip = (e: React.MouseEvent, it: TimelineItem, days: number, statusVal: string) => {
    const progress = progressIdx !== -1 ? Number(it.row[progressIdx]) : undefined;
    setTooltip({ x: e.clientX, y: e.clientY, item: it, days, progress: Number.isNaN(progress) ? undefined : progress, statusVal });
  };
  const hideTooltip = () => setTooltip(null);

  const showCtxMenu = (e: React.MouseEvent, it: TimelineItem) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, item: it });
  };
  const closeCtxMenu = () => setCtxMenu(null);
  const statusCol = statusIdx !== -1 ? columns[statusIdx] : null;

  // --- Empty states (after all hooks) ---
  if (startIdx === -1 || endIdx === -1) {
    return (
      <div className="csv-db-empty">
        <div className="csv-db-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div className="csv-db-empty-title">No timeline data</div>
        <div className="csv-db-empty-desc">Add Start and End/Due date columns to use Timeline.</div>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="csv-db-empty">
        <div className="csv-db-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div className="csv-db-empty-title">No timeline data</div>
        <div className="csv-db-empty-desc">No dated rows to show on Timeline.</div>
      </div>
    );
  }

  const groupSelectValue = activeView.timelineGroupBy === undefined ? AUTO : activeView.timelineGroupBy;
  const statusSelectValue = statusIdx === -1 ? NONE : columns[statusIdx].name;
  const labelSelectValue = labelIdx === -1 ? NONE : columns[labelIdx].name;

  const setField = (patch: Partial<ViewDef>) => {
    onUpdateView({ ...activeView, ...patch });
  };

  return (
    <div className="csv-db-gantt" ref={rootRef} tabIndex={0} onKeyDown={handleKeyDown} onMouseDown={onRootMouseDown} onClick={closeCtxMenu}>
      <div className="csv-db-gantt-toolbar">
        <div className="csv-db-gantt-toolbar-group">
          <span className="csv-db-gantt-toolbar-label">Group by</span>
          <select
            className="csv-db-gantt-select"
            value={groupSelectValue}
            onChange={(e) => {
              const v = e.target.value;
              setField({ timelineGroupBy: v === AUTO ? undefined : v });
            }}
          >
            <option value={AUTO}>Auto</option>
            <option value={NONE}>None</option>
            {columns.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="csv-db-gantt-toolbar-group" ref={settingsRef}>
          <button
            className="csv-db-gantt-btn"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Timeline fields"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="2" />
              <path d="M7 1v1.6M7 11.4V13M1 7h1.6M11.4 7H13M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1" />
            </svg>
          </button>
          {settingsOpen && (
            <div className="csv-db-popover csv-db-gantt-settings" onClick={(e) => e.stopPropagation()}>
              <div className="csv-db-gantt-settings-field">
                <label>Start date</label>
                <select value={startIdx} onChange={(e) => setField({ timelineStartColumn: columns[Number(e.target.value)].name })}>
                  {dateCols.map(({ c, i }) => <option key={c.name} value={i}>{c.name}</option>)}
                </select>
              </div>
              <div className="csv-db-gantt-settings-field">
                <label>End date</label>
                <select value={endIdx} onChange={(e) => setField({ timelineEndColumn: columns[Number(e.target.value)].name })}>
                  {dateCols.filter(({ i }) => i !== startIdx).map(({ c, i }) => <option key={c.name} value={i}>{c.name}</option>)}
                </select>
              </div>
              <div className="csv-db-gantt-settings-field">
                <label>Color by</label>
                <select value={statusSelectValue} onChange={(e) => setField({ timelineStatusColumn: e.target.value })}>
                  <option value={NONE}>None</option>
                  {columns.filter((c) => c.type === "select").map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="csv-db-gantt-settings-field">
                <label>Label</label>
                <select value={labelSelectValue} onChange={(e) => setField({ timelineLabelColumn: e.target.value })}>
                  <option value={NONE}>None</option>
                  {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="csv-db-gantt-toolbar-spacer" />

        <div className="csv-db-gantt-toolbar-group">
          <button className="csv-db-gantt-btn" onClick={() => panBy(-span * 0.5)} title="Pan earlier">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L4 7l5 5" /></svg>
          </button>
          <button className="csv-db-gantt-btn csv-db-gantt-btn-text" onClick={goToday} title="Center on today">Today</button>
          <button className="csv-db-gantt-btn" onClick={() => panBy(span * 0.5)} title="Pan later">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2l5 5-5 5" /></svg>
          </button>
        </div>

        <div className="csv-db-gantt-toolbar-group">
          <button className="csv-db-gantt-btn" onClick={() => zoomBy(1 / 1.25)} title="Zoom out">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="3" y1="7" x2="11" y2="7" /></svg>
          </button>
          <span className="csv-db-gantt-zoom-label" title="Visible range">{formatSpan(spanDays)}</span>
          <button className="csv-db-gantt-btn" onClick={() => zoomBy(1.25)} title="Zoom in">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="3" y1="7" x2="11" y2="7" /><line x1="7" y1="3" x2="7" y2="11" /></svg>
          </button>
          <button className="csv-db-gantt-btn csv-db-gantt-btn-text" onClick={fit} title="Fit all dates">Fit</button>
        </div>
      </div>

      <div className="csv-db-gantt-header">
        <div className="csv-db-gantt-label-col" ref={labelColRef} />
        <div className="csv-db-gantt-timeline-col">
          <div className="csv-db-gantt-date-axis">
            {ticks.map((tk, i) => (
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

      <div className="csv-db-gantt-body" ref={bodyRef}>
        {groups.map((group) => {
          const collapsed = collapsedGroups.has(group.key);
          return (
            <div key={group.key} className="csv-db-gantt-group">
              {groupByIdx !== -1 && (
                <div className="csv-db-gantt-group-header" onClick={() => toggleGroup(group.key)}>
                  <span className="csv-db-gantt-group-arrow">{collapsed ? "▸" : "▾"}</span>
                  <span className="csv-db-gantt-group-dot" style={{ background: groupColor(group.key) }} />
                  <span className="csv-db-gantt-group-name">{group.key}</span>
                  <span className="csv-db-gantt-group-count">{group.items.length}</span>
                </div>
              )}
              {!collapsed && group.items.map((it) => {
                const isDraggingThis = barDrag?.originalIndex === it.originalIndex;
                const sMs = isDraggingThis ? barDrag.start : it.start.getTime();
                const eMs = isDraggingThis ? barDrag.end : it.end.getTime();
                const leftRaw = pct(sMs);
                const rightRaw = pct(eMs);
                const visible = rightRaw >= 0 && leftRaw <= 100;
                const left = Math.max(leftRaw, 0);
                const right = Math.min(rightRaw, 100);
                const width = Math.max(right - left, 0.6);
                const days = Math.round((eMs - sMs) / DAY);
                const statusVal = statusIdx !== -1 ? it.row[statusIdx] || "" : "";
                const barStyle = resolveBarStyle(statusVal, now, sMs, eMs, statusCol?.options);
                const isFocused = focusedIdx >= 0 && visibleItems[focusedIdx]?.originalIndex === it.originalIndex;
                const progress = progressIdx !== -1 ? Math.min(100, Math.max(0, Number(it.row[progressIdx]) || 0)) : undefined;
                const previewStart = new Date(sMs).toISOString().slice(0, 10);
                const previewEnd = new Date(eMs).toISOString().slice(0, 10);
                return (
                  <div key={it.originalIndex} className={`csv-db-gantt-row ${isFocused ? "focused" : ""}`} onClick={() => handleRowClick(it.originalIndex)}>
                    <div className="csv-db-gantt-label-col">
                      <span className="csv-db-gantt-row-label" title={it.label}>{it.label}</span>
                    </div>
                    <div className="csv-db-gantt-timeline-col">
                      <div className="csv-db-gantt-grid">
                        {ticks.map((tk, i) => (<div key={i} className="csv-db-gantt-gridline" style={{ left: `${pct(tk.t)}%` }} />))}
                        {todayPct >= 0 && <div className="csv-db-gantt-today-line" style={{ left: `${todayPct}%` }} />}
                      </div>
                      {visible && (
                        <div
                          className={`csv-db-gantt-bar${isDraggingThis ? " csv-db-gantt-bar-active" : ""}`}
                          style={{ left: `${left}%`, width: `${width}%`, ...barStyle }}
                          onMouseDown={(e) => startBarDrag(e, it, "move")}
                          onMouseEnter={(e) => { if (!barDrag) showTooltip(e, it, days, statusVal); }}
                          onMouseMove={(e) => setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                          onMouseLeave={hideTooltip}
                          onContextMenu={(e) => showCtxMenu(e, it)}
                        >
                          {progress !== undefined && <div className="csv-db-gantt-bar-progress" style={{ width: `${progress}%` }} />}
                          {width > 8 && (
                            <span className="csv-db-gantt-bar-text">
                              {isDraggingThis ? `${previewStart} → ${previewEnd}` : `${days > 0 ? `${days}d` : ""}${progress !== undefined ? ` · ${progress}%` : ""}`}
                            </span>
                          )}
                          <div className="csv-db-gantt-bar-edge csv-db-gantt-bar-edge-left" onMouseDown={(e) => startBarDrag(e, it, "start")} title="Drag to change start date" />
                          <div className="csv-db-gantt-bar-edge csv-db-gantt-bar-edge-right" onMouseDown={(e) => startBarDrag(e, it, "end")} title="Drag to change end date" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="csv-db-gantt-resize-layer" style={{ left: `${labelWidth}px`, right: `${scrollbarWidth}px` }}>
        <div className="csv-db-gantt-resize-handle csv-db-gantt-resize-left" onMouseDown={startResize("left")} title="Drag to resize window start" />
        <div className="csv-db-gantt-resize-handle csv-db-gantt-resize-right" onMouseDown={startResize("right")} title="Drag to resize window end" />
      </div>

      {tooltip && (
        <div className="csv-db-gantt-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}>
          <div className="csv-db-gantt-tooltip-title">{tooltip.item.label}</div>
          <div className="csv-db-gantt-tooltip-dates">{tooltip.item.start.toISOString().slice(0, 10)} → {tooltip.item.end.toISOString().slice(0, 10)} <span>({tooltip.days}d)</span></div>
          {tooltip.statusVal && <div className="csv-db-gantt-tooltip-status">Status: {tooltip.statusVal}</div>}
          {tooltip.progress !== undefined && <div className="csv-db-gantt-tooltip-progress">Progress: {tooltip.progress}%</div>}
        </div>
      )}
      {ctxMenu && (
        <div className="csv-db-gantt-ctx" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="csv-db-gantt-ctx-item" onClick={() => { closeCtxMenu(); onCardClick(ctxMenu.item.originalIndex); }}>Open</div>
          {statusCol && statusCol.options && statusCol.options.length > 0 && (
            <div className="csv-db-gantt-ctx-sep" />
          )}
          {statusCol && statusCol.options && statusCol.options.map((opt) => (
            <div key={opt.value} className="csv-db-gantt-ctx-item" onClick={() => { closeCtxMenu(); onSetCell(ctxMenu.item.originalIndex, statusIdx, opt.value); }}>
              <span className="csv-db-gantt-ctx-dot" style={{ background: opt.color ? STATUS_COLORS[opt.color] || "var(--text-muted)" : "var(--text-muted)" }} />{opt.value}
            </div>
          ))}
          <div className="csv-db-gantt-ctx-sep" />
          <div className="csv-db-gantt-ctx-item csv-db-gantt-ctx-danger" onClick={() => { closeCtxMenu(); onDeleteRow(ctxMenu.item.originalIndex); }}>Delete</div>
        </div>
      )}
    </div>
  );
}
