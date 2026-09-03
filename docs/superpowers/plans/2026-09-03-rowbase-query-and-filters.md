# Rowbase Query Engine And Rich Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a pure, testable shared query engine (typed value resolution + rich filter operators + multi-column sorting) and route the table view through it, adding the full operator set to the filter UI.

**Architecture:** The current pipeline (`applyFilters`/`applySorts`) lives inside `DatabaseTable.tsx` and operates on raw `string[]` cells. Phase 2 moves value typing, filtering, and sorting into a DOM/React/Obsidian-free module under `src/query/`. Views consume `runQuery(...)` and keep saving back through the existing `{ row, originalIndex }` shape. Rich operators are persisted in the existing `FilterRule.value: string[]` (length 1 normal ops, length 2 for `between`), so saved-view schema stays backward compatible. Grouping by `groupByColumn` is already handled per-view and is out of scope here (list/gallery later). Formulas/relations/rollups are later phases; the query module exposes a `runQuery` seam those will slot into.

**Tech Stack:** TypeScript, React 19, `tsx --test` (Node test runner), PapaParse, Obsidian API.

## Global Constraints

- Every database uses exactly one `.csvdb` file.
- Databases open in a dedicated Obsidian view, never as SQL code blocks in notes.
- Runtime behavior is fully offline. No HTTP requests, WebSockets, telemetry, CDN assets, or remote service calls are allowed.
- Rowbase will not depend on the upstream package at build time or runtime.
- Database files remain human-readable and compatible with the selected base's storage contract.
- The source and built bundle are audited for fetch, XHR, WebSocket, remote asset, telemetry, dynamic-code, and secret-access patterns.
- Query engine code must NOT import React, react-dom, or obsidian — it must be pure and unit-testable in Node.
- Filter/sort/save semantics must preserve saving back to the correct original row index.

---

### Task 1: Extend Column Types And Filter Operator Types

**Files:**
- Modify: `src/types.ts`
- Test: `tsc --noEmit` via the `typecheck` script.

**Interfaces:**
- Produces `ColumnType` union extended with `url` and `link`.
- Produces `FilterOperator` union extended to the full rich set (keep existing members).
- Consumes: the existing `FilterRule` etc. — unchanged shapes.
- Later tasks import `FilterOperator` and the new `ColumnType` members.

- [ ] **Step 1: Write the typecheck-only test (no runtime test yet — this task is type-surface only)**

Add to `src/types.ts`, exactly replacing the current member lists:

```ts
export type ColumnType = "text" | "number" | "date" | "checkbox" | "select" | "multiselect" | "note" | "title" | "relation" | "url" | "link";

export type FilterOperator =
  | "equals" | "is-not"
  | "contains" | "does-not-contain" | "starts-with"
  | "is-empty" | "is-not-empty"
  | "greater-than" | "less-than" | "between"
  | "before" | "after";
```

Keep `SelectOption`, `ColumnDef`, `SortRule`, `FilterRule`, `ViewDef`, `DatabaseModel` unchanged. `FilterRule.operator` now types to the wider union; `FilterRule.value` stays `string[]` so saved views with 1 or 2 values still parse.

- [ ] **Step 2: Run typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS. No runtime test is added for this surface-only task; the subsequent tasks add the runtime behavior and tests. Commit after the runtime tasks that use these types land, per the commit boundary below.

- [ ] **Step 3: (deferred commit)** Do NOT commit here alone. This task is folded into Task 4. Record the union change for later tasks.

---

### Task 2: Build The Typed Value Resolver And Comparer

**Files:**
- Create: `src/query/resolve.ts`
- Create: `src/query/compare.ts`
- Create: `test/query-resolve.test.ts`
- Modify: `package.json` (add `test:query` script) — folded into the script task below.
- Test: `tsx --test test/query-resolve.test.ts`.

**Interfaces:**
- Produces `TypedValue` union and `resolveValue(cell: string | undefined, type: ColumnType): TypedValue`.
- Produces `compareValues(a: TypedValue, b: TypedValue, column: ColumnDef): number` (returns <0, 0, >0).
- Consumes: `ColumnType`, `ColumnDef`, `FilterOperator` from `../types`.
- `splitMultiSelect(cell: string): string[]` imported from `../csv-parser`.

- [ ] **Step 1: Write the failing resolver test**

