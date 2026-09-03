# Rowbase Chart View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a chart layout (bar/line/pie/area) that renders from the current `runQuery` result, with X/Y/aggregation/color-by configuration stored per saved view.

**Architecture:** Charting is hand-rolled SVG (no Chart.js) to keep the plugin fully offline, small, and theme-adaptive. A pure `src/query/chart.ts` module maps `QueryResultRow[]` into a `ChartData` shape (`labels` + `series`), fully unit-testable in Node. `ChartView.tsx` is a React component that renders that shape as SVG. Chart config (type, X column, Y column, aggregation, color-by column) is added as optional fields on `ViewDef`, so it persists in the existing `.csvdb` view metadata (JSON-encoded) with no storage format change. The layout is wired through the same `activeLayout` dispatch used by Table/Kanban/List/Gallery, and the FilterSortBar/Toolbar gain chart-config controls.

**Tech Stack:** TypeScript, React 19, `tsx --test` (Node test runner), Obsidian API. SVG via inline `<svg>`/`<path>`/`<circle>`/`<rect>`.

## Global Constraints

- Every database uses exactly one `.csvdb` file.
- Databases open in a dedicated Obsidian view, never as SQL code blocks in notes.
- Runtime behavior is fully offline. No HTTP requests, WebSockets, telemetry, CDN assets, or remote service calls are allowed. Chart rendering must not load any external script/image at runtime.
- Rowbase will not depend on the upstream package at build time or runtime.
- Database files remain human-readable and compatible with the selected base's storage contract.
- Query engine code (src/query/*) must NOT import React, react-dom, or obsidian — it must be pure and unit-testable in Node.
- The chart data-mapping module (src/query/chart.ts) must be pure (no React/Obsidian/DOM) — SVG rendering lives in the React `ChartView` component.
- Save-back must write to the correct underlying row through originalIndex (charts are read-only; edits happen in Table/List/Gallery/detail).
- Keep it small — hand-rolled SVG; no new runtime dependency.

---

### Task 1: Build The Pure Chart Data Mapper

**Files:**
- Create: `src/query/chart.ts`
- Create: `test/chart.test.ts`
- Modify: `src/query/index.ts` (re-export chart helpers + types)
- Test: `tsx --test test/chart.test.ts`.

**Interfaces:**
- Produces `ChartKind = "bar" | "line" | "pie" | "area"`.
- Produces `ChartAgg = "count" | "sum" | "avg"`.
- Produces `ChartConfig = { type: ChartKind; xColumn: string; yColumn: string; agg: ChartAgg; colorByColumn?: string }`.
- Produces `ChartSeries = { name: string; values: number[] }`.
- Produces `ChartData = { labels: string[]; series: ChartSeries[] }`.
- Produces `buildChartData(rows: QueryResultRow[], columns: ColumnDef[], config: ChartConfig): ChartData`.
- Consumes: `QueryResultRow` from `./record`, `ColumnDef` from `../types`.
- Later tasks (ChartView) import `buildChartData`, `ChartData`, `ChartKind`, `ChartAgg`.

- [ ] **Step 1: Write the failing chart test**

Create `test/chart.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChartData } from "../src/query/chart.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types";

const columns: ColumnDef[] = [
  { name: "Category", type: "select", options: [
    { value: "Food", color: "red" },
    { value: "Travel", color: "blue" },
  ]},
  { name: "Amount", type: "number" },
  { name: "Date", type: "date" },
];

function row(vals: string[], i: number) {
  return resolveRow(buildRow(vals, i), columns);
}

const rows = [
  row(["Food", "10", "2024-01-01"], 0),
  row(["Travel", "20", "2024-01-02"], 1),
  row(["Food", "30", "2024-01-03"], 2),
  row(["Food", "", "2024-01-04"], 3), // empty amount → skipped for sum/avg
];

test("count aggregation on categorical X", () => {
  const data = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "count" });
  assert.deepEqual(data.labels, ["Food", "Travel"]);
  assert.equal(data.series.length, 1);
  assert.deepEqual(data.series[0].values, [3, 1]);
});

test("sum aggregation on categorical X skips empty amounts", () => {
  const data = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "sum" });
  assert.deepEqual(data.labels, ["Food", "Travel"]);
  assert.deepEqual(data.series[0].values, [40, 20]);
});

test("avg aggregation", () => {
  const data = buildChartData(rows, columns, { type: "bar", xColumn: "Category", yColumn: "Amount", agg: "avg" });
  assert.deepEqual(data.series[0].values, [20, 20]);
});

test("pie returns a single series with a value per label", () => {
  const data = buildChartData(rows, columns, { type: "pie", xColumn: "Category", yColumn: "Amount", agg: "sum" });
  assert.equal(data.series.length, 1);
  assert.deepEqual(data.labels, ["Food", "Travel"]);
  assert.deepEqual(data.series[0].values, [40, 20]);
});

test("line/area with color-by splits into one series per color value (first-appearance order)", () => {
  const cols: ColumnDef[] = [
    { name: "Category", type: "select", options: [{ value: "Food", color: "red" }, { value: "Travel", color: "blue" }] },
    { name: "Owner", type: "select", options: [{ value: "A", color: "red" }, { value: "B", color: "blue" }] },
    { name: "Amount", type: "number" },
  ];
  const r = (vals: string[], i: number) => resolveRow(buildRow(vals, i), cols);
  const data = buildChartData(
    [
      r(["Food", "A", "1"], 0),
      r(["Travel", "B", "2"], 1),
      r(["Food", "A", "3"], 2),
    ],
    cols,
    { type: "line", xColumn: "Category", yColumn: "Amount", agg: "sum", colorByColumn: "Owner" },
  );
  // X labels from Category: Food, Travel (appearance order).
  assert.deepEqual(data.labels, ["Food", "Travel"]);
  // color-by over Owner → one series per Owner value, in FIRST-APPEARANCE order (A row0, B row1).
  assert.equal(data.series.length, 2);
  assert.equal(data.series[0].name, "A");
  assert.equal(data.series[1].name, "B");
  // Owner A: Food=1+3 → [4, 0] in label order (Food, Travel).
  assert.deepEqual(data.series[0].values, [4, 0]);
  // Owner B: Travel=2 → [0, 2].
  assert.deepEqual(data.series[1].values, [0, 2]);
});

test("missing xColumn yields empty labels; non-numeric values skipped", () => {
  const data = buildChartData(rows, columns, { type: "bar", xColumn: "Nonexistent", yColumn: "Amount", agg: "sum" });
  assert.deepEqual(data.labels, []);
  assert.deepEqual(data.series[0].values, [] as number[]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npx tsx --test test/chart.test.ts
```
Expected: FAIL — `../src/query/chart.ts` does not exist.

- [ ] **Step 3: Implement `src/query/chart.ts`**

```ts
import { ColumnDef } from "../types";
import { QueryResultRow } from "./record";

export type ChartKind = "bar" | "line" | "pie" | "area";
export type ChartAgg = "count" | "sum" | "avg";

export interface ChartConfig {
  type: ChartKind;
  xColumn: string;
  yColumn: string;
  agg: ChartAgg;
  colorByColumn?: string;
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

function numberValue(cell: string | undefined): number | null {
  if (cell === undefined || cell === "") return null;
  const n = Number(cell);
  return Number.isNaN(n) ? null : n;
}

export function buildChartData(
  rows: QueryResultRow[],
  columns: ColumnDef[],
  config: ChartConfig,
): ChartData {
  const xIdx = columns.findIndex((c) => c.name === config.xColumn);
  const yIdx = config.agg === "count" ? -1 : columns.findIndex((c) => c.name === config.yColumn);

  // Determine label set from the X column's distinct values in appearance order.
  const labelOrder: string[] = [];
  const labelSeen = new Set<string>();
  for (const r of rows) {
    if (xIdx === -1) break;
    const label = r.row[xIdx] || "—";
    if (!labelSeen.has(label)) {
      labelSeen.add(label);
      labelOrder.push(label);
    }
  }
  const labels = xIdx === -1 ? [] : labelOrder;

  // If color-by is set and is a distinct column, split into one series per color value.
  const colorIdx = config.colorByColumn
    ? columns.findIndex((c) => c.name === config.colorByColumn)
    : -1;

  // Group keys: for color-by, "series|label"; else "label".
  const keyFor = (label: string, color: string) => (colorIdx === -1 ? label : `${color}\u0000${label}`);

  const seriesNames: string[] = [];
  const seriesSeen = new Set<string>();
  const aggregates = new Map<string, { count: number; sum: number; n: number }>();

  for (const r of rows) {
    const label = xIdx === -1 ? "" : (r.row[xIdx] || "—");
    const color = colorIdx === -1 ? "" : (r.row[colorIdx] || "—");
    const key = keyFor(label, color);
    let agg = aggregates.get(key);
    if (!agg) {
      agg = { count: 0, sum: 0, n: 0 };
      aggregates.set(key, agg);
      if (colorIdx !== -1 && !seriesSeen.has(color)) {
        seriesSeen.add(color);
        seriesNames.push(color);
      }
    }
    agg.count += 1;
    if (yIdx !== -1) {
      const n = numberValue(r.row[yIdx]);
      if (n !== null) { agg.sum += n; agg.n += 1; }
    }
  }

  const seriesOrder = colorIdx === -1 ? [""] : seriesNames;
  const series: ChartSeries[] = seriesOrder.map((color) => {
    const values = labels.map((label) => {
      const agg = aggregates.get(keyFor(label, color));
      if (!agg) return 0;
      if (config.agg === "count") return agg.count;
      if (config.agg === "avg") return agg.n > 0 ? agg.sum / agg.n : 0;
      return agg.sum;
    });
    return { name: color || "value", values };
  });

  return { labels, series };
}
```

Note: color-by and X are separate columns in the test above (Owner vs Category). Series names are recorded in **first-appearance order** (`A` then `B`), matching how row 0 and row 1 first introduce each Owner value. `series` is built over `seriesNames` in that order (using `push`, not `unshift`), and each series' `values` array aligns to `labels` order (outer map over `labels`, inner `aggregates.get(keyFor(label, color))`). If color-by is unset, `seriesOrder` is `[""]` and a single "value" series is returned.

- [ ] **Step 4: Run the chart test to verify it passes**

Run:
```bash
npx tsx --test test/chart.test.ts
```
Expected: PASS (all 6 tests).

- [ ] **Step 5: Re-export chart helpers from the query barrel**

In `src/query/index.ts` add:

```ts
export { buildChartData } from "./chart";
export type { ChartData, ChartSeries, ChartKind, ChartAgg, ChartConfig } from "./chart";
```

- [ ] **Step 6: Run the full query suite**

Run:
```bash
npx tsx --test test/chart.test.ts test/group.test.ts test/query-resolve.test.ts test/query-compare.test.ts test/query-filter.test.ts test/query-sort.test.ts
```
Expected: PASS.

- [ ] **Step 7: Commit**

Run:
```bash
git add src/query/chart.ts test/chart.test.ts src/query/index.ts
git diff --cached --check
git commit -m "feat(query): add pure chart data mapper"
```

---

### Task 2: Add Chart Config Fields To The View And Render Configuration UI

**Files:**
- Modify: `src/types.ts` (extend `ViewDef`)
- Modify: `src/components/ChartConfigPopover.tsx` (new)
- Test: `npm run typecheck` + manual Obsidian smoke.

**Interfaces:**
- Produces optional fields on `ViewDef`: `chartType?: ChartKind`, `chartXColumn?: string`, `chartYColumn?: string`, `chartAgg?: ChartAgg`, `chartColorByColumn?: string`.
- Produces `ChartConfigPopover` component that reads/writes those fields via an `onUpdateView` callback.
- Consumes: `ChartKind`/`ChartAgg`/`ChartConfig` types from `../query/chart`, `ViewDef`/`ColumnDef` from `../types`.

- [ ] **Step 1: Extend `ViewDef`**

In `src/types.ts`, add to `ViewDef` (after `groupByColumn?`):

```ts
export type ViewDef = {
  name: string;
  layout?: ViewLayout;
  sorts: SortRule[];
  filters: FilterRule[];
  hiddenColumns: string[];
  groupByColumn?: string;
  chartType?: "bar" | "line" | "pie" | "area";
  chartXColumn?: string;
  chartYColumn?: string;
  chartAgg?: "count" | "sum" | "avg";
  chartColorByColumn?: string;
};
```

Import the `ChartKind`/`ChartAgg` string unions inline as above (do NOT import from `../query/chart` into types.ts to keep types.ts dependency-free of the query module — the literal union is duplicated deliberately and kept in sync by the chart.test/typecheck). `.csvdb` serialization is JSON, so these optional fields round-trip unchanged.

- [ ] **Step 2: Implement `ChartConfigPopover.tsx`**

`ChartConfigPopover` shows controls for chart type, X column, Y column, aggregation, and color-by column. It renders in a portal/popover anchored in the Toolbar (like `FilterSortBar`).

```tsx
import { useMemo } from "react";
import { ColumnDef, ViewDef } from "../types";
import { ChartConfig, ChartKind, ChartAgg } from "../query/chart";

interface ChartConfigPopoverProps {
  activeView: ViewDef;
  columns: ColumnDef[];
  onUpdateView: (view: ViewDef) => void;
  onClose: () => void;
}

const CHART_KINDS: { value: ChartKind; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "pie", label: "Pie" },
  { value: "area", label: "Area" },
];
const AGGS: { value: ChartAgg; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
];

export function ChartConfigPopover({ activeView, columns, onUpdateView, onClose }: ChartConfigPopoverProps) {
  const textCols = useMemo(() => columns, [columns]);
  const numCols = useMemo(() => columns.filter((c) => c.type === "number"), [columns]);

  const set = (patch: Partial<ViewDef>) => {
    onUpdateView({ ...activeView, ...patch });
  };

  const config: ChartConfig = {
    type: activeView.chartType || "bar",
    xColumn: activeView.chartXColumn || "",
    yColumn: activeView.chartYColumn || "",
    agg: activeView.chartAgg || "count",
    colorByColumn: activeView.chartColorByColumn,
  };

  return (
    <div className="csv-db-popover csv-db-chart-config" onClick={(e) => e.stopPropagation()}>
      <div className="csv-db-chart-config-section-label">Type</div>
      <div className="csv-db-chart-config-row">
        {CHART_KINDS.map((k) => (
          <button
            key={k.value}
            className={`csv-db-chart-config-type${config.type === k.value ? " is-active" : ""}`}
            onClick={() => set({ chartType: k.value })}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="csv-db-chart-config-field">
        <label className="csv-db-chart-config-label">X (categories / dates)</label>
        <select className="csv-db-popover-select" value={config.xColumn} onChange={(e) => set({ chartXColumn: e.target.value })}>
          <option value="">—</option>
          {textCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>

      {config.agg !== "count" && (
        <div className="csv-db-chart-config-field">
          <label className="csv-db-chart-config-label">Y (value)</label>
          <select className="csv-db-popover-select" value={config.yColumn} onChange={(e) => set({ chartYColumn: e.target.value })}>
            <option value="">—</option>
            {numCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="csv-db-chart-config-field">
        <label className="csv-db-chart-config-label">Aggregation</label>
        <select className="csv-db-popover-select" value={config.agg} onChange={(e) => set({ chartAgg: e.target.value as ChartAgg })}>
          {AGGS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      <div className="csv-db-chart-config-field">
        <label className="csv-db-chart-config-label">Color by</label>
        <select
          className="csv-db-popover-select"
          value={config.colorByColumn || ""}
          onChange={(e) => set({ chartColorByColumn: e.target.value || undefined })}
        >
          <option value="">—</option>
          {columns.filter((c) => c.type === "select" || c.type === "multiselect").map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <button className="csv-db-chart-config-done" onClick={onClose}>Done</button>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/types.ts src/components/ChartConfigPopover.tsx
git diff --cached --check
git commit -m "feat(view): add chart config fields and config popover"
```

---

### Task 3: Implement The SVG Chart View

**Files:**
- Create: `src/components/ChartView.tsx`
- Test: `npm run typecheck` + manual Obsidian smoke.

**Interfaces:**
- Produces `ChartView` with props: `rows: QueryResultRow[]`, `columns: ColumnDef[]`, `displayColumns: DisplayColumn[]`, `activeView: ViewDef`, `app: App`, `onSetCell`, `onDeleteRow`, `onCardClick`.
- Consumes: `buildChartData`/`ChartData` from `../query/chart`, `ViewDef`/`ColumnDef` from `../types`.

- [ ] **Step 1: Implement `ChartView.tsx`**

`ChartView` renders `buildChartData(filteredSortedRows, columns, config)` as inline SVG. Bar = vertical bars; line = polyline; pie = arcs; area = filled polyline. Colors are drawn from the Obsidian theme `--interactive-accent` (primary series) and a small palette for extra series (color-by). A single "value" series uses the accent; multi-series use a palette of CSS vars.

```tsx
import { useMemo } from "react";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { buildChartData, ChartData, ChartConfig } from "../query/chart";

interface ChartViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

const SERIES_COLORS = [
  "var(--interactive-accent)",
  "var(--color-orange)",
  "var(--color-green)",
  "var(--color-purple)",
  "var(--color-cyan)",
  "var(--color-pink)",
];

const W = 640;
const H = 320;
const PAD = { top: 20, right: 20, bottom: 40, left: 48 };

function maxOf(series: ChartData["series"]): number {
  let m = 0;
  for (const s of series) for (const v of s.values) if (v > m) m = v;
  return m;
}

function BarChart({ data }: { data: ChartData }) {
  const max = maxOf(data) || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = data.labels.length || 1;
  const band = innerW / n;
  const barW = Math.max(2, (band * 0.6) / Math.max(1, data.series.length));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="csv-db-chart-svg" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {data.labels.map((label, li) => {
          return data.series.map((s, si) => {
            const v = s.values[li] ?? 0;
            const h = (v / max) * innerH;
            const x = li * band + si * barW + (band - barW * data.series.length) / 2;
            const y = innerH - h;
            return <rect key={`${label}-${si}`} x={x} y={y} width={barW} height={h} fill={SERIES_COLORS[si % SERIES_COLORS.length]} />;
          });
        })}
        {data.labels.map((label, li) => (
          <text key={label} x={li * band + band / 2} y={innerH + 16} textAnchor="middle" className="csv-db-chart-axis-label">{label}</text>
        ))}
      </g>
    </svg>
  );
}

function LineAreaChart({ data, area }: { data: ChartData; area: boolean }) {
  const max = maxOf(data) || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = data.labels.length;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const xFor = (li: number) => li * step;
  const yFor = (v: number) => innerH - (v / max) * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="csv-db-chart-svg" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${PAD.left},${PAD.top})`}>
        {data.series.map((s, si) => {
          const pts = s.values.map((v, li) => [xFor(li), yFor(v)] as const);
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
          const fill = area
            ? <path d={`${path} L${xFor(n - 1)},${innerH} L0,${innerH} Z`} fill={SERIES_COLORS[si % SERIES_COLORS.length]} opacity="0.25" />
            : null;
          return (
            <g key={s.name}>
              {fill}
              <path d={path} fill="none" stroke={SERIES_COLORS[si % SERIES_COLORS.length]} strokeWidth="2" />
              {pts.map((p, li) => <circle key={li} cx={p[0]} cy={p[1]} r="3" fill={SERIES_COLORS[si % SERIES_COLORS.length]} />)}
            </g>
          );
        })}
        {data.labels.map((label, li) => (
          <text key={label} x={xFor(li)} y={innerH + 16} textAnchor="middle" className="csv-db-chart-axis-label">{label}</text>
        ))}
      </g>
    </svg>
  );
}

function PieChart({ data }: { data: ChartData }) {
  const values = data.series[0]?.values ?? [];
  const total = values.reduce((a, b) => a + b, 0);
  const cx = W / 2; const cy = H / 2; const r = Math.min(W, H) / 2 - 30;
  let angle = -Math.PI / 2;
  const arcs = values.map((v, i) => {
    const frac = total > 0 ? v / total : 0;
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    const x1 = cx + r * Math.cos(start); const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end); const y2 = cy + r * Math.sin(end);
    const large = frac > 0.5 ? 1 : 0;
    const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
    return <path key={i} d={d} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="csv-db-chart-svg" preserveAspectRatio="xMidYMid meet">
      <g transform={`translate(${PAD.left - PAD.right},0)`}>{arcs}</g>
    </svg>
  );
}

export function ChartView({ rows, columns, displayColumns, activeView, onSetCell, onDeleteRow, onCardClick }: ChartViewProps) {
  const data = useMemo(() => {
    const config: ChartConfig = {
      type: activeView.chartType || "bar",
      xColumn: activeView.chartXColumn || "",
      yColumn: activeView.chartYColumn || "",
      agg: activeView.chartAgg || "count",
      colorByColumn: activeView.chartColorByColumn,
    };
    return buildChartData(rows, columns, config);
  }, [rows, columns, activeView]);

  if (!data.labels.length) {
    return (
      <div className="csv-db-chart-empty">
        <p>Pick an X column (and optionally a Y value) in the chart settings.</p>
      </div>
    );
  }

  const kind = activeView.chartType || "bar";
  return (
    <div className="csv-db-chart-scroll">
      <div className="csv-db-chart">
        {kind === "bar" && <BarChart data={data} />}
        {kind === "pie" && <PieChart data={data} />}
        {kind === "line" && <LineAreaChart data={data} area={false} />}
        {kind === "area" && <LineAreaChart data={data} area={true} />}
      </div>
    </div>
  );
}
```

`onSetCell`/`onDeleteRow`/`onCardClick` are accepted for interface consistency (charts are read-only; edits happen elsewhere). Do not delete them.

- [ ] **Step 2: Run typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 3: Commit**

Run:
```bash
git add src/components/ChartView.tsx
git diff --cached --check
git commit -m "feat(view): add svg chart view (bar/line/pie/area)"
```

---

### Task 4: Wire Chart Into The Layout Dispatch, View Menu, And Toolbar

**Files:**
- Modify: `src/components/DatabaseTable.tsx` (dispatch)
- Modify: `src/components/Toolbar.tsx` (chart layout menu item + config popover trigger)
- Modify: `src/components/ViewBar.tsx` (only if needed — verify it does not hardcode layout types)
- Test: `npm run typecheck && npm run build && npm run test:offline`.

**Interfaces:**
- Produces `activeLayout === "chart"` routing to `ChartView`.
- Produces a Chart menu item in the ViewMenu and a "Chart settings" trigger opening `ChartConfigPopover`.
- `ViewLayout` widened to include `"chart"`.

- [ ] **Step 1: Widen `ViewLayout`**

In `src/types.ts`:

```ts
export type ViewLayout = "table" | "kanban" | "list" | "gallery" | "chart";
```

- [ ] **Step 2: Add chart branch to the layout dispatch in `DatabaseTable.tsx`**

Add a `chart` branch to the layout `if/else` chain (it currently routes table/kanban/list/gallery). Use `ChartView`:

```tsx
import { ChartView } from "./ChartView";
```

```tsx
      ) : activeLayout === "chart" ? (
        <ChartView
          rows={filteredSortedRows}
          columns={model.columns}
          displayColumns={displayColumns}
          activeView={activeView}
          onSetCell={handleSetCell}
          onDeleteRow={handleDeleteRow}
          onCardClick={handleCardClick}
        />
      ) : (
        <GalleryView ... />
      )}
```

(The chart branch can be placed before the Gallery else; the exact ordering must keep Gallery as the fallback only if `activeLayout === "gallery"`, otherwise convert the chain to explicit branches for each layout. Prefer explicit branches: table, kanban, list, gallery, chart, else table for unknown.)

- [ ] **Step 3: Add Chart menu item + settings trigger to `Toolbar.tsx`**

In `ViewMenu`, after the Gallery item, add:

```tsx
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("chart")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "chart" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Chart
      </div>
```

In the main `Toolbar` component (the outer one that renders the view-options button), add a "Chart settings" action that opens `ChartConfigPopover`. If the toolbar already has a per-layout settings trigger, reuse it; otherwise add a small button that appears when `activeLayout === "chart"` and toggles `ChartConfigPopover` (rendered in a portal to `activeDocument.body`, anchored near the button), passing `onUpdateView` and `onClose`.

Concretely, add local state `chartConfigOpen` and a trigger alongside the existing filters/sort buttons. Use a ref for the anchor rect. Render:

```tsx
{chartConfigOpen && (
  <ChartConfigPopover
    activeView={activeView}
    columns={columns}
    onUpdateView={(view) => onUpdateView(activeViewIndex, view)}
    onClose={() => setChartConfigOpen(false)}
  />
)}
```

The exact anchor/portal mechanics should follow the existing `SortEditor`/`FilterSortBar` popover pattern already in the toolbar.

- [ ] **Step 4: Run typecheck, build, and offline**

Run:
```bash
npm run typecheck && npm run build && npm run test:offline
```
Expected: PASS.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/components/DatabaseTable.tsx src/components/Toolbar.tsx src/types.ts
git diff --cached --check
git commit -m "feat(view): wire chart layout into dispatch and toolbar"
```

---

### Task 5: Add Chart Styles And Verify In Obsidian

**Files:**
- Modify: `styles.css`
- Create: `docs/superpowers/verification/2026-09-03-rowbase-chart.md`
- Test: manual Obsidian smoke + `npm run check:baseline`.

**Interfaces:**
- Produces CSS classes: `csv-db-chart-scroll`, `csv-db-chart`, `csv-db-chart-svg`, `csv-db-chart-empty`, `csv-db-chart-axis-label`, `csv-db-chart-config`, `csv-db-chart-config-section-label`, `csv-db-chart-config-row`, `csv-db-chart-config-type`, `csv-db-chart-config-type.is-active`, `csv-db-chart-config-field`, `csv-db-chart-config-label`, `csv-db-chart-config-done`.

- [ ] **Step 1: Add chart styles**

Append to `styles.css`, using theme variables:

```css
.csv-db-chart-scroll { overflow: auto; height: 100%; padding: 0; }
.csv-db-chart { padding: 12px; display: flex; justify-content: center; }
.csv-db-chart-svg { max-width: 100%; height: auto; }
.csv-db-chart-axis-label { font-size: 11px; fill: var(--text-muted); }
.csv-db-chart-empty { color: var(--text-muted); text-align: center; padding: 40px; }

.csv-db-chart-config { width: 260px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.csv-db-chart-config-section-label { font-weight: 600; font-size: 0.85em; color: var(--text-muted); }
.csv-db-chart-config-row { display: flex; gap: 6px; }
.csv-db-chart-config-type { flex: 1; padding: 6px 4px; border-radius: 4px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer; }
.csv-db-chart-config-type.is-active { border-color: var(--interactive-accent); background: var(--background-secondary); }
.csv-db-chart-config-field { display: flex; flex-direction: column; gap: 4px; }
.csv-db-chart-config-label { font-size: 0.85em; color: var(--text-muted); }
.csv-db-chart-config-done { align-self: flex-end; padding: 6px 12px; border-radius: 4px; border: 1px solid var(--background-modifier-border); background: var(--background-primary); cursor: pointer; }
```

- [ ] **Step 2: Add `test:chart` to `package.json` and wire into the gate**

Modify `package.json`:

```json
"test:chart": "tsx --test test/chart.test.ts"
```

And extend `check:baseline` to include it:

```json
"check:baseline": "npm run typecheck && npm run test:metadata && npm run test:csvdb && npm run test:query && npm run test:chart && npm run build && npm run test:offline"
```

Run:
```bash
npm run check:baseline
```
Expected: all green.

- [ ] **Step 3: Rebuild and reload Obsidian**

Run:
```bash
npm run build
```
Reload Obsidian in `$HOME/rowbase-dev-vault`. Confirm no console errors and the View menu shows **Chart**.

- [ ] **Step 4: Verify bar/line/pie/area**

Switch a `.csvdb` to Chart. In Chart settings, pick an X column (a select/text category) and a Y numeric column with `sum`/`avg`, and confirm Bar renders with one bar per category. Switch to Line, Pie, and Area and confirm each renders. Set Aggregation = Count and confirm Y is unused (bars count rows per category). Set Color by to a select column and confirm multi-series colors.

- [ ] **Step 5: Verify chart is read-only and other views unaffected**

Confirm clicking a chart does not edit data; edits still happen via Table/List/Gallery/detail. Confirm Table/Kanban/List/Gallery still work. Confirm save-view persists chart config (switch away and back, reload the file).

- [ ] **Step 6: Run the baseline gate and commit verification notes**

Run:
```bash
npm run check:baseline
```
Expected: all green. Then create `docs/superpowers/verification/2026-09-03-rowbase-chart.md` documenting the steps/results, and commit:

```bash
git add styles.css package.json docs/superpowers/verification/2026-09-03-rowbase-chart.md
git diff --cached --check
git commit -m "test: verify chart view in Obsidian"
```

## Plan Completion Gate

Phase 4 is complete when:

- `src/query/chart.ts` provides pure `buildChartData` (unit-tested) and is re-exported from the query barrel.
- `ViewDef`/`ViewLayout` carry optional chart config and `"chart"`; `.csvdb` serializes unchanged.
- `ChartView` renders bar/line/pie/area as inline SVG from `buildChartData`, read-only, theme-adaptive.
- Chart config UI (type/X/Y/agg/color-by) persists per saved view.
- Chart wired into layout dispatch and View menu.
- Styles added; `npm run check:baseline` green (incl. `test:chart`); offline audit passes.
- Obsidian smoke confirms all four chart types, color-by, read-only behavior, and unaffected existing views.

The next plan (Phase 5: formula + rollup columns) starts after this gate.
