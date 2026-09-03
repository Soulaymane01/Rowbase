# Rowbase List And Gallery Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add List and Gallery as first-class switchable layouts that consume the same `runQuery` result as Table/Kanban, sharing a pure grouping helper with Kanban.

**Architecture:** `ViewLayout` already drives which layout renders; today it is a ternary (table vs kanban) in `DatabaseTable.tsx`. Phase 3 widens `ViewLayout` to `"table" | "kanban" | "list" | "gallery"`, extracts Kanban's grouping algorithm into a pure `src/query/group.ts` helper (unit-testable, React/Obsidian-free), and adds `ListView` (compact grouped, collapsible sections) and `GalleryView` (card grid, cover image, selectable → RowDetailModal). Both consume `runQuery(model, activeView)` rows and write through the existing `originalIndex`-keyed handlers, so save-back stays correct. No storage/format change — `ViewDef.layout` widens but `.csvdb` serializes unchanged.

**Tech Stack:** TypeScript, React 19, `tsx --test` (Node test runner), Obsidian API.

## Global Constraints

- Every database uses exactly one `.csvdb` file.
- Databases open in a dedicated Obsidian view, never as SQL code blocks in notes.
- Runtime behavior is fully offline. No HTTP requests, WebSockets, telemetry, CDN assets, or remote service calls are allowed.
- Rowbase will not depend on the upstream package at build time or runtime.
- Database files remain human-readable and compatible with the selected base's storage contract.
- Query engine code (src/query/*) must NOT import React, react-dom, or obsidian — it must be pure and unit-testable in Node.
- Save-back must write to the correct underlying row through `originalIndex` (a structural superset on `QueryResultRow`).
- Keep it small — reuse existing components/props; don't duplicate Kanban grouping.

---

### Task 1: Extract A Pure Grouping Helper And Refactor Kanban On To It

**Files:**
- Create: `src/query/group.ts`
- Create: `test/group.test.ts`
- Modify: `src/components/KanbanView.tsx`
- Modify: `src/query/index.ts` (re-export `groupRowsBySelect`)
- Test: `tsx --test test/group.test.ts` + existing query tests.

**Interfaces:**
- Produces `Group = { groupValue: string; option: SelectOption | null; rows: QueryResultRow[] }`.
- Produces `groupRowsBySelect(rows: QueryResultRow[], columns: ColumnDef[], groupByColumn: string | undefined): Group[]`.
- Consumes: `QueryResultRow` from `./record`, `ColumnDef`/`SelectOption` from `../types`.
- Later tasks (ListView) import `groupRowsBySelect`.

- [ ] **Step 1: Write the failing group test**

Create `test/group.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { groupRowsBySelect } from "../src/query/group.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef } from "../src/types";

const columns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Status", type: "select", options: [
    { value: "Todo", color: "red" },
    { value: "Done", color: "green" },
  ]},
];

function row(vals: string[], originalIndex: number) {
  return resolveRow(buildRow(vals, originalIndex), columns);
}

test("groups in option order, then a trailing 'No value' group", () => {
  const rows = [
    row(["A", "Done"], 0),
    row(["B", "Todo"], 1),
    row(["C", ""], 2),
  ];
  const groups = groupRowsBySelect(rows, columns, "Status");
  assert.deepEqual(groups.map((g) => g.groupValue), ["Todo", "Done", ""]);
  assert.equal(groups[0].option?.value, "Todo");
  assert.equal(groups[0].rows.length, 1);
  assert.equal(groups[0].rows[0].originalIndex, 1);
  assert.equal(groups[2].groupValue, "");
  assert.equal(groups[2].rows[0].originalIndex, 2);
});

test("orphaned values (in data, not options) fall into the 'No value' group", () => {
  const rows = [row(["X", "Archived"], 0)];
  const groups = groupRowsBySelect(rows, columns, "Status");
  assert.equal(groups.length, 3); // Todo, Done, "" group
  assert.equal(groups[2].rows[0].originalIndex, 0);
});

test("returns empty array when groupByColumn missing or not a select or not present", () => {
  assert.deepEqual(groupRowsBySelect(row([], 0) ? [row(["A", "Todo"], 0)] : [], columns, undefined), []);
  assert.deepEqual(groupRowsBySelect([row(["A", "Todo"], 0)], columns, "Name"), []);
  assert.deepEqual(groupRowsBySelect([row(["A", "Todo"], 0)], columns, "Nonexistent"), []);
});

test("single empty group omitted when no rows are ungrouped", () => {
  const rows = [row(["A", "Todo"], 0), row(["B", "Done"], 1)];
  const groups = groupRowsBySelect(rows, columns, "Status");
  assert.deepEqual(groups.map((g) => g.groupValue), ["Todo", "Done"]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npx tsx --test test/group.test.ts
```
Expected: FAIL — `../src/query/group.ts` does not exist.

- [ ] **Step 3: Implement `src/query/group.ts`**

```ts
import { ColumnDef, SelectOption } from "../types";
import { QueryResultRow } from "./record";

export interface Group {
  groupValue: string;
  option: SelectOption | null;
  rows: QueryResultRow[];
}

export function groupRowsBySelect(
  rows: QueryResultRow[],
  columns: ColumnDef[],
  groupByColumn: string | undefined,
): Group[] {
  if (!groupByColumn) return [];
  const dataIdx = columns.findIndex((c) => c.name === groupByColumn);
  if (dataIdx === -1) return [];
  const col = columns[dataIdx];
  if (col.type !== "select") return [];

  const options = col.options || [];
  const groupMap = new Map<string, QueryResultRow[]>();
  for (const opt of options) groupMap.set(opt.value, []);
  groupMap.set("", []);

  for (const entry of rows) {
    const cellValue = entry.row[dataIdx] || "";
    const bucket = groupMap.get(cellValue);
    if (bucket) {
      bucket.push(entry);
    } else {
      // Orphaned value not in options → "No value"
      groupMap.get("")!.push(entry);
    }
  }

  const result: Group[] = [];
  for (const opt of options) {
    result.push({ groupValue: opt.value, option: opt, rows: groupMap.get(opt.value)! });
  }
  const noValueRows = groupMap.get("")!;
  if (noValueRows.length > 0) {
    result.push({ groupValue: "", option: null, rows: noValueRows });
  }
  return result;
}
```

- [ ] **Step 4: Refactor `KanbanView.tsx` to consume `groupRowsBySelect`**

In `KanbanView.tsx`: remove the module-local `groups` `useMemo` body (lines ~39-89) and replace it with a typed call. Change the `rows` prop type to `QueryResultRow[]` (import it from `../query/record`) and group directly — no `as any`:

```ts
import { groupRowsBySelect } from "../query/group";
import { QueryResultRow } from "../query/record";
```

```ts
  const groups = useMemo(() => {
    return groupRowsBySelect(rows as QueryResultRow[], columns, groupByColumn);
  }, [rows, columns, groupByColumn]);
```

`groupRowsBySelect` returns `Group[]` omitting the empty "No value" group when there are no ungrouped rows, matching the previous behavior. `KanbanColumn` only reads `row` and `originalIndex`, so the `QueryResultRow` fields `id`/`values` are a structural superset — accepted.

After the refactor, `KanbanView` should still group in option order with a trailing "No value" group, and dragging between columns still calls `onSetCell(rowOriginalIndex, groupByInfo.dataIdx, targetGroupValue)`.

- [ ] **Step 5: Re-export `groupRowsBySelect` from the query barrel**

In `src/query/index.ts` add:

```ts
export { groupRowsBySelect } from "./group";
export type { Group } from "./group";
```

- [ ] **Step 6: Run the group test and the existing query suite**

Run:
```bash
npx tsx --test test/group.test.ts
npx tsx --test test/query-resolve.test.ts test/query-compare.test.ts test/query-filter.test.ts test/query-sort.test.ts
```
Expected: PASS. Kanban behavior unchanged (verified manually in Obsidian later).

- [ ] **Step 7: Run the baseline gate**

Run:
```bash
npm run typecheck && npm run build && npm run test:offline
```
Expected: PASS.

- [ ] **Step 8: Commit**

Run:
```bash
git add src/query/group.ts test/group.test.ts src/components/KanbanView.tsx src/query/index.ts
git diff --cached --check
git commit -m "feat(query): extract shared grouping helper, refactor kanban"
```

---

### Task 2: Add The List View

**Files:**
- Create: `src/components/ListView.tsx`
- Modify: `src/components/DatabaseTable.tsx` (layout dispatch)
- Modify: `src/components/Toolbar.tsx` (ViewMenu: add List option)
- Modify: `src/types.ts` (extend `ViewLayout`)
- Test: `npm run typecheck` + manual Obsidian smoke.

**Interfaces:**
- Produces `ListView` component with props: `rows: QueryResultRow[]`, `columns: ColumnDef[]`, `displayColumns: DisplayColumn[]`, `activeView: ViewDef`, `onSetCell`, `onDeleteRow`, `onCardClick`.
- Consumes: `runQuery` result (already computed in `DatabaseTable`), `groupRowsBySelect` from `../query/group`.
- `ViewLayout` widens to include `"list"`; `ViewDef.layout` persists unchanged.

- [ ] **Step 1: Extend `ViewLayout`**

In `src/types.ts`:

```ts
export type ViewLayout = "table" | "kanban" | "list" | "gallery";
```

- [ ] **Step 2: Implement `ListView.tsx`**

`ListView` is a compact grouped view with collapsible sections. When `activeView.groupByColumn` is a select, it shows collapsible groups (option order + "No value"); otherwise it's a flat list. Each row is a compact line showing the title (first visible column) plus a small property preview, and clicking it opens `onCardClick(originalIndex)`. Row deletion via a small ✕.

```tsx
import { useState, useCallback } from "react";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { groupRowsBySelect } from "../query/group";
import { splitMultiSelect } from "../csv-parser";
import { splitRelationValue } from "../relation-utils";
import { Tag } from "./Tag";
import { RelationPill } from "./RelationPill";

interface ListViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

function renderPreview(value: string, col: ColumnDef): React.ReactNode {
  if (!value) return null;
  if (col.type === "select") {
    const opt = col.options?.find((o) => o.value === value);
    return <Tag value={value} color={opt?.color || "gray"} />;
  }
  if (col.type === "multiselect") {
    return (
      <span className="csv-db-list-props">
        {splitMultiSelect(value).map((v) => {
          const opt = col.options?.find((o) => o.value === v);
          return <Tag key={v} value={v} color={opt?.color || "gray"} />;
        })}
      </span>
    );
  }
  if (col.type === "relation") {
    return (
      <span className="csv-db-list-props">
        {splitRelationValue(value, col).map((v) => <RelationPill key={v} value={v} />)}
      </span>
    );
  }
  return <span>{value}</span>;
}

interface RowLineProps {
  row: QueryResultRow;
  displayColumns: DisplayColumn[];
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

function RowLine({ row, displayColumns, onDeleteRow, onCardClick }: RowLineProps) {
  const titleCol = displayColumns[0];
  const titleValue = titleCol ? row.row[titleCol.dataIdx] : "";
  const props = displayColumns.slice(1);

  return (
    <div
      className="csv-db-list-row"
      data-row-index={row.originalIndex}
      onClick={() => onCardClick(row.originalIndex)}
    >
      <span className="csv-db-list-title">{titleValue || "Untitled"}</span>
      <span className="csv-db-list-props">
        {props.map(({ col, dataIdx }) => {
          const rendered = renderPreview(row.row[dataIdx], col);
          return rendered ? <span key={col.name} className="csv-db-list-prop">{rendered}</span> : null;
        })}
      </span>
      <span
        className="csv-db-list-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteRow(row.originalIndex);
        }}
      >
        ✕
      </span>
    </div>
  );
}

export function ListView({
  rows,
  columns,
  displayColumns,
  activeView,
  onSetCell,
  onDeleteRow,
  onCardClick,
}: ListViewProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = useCallback((groupValue: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupValue)) next.delete(groupValue);
      else next.add(groupValue);
      return next;
    });
  }, []);

  const groupByColumn = activeView.groupByColumn;
  const groups = groupRowsBySelect(rows, columns, groupByColumn);

  if (groups.length === 0) {
    return (
      <div className="csv-db-list-scroll">
        <div className="csv-db-list">
          {rows.map((r) => (
            <RowLine
              key={r.originalIndex}
              row={r}
              displayColumns={displayColumns}
              onDeleteRow={onDeleteRow}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="csv-db-list-scroll">
      <div className="csv-db-list">
        {groups.map((g) => {
          const label = g.groupValue || "No value";
          const isCollapsed = collapsed.has(g.groupValue);
          return (
            <div key={g.groupValue} className="csv-db-list-group">
              <div
                className="csv-db-list-group-header"
                onClick={() => toggle(g.groupValue)}
              >
                <span className="csv-db-list-chevron">{isCollapsed ? "▸" : "▾"}</span>
                <span className="csv-db-list-group-label">{label}</span>
                <span className="csv-db-list-group-count">{g.rows.length}</span>
              </div>
              {!isCollapsed && (
                <div className="csv-db-list-group-body">
                  {g.rows.map((r) => (
                    <RowLine
                      key={r.originalIndex}
                      row={r}
                      displayColumns={displayColumns}
                      onDeleteRow={onDeleteRow}
                      onCardClick={onCardClick}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

`onSetCell` is accepted in the props but not yet used inline in ListView — keep it in the props signature for interface consistency with KanbanView (it is used by Kanban drag; List's future inline editing would use it). Mark it with an eslint `@typescript-eslint/no-unused-vars` exemption only if the lint tooling flags it; otherwise leave it.

- [ ] **Step 3: Add List to the layout dispatch in `DatabaseTable.tsx`**

Change the ternary (currently `activeLayout === "table" ? ... : <KanbanView .../>`, lines ~735-786) into a `switch`:

```tsx
import { ListView } from "./ListView";
```

```tsx
      {activeLayout === "table" ? (
        /* existing table JSX unchanged */
      ) : activeLayout === "kanban" ? (
        <KanbanView ... />
      ) : activeLayout === "list" ? (
        <ListView
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

The Gallery branch is added in Task 3; until then use it as a placeholder only if needed, or add List and leave the `else` as Kanban until Gallery lands in the next task (do not ship a broken else). Prefer to add Gallery in Task 3 and complete the dispatch then; keep List working now by making the `else` render Kanban until Gallery exists.

- [ ] **Step 4: Add a List entry to the Toolbar ViewMenu**

In `src/components/Toolbar.tsx` `ViewMenu`, after the Board item (line ~263), add:

```tsx
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("list")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "list" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}List
      </div>
      <div
        className="csv-db-view-menu-item"
        onClick={() => setLayout("gallery")}
      >
        <span className="csv-db-view-menu-check">{activeLayout === "gallery" ? "✓" : "\u00A0\u00A0"}</span>
        {" "}Gallery
      </div>
```

- [ ] **Step 5: Run typecheck and build**

Run:
```bash
npm run typecheck && npm run build
```
Expected: PASS.

- [ ] **Step 6: Commit (tasks 2 + its Toolbar/dispatch wiring)**

Run:
```bash
git add src/types.ts src/components/ListView.tsx src/components/DatabaseTable.tsx src/components/Toolbar.tsx
git diff --cached --check
git commit -m "feat(view): add list layout with collapsible groups"
```

---

### Task 3: Add The Gallery View

**Files:**
- Create: `src/components/GalleryView.tsx`
- Modify: `src/components/DatabaseTable.tsx` (complete the dispatch: replace the placeholder else)
- Test: `npm run typecheck` + manual Obsidian smoke.

**Interfaces:**
- Produces `GalleryView` with props: `rows: QueryResultRow[]`, `columns: ColumnDef[]`, `displayColumns: DisplayColumn[]`, `activeView: ViewDef`, `app: App`, `onSetCell`, `onDeleteRow`, `onCardClick`.
- Consumes: `runQuery` result, `useApp()` for vault resource resolution of cover images.

- [ ] **Step 1: Implement `GalleryView.tsx`**

`GalleryView` is a responsive card grid. Each card shows a cover image (resolved from a detected cover column), a title (first visible column), and selectable property chips. Clicking a card calls `onCardClick(originalIndex)`. Cover resolution: if the cell value is an `http(s)` URL, use it directly; else treat it as a vault path and resolve via `app.vault.getResourcePath(file)`; if unresolvable, show a cover placeholder or omit.

```tsx
import { useCallback, useMemo } from "react";
import { App } from "obsidian";
import { ColumnDef, DisplayColumn, ViewDef } from "../types";
import { QueryResultRow } from "../query/record";
import { splitMultiSelect } from "../csv-parser";
import { splitRelationValue } from "../relation-utils";
import { useApp } from "../AppContext";
import { Tag } from "./Tag";
import { RelationPill } from "./RelationPill";

interface GalleryViewProps {
  rows: QueryResultRow[];
  columns: ColumnDef[];
  displayColumns: DisplayColumn[];
  activeView: ViewDef;
  onSetCell: (rowIdx: number, colIdx: number, value: string) => void;
  onDeleteRow: (rowIdx: number) => void;
  onCardClick: (rowOriginalIndex: number) => void;
}

const IMG_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"];

function detectCoverColumn(columns: ColumnDef[]): ColumnDef | null {
  const nameMatch = columns.find((c) => /^(cover|image|photo|img|poster|thumbnail|thumb)$/i.test(c.name.trim()));
  if (nameMatch) return nameMatch;
  return columns.find((c) => c.type === "url" || c.type === "link") ?? null;
}

function CardCover({ value, col, app }: { value: string; col: ColumnDef | null; app: App }) {
  const src = useMemo(() => {
    if (!value || !col) return null;
    if (/^https?:\/\//.test(value)) return value;
    const file = app.vault.getFiles().find((f) => f.path === value || f.name === value || f.basename === value);
    if (file && IMG_EXTS.includes(file.extension)) return app.vault.getResourcePath(file);
    return null;
  }, [value, col, app]);
  if (!src) return <div className="csv-db-gallery-cover csv-db-gallery-cover-empty" />;
  return (
    <div className="csv-db-gallery-cover">
      <img src={src} alt="" className="csv-db-gallery-cover-img" />
    </div>
  );
}

function renderProp(value: string, col: ColumnDef): React.ReactNode {
  if (!value) return null;
  if (col.type === "select") {
    const opt = col.options?.find((o) => o.value === value);
    return <Tag value={value} color={opt?.color || "gray"} />;
  }
  if (col.type === "multiselect") {
    return (
      <span className="csv-db-gallery-props">
        {splitMultiSelect(value).map((v) => {
          const opt = col.options?.find((o) => o.value === v);
          return <Tag key={v} value={v} color={opt?.color || "gray"} />;
        })}
      </span>
    );
  }
  if (col.type === "relation") {
    return (
      <span className="csv-db-gallery-props">
        {splitRelationValue(value, col).map((v) => <RelationPill key={v} value={v} />)}
      </span>
    );
  }
  return <span>{value}</span>;
}

export function GalleryView({
  rows,
  columns,
  displayColumns,
  activeView,
  onSetCell,
  onDeleteRow,
  onCardClick,
}: GalleryViewProps) {
  const app = useApp();
  const coverCol = detectCoverColumn(columns);
  const titleCol = displayColumns[0];
  const propCols = displayColumns.slice(1);

  return (
    <div className="csv-db-gallery-scroll">
      <div className="csv-db-gallery">
        {rows.map((r) => {
          const coverValue = coverCol ? r.row[columns.findIndex((c) => c.name === coverCol.name)] : "";
          const titleValue = titleCol ? r.row[titleCol.dataIdx] : "";
          return (
            <div
              key={r.originalIndex}
              className="csv-db-gallery-card"
              data-row-index={r.originalIndex}
              onClick={() => onCardClick(r.originalIndex)}
            >
              <CardCover value={coverValue} col={coverCol} app={app} />
              <div className="csv-db-gallery-card-body">
                <div className="csv-db-gallery-title">{titleValue || "Untitled"}</div>
                <div className="csv-db-gallery-props">
                  {propCols.map(({ col, dataIdx }) => {
                    const rendered = renderProp(r.row[dataIdx], col);
                    return rendered ? <span key={col.name} className="csv-db-gallery-prop">{rendered}</span> : null;
                  })}
                </div>
              </div>
              <span
                className="csv-db-gallery-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRow(r.originalIndex);
                }}
              >
                ✕
              </span>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="csv-db-gallery-empty">No records match the current view.</div>
        )}
      </div>
    </div>
  );
}
```

`onSetCell` is accepted for interface consistency; card click opens the RowDetailModal (edit there), so inline editing is not required in the card grid. Keep it in the props signature.

- [ ] **Step 2: Complete the layout dispatch in `DatabaseTable.tsx`**

Replace the placeholder `else` (Kanban) with the full gallery branch:

```tsx
import { GalleryView } from "./GalleryView";
```

```tsx
      ) : (
        <GalleryView
          rows={filteredSortedRows}
          columns={model.columns}
          displayColumns={displayColumns}
          activeView={activeView}
          onSetCell={handleSetCell}
          onDeleteRow={handleDeleteRow}
          onCardClick={handleCardClick}
        />
      )}
```

`GalleryView` uses `useApp()` from `../AppContext` (already provided by the `AppContext.Provider` wrapping the layout in `DatabaseTable`), so it does not need an `app` prop.

- [ ] **Step 3: Run typecheck and build**

Run:
```bash
npm run typecheck && npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/components/GalleryView.tsx src/components/DatabaseTable.tsx
git diff --cached --check
git commit -m "feat(view): add gallery layout with cover cards"
```

---

### Task 4: Add List And Gallery Styles

**Files:**
- Modify: `styles.css`
- Test: build + manual Obsidian smoke.

**Interfaces:**
- Produces CSS classes: `csv-db-list-scroll`, `csv-db-list`, `csv-db-list-group`, `csv-db-list-group-header`, `csv-db-list-chevron`, `csv-db-list-group-label`, `csv-db-list-group-count`, `csv-db-list-group-body`, `csv-db-list-row`, `csv-db-list-title`, `csv-db-list-props`, `csv-db-list-prop`, `csv-db-list-delete`, and gallery equivalents (`csv-db-gallery-scroll`, `csv-db-gallery`, `csv-db-gallery-card`, `csv-db-gallery-cover`, `csv-db-gallery-cover-img`, `csv-db-gallery-cover-empty`, `csv-db-gallery-card-body`, `csv-db-gallery-title`, `csv-db-gallery-props`, `csv-db-gallery-prop`, `csv-db-gallery-delete`, `csv-db-gallery-empty`).

- [ ] **Step 1: Add list styles**

Append to `styles.css`, matching the existing theme-variable-based conventions (use the same border-radius, spacing, and `var(--...)` surface colors already used by `.csv-db-kanban-card`):

```css
.csv-db-list-scroll { overflow: auto; height: 100%; padding: 12px; }
.csv-db-list { display: flex; flex-direction: column; gap: 4px; max-width: 720px; }
.csv-db-list-group { border: 1px solid var(--background-modifier-border); border-radius: 6px; overflow: hidden; }
.csv-db-list-group-header { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; font-weight: 600; background: var(--background-secondary); }
.csv-db-list-chevron { width: 12px; }
.csv-db-list-group-label { flex: 1; }
.csv-db-list-group-count { color: var(--text-muted); font-size: 0.85em; }
.csv-db-list-group-body { display: flex; flex-direction: column; }
.csv-db-list-row { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-top: 1px solid var(--background-modifier-border); cursor: pointer; }
.csv-db-list-row:hover, .csv-db-list-row.is-selected { background: var(--background-modifier-hover); }
.csv-db-list-title { font-weight: 500; min-width: 140px; }
.csv-db-list-props { display: flex; flex-wrap: wrap; gap: 6px; }
.csv-db-list-prop { }
.csv-db-list-delete { margin-left: auto; opacity: 0; cursor: pointer; color: var(--text-muted); }
.csv-db-list-row:hover .csv-db-list-delete { opacity: 0.7; }
```

- [ ] **Step 2: Add gallery styles**

```css
.csv-db-gallery-scroll { overflow: auto; height: 100%; padding: 12px; }
.csv-db-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.csv-db-gallery-card { position: relative; border: 1px solid var(--background-modifier-border); border-radius: 8px; overflow: hidden; cursor: pointer; background: var(--background-primary); }
.csv-db-gallery-card:hover { border-color: var(--interactive-accent); }
.csv-db-gallery-cover { height: 120px; width: 100%; }
.csv-db-gallery-cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.csv-db-gallery-cover-empty { background: var(--background-secondary); }
.csv-db-gallery-card-body { padding: 8px 10px; }
.csv-db-gallery-title { font-weight: 600; margin-bottom: 6px; }
.csv-db-gallery-props { display: flex; flex-wrap: wrap; gap: 6px; }
.csv-db-gallery-prop { }
.csv-db-gallery-delete { position: absolute; top: 6px; right: 6px; background: var(--background-primary); border-radius: 4px; padding: 2px 6px; opacity: 0; cursor: pointer; color: var(--text-muted); }
.csv-db-gallery-card:hover .csv-db-gallery-delete { opacity: 0.8; }
.csv-db-gallery-empty { grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 32px; }
```

- [ ] **Step 3: Build and run the baseline gate**

Run:
```bash
npm run build && npm run test:offline
```
Expected: PASS.

- [ ] **Step 4: Add styles to the verification scope and commit**

Run:
```bash
git add styles.css
git diff --cached --check
git commit -m "style(view): add list and gallery layout styles"
```

---

### Task 5: Verify List And Gallery In Obsidian

**Files:**
- Create: `docs/superpowers/verification/2026-09-03-rowbase-list-gallery.md`
- Test: manual Obsidian smoke in `$HOME/rowbase-dev-vault`.

**Interfaces:**
- Confirms both layouts render, group, collapse, open detail, edit persists, and save-back writes to the correct row.

- [ ] **Step 1: Rebuild and reload**

Run:
```bash
npm run build
```
Reload Obsidian in `$HOME/rowbase-dev-vault`. Confirm no console errors and the View menu now shows List and Gallery.

- [ ] **Step 2: Verify List**

Switch a `.csvdb` view to List. Confirm rows render as compact lines. Set a group-by select column (via View menu → Group by) and confirm collapsible sections appear in option order with a "No value" group. Collapse and re-expand a section. Click a row → RowDetailModal opens; edit a field → save persists.

- [ ] **Step 3: Verify Gallery**

Switch to Gallery. Confirm a responsive card grid. Set a cover column and confirm images render (vault path and/or https URL). Click a card → RowDetailModal opens; edit a field → save persists. Confirm delete ✕ removes the row.

- [ ] **Step 4: Verify save-back under filter+sort**

Apply a filter/sort, then edit a row in List and in Gallery detail; reload and confirm edits land on the correct underlying rows (no index shift).

- [ ] **Step 5: Verify Kanban/Table unaffected**

Switch back to Table and Kanban; confirm they render as before and grouping still works (the refactor in Task 1 preserved behavior).

- [ ] **Step 6: Run the baseline gate and commit verification notes**

Run:
```bash
npm run check:baseline
```
Expected: all green. Then:

```bash
git add docs/superpowers/verification/2026-09-03-rowbase-list-gallery.md
git diff --cached --check
git commit -m "test: verify list and gallery views in Obsidian"
```

## Plan Completion Gate

Phase 3 is complete when:

- `ViewLayout` includes `"list"` and `"gallery"`; `.csvdb` serializes unchanged.
- `src/query/group.ts` provides pure `groupRowsBySelect` (+ re-export), `KanbanView` consumes it, all grouping tests pass.
- `ListView` and `GalleryView` exist, are wired into the layout dispatch, and are offered in the View menu.
- Both layouts consume `runQuery` results and write through `originalIndex`-keyed handlers; save-back correct under filter+sort.
- Gallery renders cover images (vault path / https) and opens RowDetailModal on card click.
- Styles added; `npm run check:baseline` green; offline audit passes.
- Obsidian smoke confirms List groups/collapses, Gallery grid + covers, and Table/Kanban unaffected.

The next plan (Phase 5: formula columns, or Phase 4 chart view) starts after this gate.