Create `test/query-resolve.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue } from "../src/query/resolve.ts";

test("resolves numbers", () => {
  const v = resolveValue("42", "number" as const);
  assert.equal(v.kind, "number");
  if (v.kind === "number") assert.equal(v.number, 42);
});

test("resolves empty number as empty", () => {
  assert.equal(resolveValue("", "number" as const).kind, "empty");
  assert.equal(resolveValue("abc", "number" as const).kind, "empty");
});

test("resolves dates", () => {
  const v = resolveValue("2024-05-01", "date" as const);
  assert.equal(v.kind, "date");
});

test("resolves multi-select via split", () => {
  const v = resolveValue("a|b", "multiselect" as const);
  assert.equal(v.kind, "multi");
  if (v.kind === "multi") assert.deepEqual(v.multi, ["a", "b"]);
});

test("resolves text and empty", () => {
  assert.equal(resolveValue("hello", "text" as const).kind, "text");
  assert.equal(resolveValue("", "text" as const).kind, "empty");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npx tsx --test test/query-resolve.test.ts
```
Expected: FAIL — `../src/query/resolve.ts` does not exist.

- [ ] **Step 3: Implement `src/query/resolve.ts`**

```ts
import { ColumnType } from "../types";
import { splitMultiSelect } from "../csv-parser";

export type TypedValue =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "number"; number: number }
  | { kind: "date"; date: Date }
  | { kind: "multi"; multi: string[] };

export function resolveValue(cell: string | undefined, type: ColumnType): TypedValue {
  const raw = cell ?? "";
  if (type === "number") {
    const n = Number(raw);
    return raw === "" || Number.isNaN(n) ? { kind: "empty" } : { kind: "number", number: n };
  }
  if (type === "date") {
    if (!raw) return { kind: "empty" };
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? { kind: "empty" } : { kind: "date", date: d };
  }
  if (type === "multiselect" || type === "relation") {
    const parts = splitMultiSelect(raw);
    return parts.length === 0 ? { kind: "empty" } : { kind: "multi", multi: parts };
  }
  if (type === "select") {
    return raw === "" ? { kind: "empty" } : { kind: "text", text: raw };
  }
  if (type === "checkbox") {
    return raw === "" ? { kind: "empty" } : { kind: "text", text: raw };
  }
  return raw === "" ? { kind: "empty" } : { kind: "text", text: raw };
}
```

- [ ] **Step 4: Run resolver test to verify it passes**

Run:
```bash
npx tsx --test test/query-resolve.test.ts
```
Expected: PASS.

- [ ] **Step 5: Write the failing comparer test**

Append to `test/query-resolve.test.ts` (or create `test/query-compare.test.ts`, importing from `../src/query/compare.ts`):

```ts
import { compareValues } from "../src/query/compare.ts";

function col(overrides: Partial<import("../src/types").ColumnDef>): import("../src/types").ColumnDef {
  return { name: "c", type: "text", ...overrides };
}

test("compares numbers numerically", () => {
  const c = col({ type: "number" });
  assert.equal(compareValues(resolveValue("5", "number"), resolveValue("10", "number"), c) < 0, true);
});

test("orders empty last", () => {
  const c = col({ type: "text" });
  assert.equal(compareValues({ kind: "empty" }, resolveValue("a", "text"), c) > 0, true);
});

test("uses select option order", () => {
  const c = col({ type: "select", options: [{ value: "Done", color: "green" }, { value: "Todo", color: "red" }] });
  assert.equal(compareValues(resolveValue("Done", "select"), resolveValue("Todo", "select"), c) < 0, true);
});

test("compares text case-insensitively", () => {
  const c = col({ type: "text" });
  assert.equal(compareValues(resolveValue("b", "text"), resolveValue("A", "text"), c) > 0, true);
});
```

- [ ] **Step 6: Run it to verify it fails**

Run:
```bash
npx tsx --test test/query-compare.test.ts
```
Expected: FAIL — `../src/query/compare.ts` does not exist.

- [ ] **Step 7: Implement `src/query/compare.ts`**

