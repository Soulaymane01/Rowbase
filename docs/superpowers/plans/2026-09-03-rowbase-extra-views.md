# Rowbase Extra Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three reusable views — Stats, Timeline, Dashboard — that consume the same `runQuery` result as Table/Kanban/List/Gallery/Chart.

**Architecture:** Each view is a layout in `ViewLayout` wired through `DatabaseTable.tsx` and `Toolbar.tsx` ViewMenu, reading `runQuery` rows. Pure helpers live in `src/query/` (stats aggregation, timeline ticks, habit streaks) — React/Obsidian-free and Node-testable. View components in `src/components/` render inline SVG/lists. All config lives in `ViewDef` optional fields; `.csvdb` serializes unchanged. Offline, small, theme-adaptive.

**Tech Stack:** TypeScript, React 19, `tsx --test`, Obsidian API.

## Global Constraints

- Every database uses exactly one `.csvdb` file.
- Databases open in a dedicated Obsidian view, never as SQL code blocks in notes.
- Runtime behavior is fully offline. No external script/image fetch at runtime.
- Database files remain human-readable and compatible with the selected base's storage contract.
- Query engine code (src/query/*) must NOT import React, react-dom, or obsidian.
- Save-back via originalIndex; these views are read-only except habit toggles in Dashboard.
- Keep it small — hand-rolled SVG where needed; no Chart.js.

---

### Task 1: Stats view (pure helper + component)

**Files:**
- Create: `src/query/stats.ts` — `buildStatsData(rows, columns): { byStatus: {label,count}[], byCategory: {label,count}[], avgByNumeric: {name,avg}[] }`.
- Create: `src/components/StatsView.tsx` — renders bar lists using `buildStatsData`.
- Create: `test/stats.test.ts` — 3 cases: status breakdown, category counts, average per numeric column.
- Modify: `src/query/index.ts` re-export, `src/types.ts` ViewLayout include `"stats"` (already maybe, check), `src/components/DatabaseTable.tsx` + `Toolbar.tsx`.

**Interfaces:** `StatsView` props `rows: QueryResultRow[], columns: ColumnDef[]`.
Bar rendering uses `var(--interactive-accent)` palette.

### Task 2: Timeline view (pure ticks + component)

**Files:**
- Create: `src/query/timeline.ts` — `buildTimelineTicks(rows, columns, startCol, endCol)` returns scaled positions.
- Create: `src/components/TimelineView.tsx` — horizontal time axis, one bar per row spanning start→end, today marker.
- Create: `test/timeline.test.ts` — 2 cases: bar spans, missing end treated as ongoing.
- Modify: `src/types.ts` add optional ViewDef.timelineStartCol/timelineEndCol.

### Task 3: Dashboard view (habit streaks)

**Files:**
- Create: `src/query/habits.ts` — `detectHabitColumns(columns, rows)` and `streakFor(values: string[])`.
- Create: `src/components/DashboardView.tsx` — per-habit streak card + simple calendar grid. Toggles call `onSetCell`.
- Create: `test/habits.test.ts`.
- Modify: same wiring as above.

### Task 4: Wire all three into dispatch + ViewMenu + styles and verify

- Modify: `src/components/DatabaseTable.tsx` explicit branches for stats/timeline/dashboard.
- Modify: `src/components/Toolbar.tsx` add three ViewMenu items + gating for group-by (not shown for these).
- Modify: `styles.css` add `csv-db-stats`, `csv-db-timeline`, `csv-db-dashboard` classes (theme vars).
- Modify: `package.json` add test scripts and extend `check:baseline`.
- Test: `npm run check:baseline` green.
- Manual Obsidian smoke: each view renders with sample data, no console errors.

## Plan Completion Gate

Stats/Timeline/Dashboard layouts exist, are wired, are styled, and are verified in Obsidian. `check:baseline` green. No new runtime dependency.