```ts
import { ColumnDef } from "../types";
import { TypedValue } from "./resolve";

export function compareValues(a: TypedValue, b: TypedValue, column: ColumnDef): number {
  // Empty always sorts last.
  const aEmpty = a.kind === "empty";
  const bEmpty = b.kind === "empty";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (column.type === "number" && a.kind === "number" && b.kind === "number") {
    return a.number - b.number;
  }
  if (column.type === "date" && a.kind === "date" && b.kind === "date") {
    return a.date.getTime() - b.date.getTime();
  }

  // Select / multiselect respect configured option order.
  if (column.options && column.options.length > 0) {
    const order = new Map(column.options.map((o, i) => [o.value, i]));
    const key = (v: TypedValue): string =>
      v.kind === "text" ? v.text : v.kind === "multi" ? (v.multi[0] ?? "") : "";
    const ia = order.get(key(a)) ?? 999;
    const ib = order.get(key(b)) ?? 999;
    if (ia !== ib) return ia - ib;
  }

  const ta = a.kind === "text" ? a.text : a.kind === "multi" ? a.multi.join(", ") : "";
  const tb = b.kind === "text" ? b.text : b.kind === "multi" ? b.multi.join(", ") : "";
  return ta.localeCompare(tb);
}
```

- [ ] **Step 8: Run comparer test to verify it passes**

Run:
```bash
npx tsx --test test/query-compare.test.ts
```
Expected: PASS.

---

### Task 3: Implement Rich Filter Matching And Multi-Column Sorting

**Files:**
- Create: `src/query/filter.ts`
- Create: `src/query/sort.ts`
- Create: `test/query-filter.test.ts`
- Create: `test/query-sort.test.ts`
- Test: `tsx --test test/query-filter.test.ts` and `tsx --test test/query-sort.test.ts`.

**Interfaces:**
- Produces `matchesFilter(value: TypedValue, column: ColumnDef, operator: FilterOperator, filterValues: string[]): boolean`.
- Produces `sortRows(rows: QueryResultRow[], sorts: SortRule[], columns: ColumnDef[]): QueryResultRow[]`.
- Consumes: `TypedValue`/`resolveValue` from `./resolve`, `compareValues` from `./compare`, `RowRecord` type from `./record`.
- `QueryResultRow` is `{ row: string[]; originalIndex: number; id: string; values: TypedValue[] }`.

- [ ] **Step 1: Add the shared row+query types**

Create `src/query/record.ts`:

```ts
import { ColumnDef } from "../types";
import { TypedValue, resolveValue } from "./resolve";

export interface QueryResultRow {
  row: string[];
  originalIndex: number;
  id: string;
  values: TypedValue[];
}

export function buildRow(row: string[], originalIndex: number): QueryResultRow {
  return { row, originalIndex, id: String(originalIndex), values: [] };
}

export function resolveRow(row: QueryResultRow, columns: ColumnDef[]): QueryResultRow {
  row.values = columns.map((c, colIdx) => resolveValue(row.row[colIdx], c.type));
  return row;
}
```

`resolveRow` computes `values` aligned to `columns` by index — the map index equals the column index, so it is O(n) (not O(n²)) and matches how `sortRows`/`matchesFilter` dereference `values[colIdx]`. `buildRow` sets `values: []` and `resolveRow` fills them; never call `sortRows`/`matchesFilter` on a row that has not been through `resolveRow`.

- [ ] **Step 2: Write the failing filter test**

Create `test/query-filter.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesFilter } from "../src/query/filter.ts";
import { resolveValue } from "../src/query/resolve.ts";
import { ColumnDef } from "../src/types";

function col(type: ColumnDef["type"], opts?: ColumnDef["options"]): ColumnDef {
  return { name: "c", type, options: opts };
}

test("equals text", () => {
  assert.equal(matchesFilter(resolveValue("abc", "text"), col("text"), "equals", ["abc"]), true);
  assert.equal(matchesFilter(resolveValue("abc", "text"), col("text"), "equals", ["xyz"]), false);
});

test("contains and does-not-contain (case-insensitive substring)", () => {
  assert.equal(matchesFilter(resolveValue("HelloWorld", "text"), col("text"), "contains", ["world"]), true);
  assert.equal(matchesFilter(resolveValue("HelloWorld", "text"), col("text"), "does-not-contain", ["world"]), false);
});

test("starts-with", () => {
  assert.equal(matchesFilter(resolveValue("foo-bar", "text"), col("text"), "starts-with", ["foo"]), true);
  assert.equal(matchesFilter(resolveValue("xfoo", "text"), col("text"), "starts-with", ["foo"]), false);
});

test("is-empty / is-not-empty", () => {
  assert.equal(matchesFilter({ kind: "empty" }, col("text"), "is-empty", []), true);
  assert.equal(matchesFilter(resolveValue("a", "text"), col("text"), "is-not-empty", []), true);
});

test("greater-than / less-than / between for numbers", () => {
  assert.equal(matchesFilter(resolveValue("5", "number"), col("number"), "greater-than", ["3"]), true);
  assert.equal(matchesFilter(resolveValue("5", "number"), col("number"), "less-than", ["3"]), false);
  assert.equal(matchesFilter(resolveValue("5", "number"), col("number"), "between", ["3", "10"]), true);
  assert.equal(matchesFilter(resolveValue("20", "number"), col("number"), "between", ["3", "10"]), false);
});

test("before / after / between for dates", () => {
  assert.equal(matchesFilter(resolveValue("2024-05-01", "date"), col("date"), "before", ["2024-06-01"]), true);
  assert.equal(matchesFilter(resolveValue("2024-05-01", "date"), col("date"), "after", ["2024-04-01"]), true);
  assert.equal(matchesFilter(resolveValue("2024-05-01", "date"), col("date"), "between", ["2024-04-01", "2024-06-01"]), true);
  assert.equal(matchesFilter(resolveValue("2024-07-01", "date"), col("date"), "between", ["2024-04-01", "2024-06-01"]), false);
});

test("multi-select contains requires no matching value for does-not-contain", () => {
  assert.equal(matchesFilter(resolveValue("a|b", "multiselect"), col("multiselect"), "contains", ["b"]), true);
  assert.equal(matchesFilter(resolveValue("a|b", "multiselect"), col("multiselect"), "does-not-contain", ["b"]), false);
  assert.equal(matchesFilter(resolveValue("a|b", "multiselect"), col("multiselect"), "does-not-contain", ["z"]), true);
});

test("empty cell fails closed on non-empty operators", () => {
  assert.equal(matchesFilter({ kind: "empty" }, col("text"), "contains", ["a"]), false);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run:
```bash
npx tsx --test test/query-filter.test.ts
```
Expected: FAIL — `../src/query/filter.ts` does not exist.

- [ ] **Step 4: Implement `src/query/filter.ts`**

```ts
import { ColumnDef, FilterOperator } from "../types";
import { TypedValue } from "./resolve";

export function matchesFilter(
  value: TypedValue,
  column: ColumnDef,
  operator: FilterOperator,
  filterValues: string[],
): boolean {
  const vals = filterValues.filter((v) => v !== "");
  if (operator === "is-empty") return value.kind === "empty";
  if (operator === "is-not-empty") return value.kind !== "empty";
  // Fail closed: empty value must explicitly be targeted by is-empty.
  if (value.kind === "empty") return false;

  switch (operator) {
    case "equals": {
      if (value.kind === "number") return vals.length > 0 && value.number === Number(vals[0]);
      if (value.kind === "date") return vals.length > 0 && sameDate(value.date, vals[0]);
      if (value.kind === "multi") return vals.length > 0 && value.multi.join("|") === normalize(vals).join("|");
      return value.kind === "text" && vals.map(normalize).includes(normalize(value.text));
    }
    case "is-not":
      return !matchesFilter(value, column, "equals", filterValues);
    case "contains": {
      if (value.kind === "multi") return value.multi.some((m) => vals.map(normalize).includes(normalize(m)));
      const text = value.kind === "text" ? value.text : String(value.kind === "number" ? value.number : value.kind === "date" ? value.date.toISOString() : "");
      return vals.some((v) => normalize(text).includes(normalize(v)));
    }
    case "does-not-contain":
      return !matchesFilter(value, column, "contains", filterValues);
    case "starts-with": {
      const text = value.kind === "text" ? value.text : String(value.kind === "number" ? value.number : "");
      return vals.some((v) => normalize(text).startsWith(normalize(v)));
    }
    case "greater-than": {
      const n = Number(vals[0]);
      if (value.kind === "number") return !Number.isNaN(n) && value.number > n;
      if (value.kind === "date") {
        const t = new Date(vals[0]).getTime();
        return !Number.isNaN(t) && value.date.getTime() > t;
      }
      return false;
    }
    case "less-than": {
      const n = Number(vals[0]);
      if (value.kind === "number") return !Number.isNaN(n) && value.number < n;
      if (value.kind === "date") {
        const t = new Date(vals[0]).getTime();
        return !Number.isNaN(t) && value.date.getTime() < t;
      }
      return false;
    }
    case "between": {
      if (value.kind === "number") {
        const lo = Number(vals[0]);
        const hi = Number(vals[1]);
        if (Number.isNaN(lo) || Number.isNaN(hi)) return false;
        return value.number >= lo && value.number <= hi;
      }
      if (value.kind === "date") {
        const lo = new Date(vals[0]).getTime();
        const hi = new Date(vals[1]).getTime();
        if (Number.isNaN(lo) || Number.isNaN(hi)) return false;
        const t = value.date.getTime();
        return t >= lo && t <= hi;
      }
      return false;
    }
    case "before": {
      if (value.kind !== "date") return false;
      return value.date.getTime() < new Date(vals[0]).getTime();
    }
    case "after": {
      if (value.kind !== "date") return false;
      return value.date.getTime() > new Date(vals[0]).getTime();
    }
    default:
      return false;
  }
}

function normalize(s: string): string {
  return s === undefined || s === null ? "" : s.trim().toLowerCase();
}

function sameDate(d: Date, iso: string): boolean {
  const o = new Date(iso);
  return d.getFullYear() === o.getFullYear() && d.getMonth() === o.getMonth() && d.getDate() === o.getDate();
}
```

- [ ] **Step 5: Write and run the failing sort test**

Create `test/query-sort.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { sortRows } from "../src/query/sort.ts";
import { buildRow, resolveRow } from "../src/query/record.ts";
import { ColumnDef, SortRule } from "../src/types";

const columns: ColumnDef[] = [
  { name: "Name", type: "text" },
  { name: "Qty", type: "number" },
  { name: "Status", type: "select", options: [{ value: "Done", color: "green" }, { value: "Todo", color: "red" }] },
];

const rows = resolveRow(buildRow(["Beta", "5", "Todo"], 0), columns);
const rows2 = resolveRow(buildRow(["alpha", "3", "Done"], 1), columns);
const rows3 = resolveRow(buildRow(["", "10", "Todo"], 2), columns);

test("sorts by single number ascending", () => {
  const out = sortRows([rows, rows2, rows3], [{ column: "Qty", direction: "asc" }], columns);
  assert.deepEqual(out.map((r) => r.originalIndex), [1, 0, 2]);
});

test("multi-column: number then text", () => {
  const out = sortRows([rows2, rows3, rows], [
    { column: "Qty", direction: "asc" },
    { column: "Name", direction: "asc" },
  ], columns);
  assert.deepEqual(out.map((r) => r.originalIndex), [1, 0, 2]);
});

test("select uses option order, empty last", () => {
  // rows2 = Done (option index 0), rows = Todo (index 1), rows3 = Todo (index 1)
  const out = sortRows([rows2, rows, rows3], [{ column: "Status", direction: "asc" }], columns);
  assert.deepEqual(out.map((r) => r.originalIndex), [1, 0, 2]);
});
```

- [ ] **Step 6: Run it to verify it fails**

Run:
```bash
npx tsx --test test/query-sort.test.ts
```
Expected: FAIL — `../src/query/sort.ts` does not exist.

- [ ] **Step 7: Implement `src/query/sort.ts`**

```ts
import { ColumnDef, SortRule } from "../types";
import { QueryResultRow } from "./record";
import { compareValues } from "./compare";

export function sortRows(
  rows: QueryResultRow[],
  sorts: SortRule[],
  columns: ColumnDef[],
): QueryResultRow[] {
  if (sorts.length === 0) return rows;
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const sort of sorts) {
      const colIdx = columns.findIndex((c) => c.name === sort.column);
      if (colIdx === -1) continue;
      const cmp = compareValues(a.values[colIdx] ?? { kind: "empty" }, b.values[colIdx] ?? { kind: "empty" }, columns[colIdx]);
      if (cmp !== 0) return sort.direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
  return sorted;
}
```

- [ ] **Step 8: Run sort test to verify it passes**

Run:
```bash
npx tsx --test test/query-sort.test.ts
```
Expected: PASS. If the option-order assertion fails, confirm `buildRow`/`resolveRow` produce `values` aligned to `columns` by index (they do — `resolveRow` maps each column by its index in `columns`).

---

### Task 4: Add `runQuery` And Wire The Table View Through It

**Files:**
- Create: `src/query/index.ts`
- Modify: `src/components/DatabaseTable.tsx` (replace `applyFilters`/`applySorts` with a call to `runQuery`)
- Test: `tsx --test test/query-filter.test.ts` (reuse), plus the existing `check:baseline` typecheck/build.

**Interfaces:**
- Produces `runQuery(model: DatabaseModel, view: ViewDef): QueryResultRow[]`.
- Produces `getColumnByName(columns: ColumnDef[], name: string): ColumnDef | undefined`.
- Consumes: `TypedValue`/`resolveRow` from `./record`, `matchesFilter` from `./filter`, `compareValues` from `./compare`, `ColumnDef`/`ViewDef`/`DatabaseModel` from `../types`.
- Produces an `index.ts` barrel exporting `runQuery`, `sortRows`, `matchesFilter`, `resolveRow`, `TypedValue` for later phases.

- [ ] **Step 1: Implement `src/query/index.ts`**

```ts
import { ColumnDef, DatabaseModel, ViewDef } from "../types";
import { QueryResultRow, buildRow, resolveRow } from "./record";
import { matchesFilter } from "./filter";
import { sortRows } from "./sort";

export { QueryResultRow, buildRow, resolveRow } from "./record";
export { TypedValue, resolveValue } from "./resolve";
export { matchesFilter } from "./filter";
export { sortRows } from "./sort";
export { compareValues } from "./compare";

export function runQuery(model: DatabaseModel, view: ViewDef): QueryResultRow[] {
  let result = model.rows.map((row, originalIndex) => resolveRow(buildRow(row, originalIndex), model.columns));

  if (view.filters.length > 0) {
    result = result.filter((r) =>
      view.filters.every((f) => {
        const colIdx = model.columns.findIndex((c) => c.name === f.column);
        if (colIdx === -1) return true;
        const column = model.columns[colIdx];
        return matchesFilter(r.values[colIdx] ?? { kind: "empty" }, column, f.operator, f.value);
      }),
    );
  }

  return sortRows(result, view.sorts.map((s) => ({ ...s })), model.columns);
}
```

- [ ] **Step 2: Rewrite `DatabaseTable.tsx` to consume `runQuery`**

Replace the `applyFilters` and `applySorts` function bodies (they are module-level, `DatabaseTable.tsx:383-480`) with a single import and a `filteredSortedRows` memo that calls `runQuery`. Remove the two old local functions entirely.

At the top of `DatabaseTable.tsx`, add:

```ts
import { runQuery } from "../query";
```

Replace the `filteredSortedRows` memo (currently `DatabaseTable.tsx:538-541`):

```ts
  const filteredSortedRows = useMemo(() => {
    return runQuery(model, { ...activeView, sorts: effectiveSorts, filters: effectiveFilters });
  }, [model, activeView, effectiveSorts, effectiveFilters]);
```

`runQuery` returns `QueryResultRow[]`, each `{ row, originalIndex, id, values }`. `TableBody` and `KanbanView` only read `row` and `originalIndex`, so the extra `values`/`id` fields are a structural superset and are accepted. Save-back semantics stay exact because `originalIndex` is the true index into `model.rows`.

- [ ] **Step 3: Confirm the union type change is consistent**

`DatabaseTable.tsx` still imports `FilterOperator`? If it referenced the old narrow union, update imports from `../types`. Verify no `case` switch on `FilterOperator` in `DatabaseTable.tsx` remains (the old `applyFilters` switch is removed). The `FilterPillEditor.tsx` still has a hardcoded `<option>` list — that is updated in Task 5.

- [ ] **Step 4: Run the full gate**

Run:
```bash
npm run typecheck && npx tsx --test test/query-resolve.test.ts test/query-compare.test.ts test/query-filter.test.ts test/query-sort.test.ts && npm run build && npm run test:offline
```
Expected: all PASS, build produces `main.js`, offline audit passes.

- [ ] **Step 5: Commit tasks 1-4**

Run:
```bash
git add src/types.ts src/query src/components/DatabaseTable.tsx test/query-resolve.test.ts test/query-compare.test.ts test/query-filter.test.ts test/query-sort.test.ts
git diff --cached --check
git commit -m "feat: shared query engine with rich filter operators"
```

The type-surface change (Task 1) commits here alongside the behavior (no standalone commit it).

---

### Task 5: Add The Rich Operator Dropdown And Type-Aware Value Inputs

**Files:**
- Modify: `src/components/FilterPillEditor.tsx`
- Modify: `src/components/FilterSortBar.tsx` (if it renders operator labels)
- Modify: `src/constants.ts` (optional: filter-operator metadata / type icons for url+link)
- Test: typecheck + manual smoke in Obsidian.

**Interfaces:**
- Consumes: `FilterOperator` union from `../types`, `ColumnDef` from `../types`.
- Produces: per-column-type operator dropdown and value inputs (number/date/between show two fields).

- [ ] **Step 1: Add operator availability metadata**

Create `src/query/operators.ts`:

```ts
import { ColumnType, FilterOperator } from "../types";

export const TEXT_OPERATORS: FilterOperator[] = [
  "equals", "is-not", "contains", "does-not-contain", "starts-with", "is-empty", "is-not-empty",
];
export const NUMBER_OPERATORS: FilterOperator[] = [
  "equals", "is-not", "greater-than", "less-than", "between", "is-empty", "is-not-empty",
];
export const DATE_OPERATORS: FilterOperator[] = [
  "equals", "is-not", "before", "after", "between", "is-empty", "is-not-empty",
];
export const MULTI_OPERATORS: FilterOperator[] = [
  "contains", "does-not-contain", "is-empty", "is-not-empty",
];

export function operatorsForType(type: ColumnType): FilterOperator[] {
  if (type === "number") return NUMBER_OPERATORS;
  if (type === "date") return DATE_OPERATORS;
  if (type === "multiselect" || type === "relation") return MULTI_OPERATORS;
  return TEXT_OPERATORS;
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  "equals": "Equals",
  "is-not": "Is not",
  "contains": "Contains",
  "does-not-contain": "Does not contain",
  "starts-with": "Starts with",
  "is-empty": "Is empty",
  "is-not-empty": "Is not empty",
  "greater-than": "Greater than",
  "less-than": "Less than",
  "between": "Between",
  "before": "Before",
  "after": "After",
};
```

- [ ] **Step 2: Update `FilterPillEditor.tsx` operator dropdown**

Replace the hardcoded `<option>` list (currently `FilterPillEditor.tsx:252-257`) with a map driven by the selected column's type:

```ts
import { operatorsForType, OPERATOR_LABELS } from "../query/operators";
```

```tsx
{operatorsForType(column?.type ?? "text").map((op) => (
  <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
))}
```

When the column type changes, reset the operator to the first valid one for that type and clear `values`, so a saved incompatible operator does not linger. In the column `<select>` onChange (currently `FilterPillEditor.tsx:230-239`), also reset operator:

```tsx
onChange={(e) => {
  const nextType = columns.find((c) => c.name === e.target.value)?.type ?? "text";
  const firstOp = operatorsForType(nextType)[0];
  onUpdate({ column: e.target.value, operator: firstOp, value: [] });
}}
```

- [ ] **Step 3: Add a between/range value input for number and date**

For `between` operators, show two inputs (`From`/`To`). Update the value-editing section (currently `FilterPillEditor.tsx:259-271`) so that when `filter.operator === "between"` it renders two text inputs writing `filter.value[0]` and `filter.value[1]`. For date columns use `type="date"` inputs; for number use `type="number"`; for text/multi keep the existing picker/text input. Reuse `FilterTextValue` for the simple single-value case but make it tolerate writing index 0.

Concretely add a `FilterRangeValue` component and branch:

```tsx
{showValue && filter.operator === "between" && (
  <FilterRangeValue
    column={column}
    values={filter.value}
    onUpdateValue={(value) => onUpdate({ value })}
  />
)}
{showValue && filter.operator !== "between" && isSelectType && column && (
  <FilterSelectValueTrigger ... />
)}
{showValue && filter.operator !== "between" && !isSelectType && (
  <FilterTextValue ... />
)}
```

`FilterRangeValue` renders two `<input>`s (date/number per column type) that update `values[0]`/`values[1]`:

```tsx
function FilterRangeValue({ column, values, onUpdateValue }: {
  column: ColumnDef; values: string[]; onUpdateValue: (value: string[]) => void;
}) {
  const inputType = column.type === "date" ? "date" : column.type === "number" ? "number" : "text";
  const set = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = [...values];
    next[i] = e.target.value;
    onUpdateValue(next.slice(0, 2));
  };
  return (
    <div className="csv-db-filter-range">
      <input className="csv-db-popover-input" type={inputType} value={values[0] ?? ""} onChange={set(0)} placeholder="From" />
      <input className="csv-db-popover-input" type={inputType} value={values[1] ?? ""} onChange={set(1)} placeholder="To" />
    </div>
  );
}
```

- [ ] **Step 4: Update `src/constants.ts` type icons for url and link**

Add to `getTypeIcon`:

```ts
case "url": return "↗";
case "link": return "🔗";
```

And add to `COLUMN_TYPES`:

```ts
{ value: "url", label: "URL" },
{ value: "link", label: "Link" },
```

- [ ] **Step 5: Run typecheck and build**

Run:
```bash
npm run typecheck && npm run build && npm run test:offline
```
Expected: PASS.

- [ ] **Step 6: Add a package script for query tests and re-run the full gate**

Modify `package.json` scripts to add:

```json
"test:query": "tsx --test test/query-resolve.test.ts test/query-compare.test.ts test/query-filter.test.ts test/query-sort.test.ts"
```

And extend `check:baseline` to include it:

```json
"check:baseline": "npm run typecheck && npm run test:metadata && npm run test:csvdb && npm run test:query && npm run build && npm run test:offline"
```

Run:
```bash
npm run check:baseline
```
Expected: all green.

- [ ] **Step 7: Add covering CSS for the range inputs**

Add to `styles.css` a minimal `.csv-db-filter-range` rule (flex, gap, full-width inputs) consistent with existing `.csv-db-popover-input` styling. Match the existing shadow/color variables used elsewhere.

- [ ] **Step 8: Commit**

Run:
```bash
git add src/components/FilterPillEditor.tsx src/components/FilterSortBar.tsx src/query/operators.ts src/constants.ts styles.css package.json
git diff --cached --check
git commit -m "feat: type-aware rich filter UI"
```

---

### Task 6: Verify In Obsidian And Run The Baseline Gate

**Files:**
- Create: `docs/superpowers/verification/2026-09-03-rowbase-query-and-filters.md`
- Test: manual Obsidian smoke in the isolated `$HOME/rowbase-dev-vault`.

**Interfaces:**
- Confirms the plan's acceptance: rich operators work, type-aware inputs, saved-view compatibility, offline audit green.

- [ ] **Step 1: Rebuild and reload the plugin**

Run:
```bash
npm run build
```
Reload Obsidian in `$HOME/rowbase-dev-vault`. Confirm no console errors and the plugin still shows **Rowbase**.

- [ ] **Step 2: Verify rich operators manually**

In a `.csvdb` with a Number column, add a filter and confirm Greater than / Less than / Between render and narrow rows. Add a Date column filter and confirm Before / After / Between render. Add a Text column filter and confirm Starts with / Does not contain render. Confirm an empty-cell filter (Is empty) shows only blank rows.

- [ ] **Step 3: Verify saved-view compatibility**

Save a filtered view with a `between` operator, reload the file, and confirm the view still loads and applies correctly (schema unchanged: `value` length 2). Confirm previously-saved `contains`-based views still work.

- [ ] **Step 4: Verify save-back correctness**

After filtering/sorting, edit a cell in a filtered table and confirm it writes to the correct underlying row (not a shifted index). Confirm kanban still opens and drags correctly (grouping unchanged).

- [ ] **Step 5: Run the full baseline gate**

Run:
```bash
npm run check:baseline
```
Expected: all green.

- [ ] **Step 6: Write and commit verification notes**

Create `docs/superpowers/verification/2026-09-03-rowbase-query-and-filters.md` documenting the Obsidian version, the steps above, results, and any follow-up defect. Commit:

```bash
git add docs/superpowers/verification/2026-09-03-rowbase-query-and-filters.md
git diff --cached --check
git commit -m "test: verify query engine and rich filters in Obsidian"
```

## Plan Completion Gate

Phase 2 is complete when:

- `ColumnType` includes `url`/`link` and `FilterOperator` includes the full rich set.
- `src/query/` exports `resolveValue`, `TypedValue`, `matchesFilter`, `compareValues`, `sortRows`, `runQuery`.
- `DatabaseTable.tsx` no longer contains the local `applyFilters`/`applySorts` and routes through `runQuery`.
- Save-back writes to the correct original row index under filter+sort.
- Rich filter operators and type-aware value inputs render in the filter UI.
- All query unit tests pass; `npm run check:baseline` is green; offline audit passes.
- Obsidian smoke confirms rich operators, saved-view compatibility, and kanban integrity.

The next plan (Phase 3: list + gallery views, or Phase 5: formula columns) starts after this gate.
