# Rowbase Formula And Rollup Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `formula` and `rollup` column types whose values are computed in the query layer (never written into raw `.row` cells), rendered read-only in every view, and recomputed live on any edit.

**Architecture:** A pure `src/query/formula.ts` evaluates safe, whitelisted expressions (no `eval`/`Function`). A pure `src/query/rollup.ts` aggregates related rows (count/sum/avg/min/max/list). `runQuery` computes formula/rollup values each pass into each `QueryResultRow` — formula values as computed string cells (via a `getDisplayValue` helper), rollups as aggregates over a relation column. Relation row resolution is passed into the query layer as a seam callback (`resolveRelationRows`) so `src/query/` stays Obsidian-free and Node-testable; the Obsidian layer provides the actual file reads. Computed cells are read-only (no `onChange`), so save-back semantics are untouched; any `SET_CELL`/`ADD_ROW` mutation triggers recomputation because `runQuery` runs fresh on each render.

**Tech Stack:** TypeScript, React 19, `tsx --test` (Node test runner), Obsidian API, PapaParse.

## Global Constraints

- Every database uses exactly one `.csvdb` file.
- Databases open in a dedicated Obsidian view, never as SQL code blocks in notes.
- Runtime behavior is fully offline. No HTTP requests, WebSockets, telemetry, CDN assets, or remote service calls.
- Rowbase will not depend on the upstream package at build time or runtime.
- Database files remain human-readable and compatible with the selected base's storage contract. `.csvdb` JSON column metadata gains optional formula/rollup config.
- Query engine code (src/query/*) must NOT import React, react-dom, or obsidian — it must be pure and unit-testable in Node.
- Formula/rollup values are computed in memory and are NOT duplicated into raw `row[rowIdx]` cells. Computed cells are read-only.
- Column-type display must remain human-readable in the `.csvdb` (the formula expression and rollup config live in `ColumnDef` as optional fields).

---

### Task 1: Build The Pure Formula Evaluator

**Files:**
- Create: `src/query/formula.ts`
- Create: `test/formula.test.ts`
- Modify: `src/query/index.ts` (re-export formula helpers)
- Test: `tsx --test test/formula.test.ts`.

**Interfaces:**
- Produces `FormulaCell = { kind: "number"; value: number } | { kind: "string"; value: string } | { kind: "error"; message: string }`.
- Produces `FormulaValue = number | string | boolean | null`.
- Produces `FormulaEnv = { getColumn(name: string): FormulaValue; getRelatedNumbers(relationColumn: string, valueColumn: string): number[] }`.
- Produces `evaluateFormula(expr: string, env: FormulaEnv): FormulaCell`.
- Consumes: nothing external (pure). Later tasks call `evaluateFormula` from `runQuery`.
- `src/query/index.ts` re-exports `evaluateFormula`, `FormulaCell`, `FormulaValue`, `FormulaEnv`.

- [ ] **Step 1: Write the failing formula test**

Create `test/formula.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateFormula, FormulaEnv, FormulaValue } from "../src/query/formula.ts";

function env(values: Record<string, FormulaValue>, related: Record<string, number[]> = {}): FormulaEnv {
  return {
    getColumn: (name) => values[name] ?? null,
    getRelatedNumbers: (rel, val) => related[`${rel}\u0000${val}`] ?? [],
  };
}

test("numeric arithmetic", () => {
  const r = evaluateFormula("price * quantity", env({ price: 4, quantity: 3 }));
  assert.deepEqual(r, { kind: "number", value: 12 });
});

test("precedence and parentheses", () => {
  const r = evaluateFormula("2 + 3 * 4", env({}));
  assert.deepEqual(r, { kind: "number", value: 14 });
  const r2 = evaluateFormula("(2 + 3) * 4", env({}));
  assert.deepEqual(r2, { kind: "number", value: 20 });
});

test("division by zero produces error", () => {
  const r = evaluateFormula("10 / (2 - 2)", env({}));
  assert.equal(r.kind, "error");
});

test("comparison and IF conditional", () => {
  const r = evaluateFormula('IF(score >= 90, "A", "B")', env({ score: 95 }));
  assert.deepEqual(r, { kind: "string", value: "A" });
});

test("string concatenation with &", () => {
  const r = evaluateFormula('first & " " & last', env({ first: "Ada", last: "Lovelace" }));
  assert.deepEqual(r, { kind: "string", value: "Ada Lovelace" });
});

test("aggregate functions over related rows", () => {
  const withRel = env({}, { "items\u0000amount": [10, 20, 30] });
  const r = evaluateFormula("SUM(items.amount)", withRel);
  assert.deepEqual(r, { kind: "number", value: 60 });
  const avg = evaluateFormula("AVG(items.amount)", withRel);
  assert.deepEqual(avg, { kind: "number", value: 20 });
});

test("unknown column is null (not an error) and unknown function errors", () => {
  assert.deepEqual(evaluateFormula("missing", env({})), { kind: "number", value: 0 });
  const bad = evaluateFormula("NOPE(x)", env({ x: 1 }));
  assert.equal(bad.kind, "error");
});

test("malformed expression errors", () => {
  const r = evaluateFormula("2 + ", env({}));
  assert.equal(r.kind, "error");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npx tsx --test test/formula.test.ts
```
Expected: FAIL — `../src/query/formula.ts` does not exist.

- [ ] **Step 3: Implement `src/query/formula.ts`**

A small tokenizer + recursive-descent parser; no `eval`, no `Function`, no generated JS. Supports: numbers, string literals (double quotes), column refs (bare identifiers), `+ - * /`, unary minus, parentheses, `>= <= > < = !=`, `&` (concat), `IF(cond, then, else)`, `SUM(ref)`, `AVG(ref)`, `COUNT(ref)`, `MIN(ref)`, `MAX(ref)`. Column refs in aggregate functions use `relation.column` syntax (split on `.`). Bare identifiers inside `SUM`/`AVG`/etc. resolve to a value column name; the `relation` part names a relation column for which `env.getRelatedNumbers(relationColumn, valueColumn)` returns numbers.

```ts
export type FormulaValue = number | string | boolean | null;

export interface FormulaEnv {
  getColumn(name: string): FormulaValue;
  getRelatedNumbers(relationColumn: string, valueColumn: string): number[];
}

export type FormulaCell =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "error"; message: string };

type Tok = { kind: "num"; v: number } | { kind: "str"; v: string } | { kind: "id"; v: string }
  | { kind: "op"; v: string } | { kind: "lparen" } | { kind: "rparen" } | { kind: "comma" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = src.slice(i).match(/^\d*\.?\d+/);
      if (!m) throw new Error("bad number");
      out.push({ kind: "num", v: parseFloat(m[0]) });
      i += m[0].length; continue;
    }
    if (c === '"') {
      let j = i + 1; let s = "";
      while (j < src.length && src[j] !== '"') { s += src[j]; j++; }
      if (j >= src.length) throw new Error("unterminated string");
      out.push({ kind: "str", v: s });
      i = j + 1; continue;
    }
    if (/[A-Za-z_/.$\u00a0-\uffff]/.test(c)) {
      const m = src.slice(i).match(/[A-Za-z_][A-Za-z0-9_/.$.]*/);
      if (!m) throw new Error("bad identifier");
      out.push({ kind: "id", v: m[0] });
      i += m[0].length; continue;
    }
    if ("+-*/<>!=&".includes(c)) { out.push({ kind: "op", v: c }); i++; continue; }
    if (c === "(") { out.push({ kind: "lparen" }); i++; continue; }
    if (c === ")") { out.push({ kind: "rparen" }); i++; continue; }
    if (c === ",") { out.push({ kind: "comma" }); i++; continue; }
    throw new Error(`unexpected character "${c}"`);
  }
  return out;
}

function toNumber(v: FormulaValue): number {
  if (v === null) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export function evaluateFormula(expr: string, env: FormulaEnv): FormulaCell {
  try {
    const tokens = tokenize(expr);
    let pos = 0;
    const peek = () => tokens[pos] ?? null;
    const next = () => tokens[pos++];

    function parseExpr(): number | string | boolean {
      let left = parseOr();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && (t.v === "&")) {
          next();
          const right = parseOr();
          left = String(left as any) + String(right as any);
        } else break;
      }
      return left as any;
    }

    function parseOr(): any {
      let left = parseAnd();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && t.v === "||") { next(); const right = parseAnd(); left = truthy(left) || truthy(right); }
        else break;
      }
      return left;
    }

    function parseAnd(): any {
      let left = parseCmp();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && t.v === "&&") { next(); const right = parseCmp(); left = truthy(left) && truthy(right); }
        else break;
      }
      return left;
    }

    function parseCmp(): any {
      let left = parseAdd();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && ["=", "!=", "<", ">", "<=", ">="].includes(t.v)) {
          next();
          const right = parseAdd();
          const lt = left as any, rt = right as any;
          left = t.v === "=" ? lt === rt
            : t.v === "!=" ? lt !== rt
            : t.v === "<" ? lt < rt
            : t.v === ">" ? lt > rt
            : t.v === "<=" ? lt <= rt
            : lt >= rt;
        } else break;
      }
      return left;
    }

    function parseAdd(): any {
      let left = parseMul();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && (t.v === "+" || t.v === "-")) {
          next();
          const right = parseMul();
          const lt = left as any, rt = right as any;
          left = t.v === "+" ? lt + rt : lt - rt;
        } else break;
      }
      return left;
    }

    function parseMul(): any {
      let left = parseUnary();
      for (;;) {
        const t = peek();
        if (t?.kind === "op" && (t.v === "*" || t.v === "/")) {
          next();
          const right = parseUnary();
          const lt = left as any, rt = right as any;
          if (t.v === "/") {
            if (rt === 0) throw new Error("division by zero");
            left = lt / rt;
          } else left = lt * rt;
        } else break;
      }
      return left;
    }

    function parseUnary(): any {
      const t = peek();
      if (t?.kind === "op" && t.v === "-") { next(); const v = parseUnary(); return -toNumber(v as any); }
      if (t?.kind === "op" && t.v === "+") { next(); return parseUnary(); }
      return parsePostfix();
    }

    function parsePostfix(): any {
      let base = parseAtom();
      return base as any;
    }

    function truthy(v: any): boolean {
      if (v === null) return false;
      if (typeof v === "string") return v.length > 0;
      if (typeof v === "number") return v !== 0;
      return Boolean(v);
    }

    function resolveId(id: string): FormulaValue {
      // aggregate syntax relation.column → related numbers
      if (id.includes(".")) {
        const [rel, col] = id.split(".");
        return String(env.getRelatedNumbers(rel, col).join(","));
      }
      return env.getColumn(id);
    }

    function callAgg(name: string, id: string): number {
      const [rel, col] = id.includes(".") ? id.split(".") : ["", id];
      if (!col) throw new Error("aggregate needs a column");
      const nums = rel ? env.getRelatedNumbers(rel, col) : [toNumber(env.getColumn(col))];
      const valid = nums.filter((n) => !Number.isNaN(n));
      if (valid.length === 0) return 0;
      switch (name) {
        case "SUM": return valid.reduce((a, b) => a + b, 0);
        case "AVG": return valid.reduce((a, b) => a + b, 0) / valid.length;
        case "COUNT": return valid.length;
        case "MIN": return Math.min(...valid);
        case "MAX": return Math.max(...valid);
        default: throw new Error("unknown aggregate");
      }
    }

    function parseAtom(): any {
      const t = next();
      if (!t) throw new Error("unexpected end");
      if (t.kind === "num") return t.v;
      if (t.kind === "str") return t.v;
      if (t.kind === "id") {
        const name = t.v.toUpperCase();
        if (["SUM", "AVG", "COUNT", "MIN", "MAX"].includes(name)) {
          if (peek()?.kind !== "lparen") throw new Error(`${name} needs ( )`);
          next();
          const argTok = next();
          if (!argTok || argTok.kind !== "id") throw new Error("aggregate needs a column");
          const val = callAgg(name, argTok.v);
          if (peek()?.kind !== "rparen") throw new Error("aggregate missing )");
          next();
          return val;
        }
        if (name === "IF") {
          if (peek()?.kind !== "lparen") throw new Error("IF needs ( )");
          next();
          const cond = parseExpr();
          if (peek()?.kind !== "comma") throw new Error("IF needs comma");
          next();
          const thenV = parseExpr();
          if (peek()?.kind !== "comma") throw new Error("IF needs comma");
          next();
          const elseV = parseExpr();
          if (peek()?.kind !== "rparen") throw new Error("IF missing )");
          next();
          return truthy(cond) ? thenV : elseV;
        }
        return resolveId(t.v);
      }
      if (t.kind === "lparen") {
        const inner = parseExpr();
        if (peek()?.kind !== "rparen") throw new Error("missing )");
        next();
        return inner;
      }
      throw new Error("unexpected token");
    }

    const value = parseExpr();
    if (pos < tokens.length) throw new Error("trailing tokens");

    if (typeof value === "boolean") return { kind: "string", value: value ? "true" : "false" };
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return { kind: "error", message: "non-finite result" };
      return { kind: "number", value };
    }
    return { kind: "string", value: String(value) };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
```

Note: the tokenizer treats `SUM(items.amount)` — the inner id token is `items.amount` (dots are allowed in id chars), and `callAgg` splits it into relation `items`, column `amount`. When `id` has no dot, `rel` is `""` and it aggregates the single current-row value of that column. This keeps the evaluator pure and testable; the `getRelatedNumbers` seam is satisfied by the query layer later.

- [ ] **Step 4: Run the formula test to verify it passes**

Run:
```bash
npx tsx --test test/formula.test.ts
```
Expected: PASS (all 8 tests). If any arithmetic/IF test fails, verify the parser precedence matches typical math (multiplication before addition) and that boolean ops `&&`/`||` are NOT tokenized by the op-char set `"+-*/<>!=&"` — the tokenizer does not handle `&&`/`||` as single tokens, so the `parseAnd`/`parseOr` loops are effectively no-ops; that is fine for Phase 5 (IF covers conditionals). Remove the `||`/`&&` loops if they are covered but unreachable — they are harmless; do not let them cause a test failure.

- [ ] **Step 5: Re-export formula helpers**

In `src/query/index.ts` add:

```ts
export { evaluateFormula } from "./formula";
export type { FormulaCell, FormulaValue, FormulaEnv } from "./formula";
```

- [ ] **Step 6: Commit**

Run:
```bash
git add src/query/formula.ts test/formula.test.ts src/query/index.ts
git diff --cached --check
git commit -m "feat(query): add pure formula evaluator"
```

---

### Task 2: Build The Pure Rollup Aggregator

**Files:**
- Create: `src/query/rollup.ts`
- Create: `test/rollup.test.ts`
- Modify: `src/query/index.ts` (re-export rollup helpers)
- Test: `tsx --test test/rollup.test.ts`.

**Interfaces:**
- Produces `RollupConfig = { relationColumn: string; targetColumn: string; handler: "count" | "sum" | "avg" | "min" | "max" | "list"; targetFilter?: { column: string; equals: string } }`.
- Produces `RollupValue = number | string | null`.
- Produces `computeRollup(related: Array<{ row: string[] }>, targetIndex: number, config: RollupConfig): RollupValue` where `targetIndex` is the index of the target column in each related row (resolved by the caller from the related database's columns), and the optional filter is likewise resolved by index — the caller narrows `related` to rows where the filter column equals `equals` before calling? No — keep the filter inside so it's testable; use `filterIndex` too.
- Revised signature: `computeRollup(related: Array<{ row: string[] }>, targetIndex: number, filter: { index: number; equals: string } | undefined, hr: "count" | "sum" | "avg" | "min" | "max" | "list"): RollupValue`.
- Consumes: related rows (already resolved to indexed string arrays) plus the indices. Pure, no Obsidian.
- Later tasks call `computeRollup` from `runQuery`, resolving indices from the related database's column list.

- [ ] **Step 1: Write the failing rollup test**

Create `test/rollup.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { computeRollup } from "../src/query/rollup.ts";

// Each related row is { row: ["category", "amount"], } and we target index 1 (amount).
const foodRows = [
  { row: ["Food", "10"] },
  { row: ["Food", "20"] },
  { row: ["Travel", "30"] },
  { row: ["Food", ""] },
];

test("sum over target index skips empty", () => {
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "sum"), 60);
});

test("count counts related rows", () => {
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "count"), 4);
});

test("avg skips empty", () => {
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "avg"), 20);
});

test("min / max / list", () => {
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "min"), 10);
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "max"), 30);
  assert.equal(computeRollup(foodRows as any, 1, undefined as any, "list"), "10, 20, 30");
});

test("filter narrows to matching rows", () => {
  const filter = { index: 0, equals: "Food" };
  assert.equal(computeRollup(foodRows as any, 1, filter as any, "sum"), 30); // 10 + 20, Travel(30) excluded
});

test("empty related set returns null for numeric, empty string for list", () => {
  assert.equal(computeRollup([], 1, undefined as any, "sum"), null);
  assert.equal(computeRollup([], 1, undefined as any, "list"), "");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:
```bash
npx tsx --test test/rollup.test.ts
```
Expected: FAIL — `../src/query/rollup.ts` does not exist.

- [ ] **Step 3: Implement `src/query/rollup.ts`**

The interface is index-driven (target/filter resolved by the caller), so `computeRollup` is fully deterministic and pure:

```ts
export type RollupHandler = "count" | "sum" | "avg" | "min" | "max" | "list";
export type RollupValue = number | string | null;

interface RelatedRow {
  row: string[];
}

export function computeRollup(
  related: RelatedRow[],
  targetIndex: number,
  filter: { index: number; equals: string } | undefined,
  handler: RollupHandler,
): RollupValue {
  const rows = filter
    ? related.filter((r) => (r.row[filter.index] ?? "") === filter.equals)
    : related;

  const values: number[] = [];
  for (const r of rows) {
    const raw = r.row[targetIndex];
    if (raw === undefined || raw === "") continue;
    const n = Number(raw);
    if (Number.isNaN(n)) continue;
    values.push(n);
  }

  switch (handler) {
    case "count": return rows.length;
    case "sum": return values.length ? values.reduce((a, b) => a + b, 0) : null;
    case "avg": return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    case "min": return values.length ? Math.min(...values) : null;
    case "max": return values.length ? Math.max(...values) : null;
    case "list": return values.length ? values.join(", ") : "";
    default: return null;
  }
}
```

The caller (query layer) knows the related database's column list and passes `targetIndex` and `filter.index`. This keeps `computeRollup` pure and deterministic.

- [ ] **Step 4: Run the rollup test**

Run:
```bash
npx tsx --test test/rollup.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Re-export rollup helpers**

In `src/query/index.ts` add:

```ts
export { computeRollup } from "./rollup";
export type { RollupConfig, RollupValue } from "./rollup";
```

- [ ] **Step 6: Commit**

Run:
```bash
git add src/query/rollup.ts test/rollup.test.ts src/query/index.ts
git diff --cached --check
git commit -m "feat(query): add pure rollup aggregator"
```

---

### Task 3: Compute Formula And Rollup Values In `runQuery`

**Files:**
- Modify: `src/query/index.ts` (integrate computation into `runQuery`)
- Modify: `src/query/record.ts` (add `computed?: Record<number, string>` to `QueryResultRow`)
- Modify: `src/query/resolve.ts` (resolveValue handles formula/rollup column types)
- Modify: `test/query-formula.test.ts` (new) — or extend `test/chart.test.ts`
- Modify: `src/query/index.ts` (export a `computeDisplayValue`/computed helper for views)
- Test: `tsx --test test/query-formula.test.ts`.

**Interfaces:**
- Produces `QueryResultRow.computed?: Record<number, string>` — a map from column index to the displayed string for formula/rollup columns.
- Produces `runQuery(model, view, relationResolver?: RelationResolver): QueryResultRow[]` where `RelationResolver = (relation: { targetPath: string; column: string; valueColumn?: string }) => Array<{ row: string[] }>`.
- Produces `getDisplayValue(row: QueryResultRow, colIdx: number): string` — returns `row.computed[colIdx] ?? row.row[colIdx]`.
- Consumes: `evaluateFormula`/`FormulaEnv` from `./formula`, `computeRollup` from `./rollup` (uses `RollupHandler`), `QueryResultRow` from `./record`.

- [ ] **Step 1: Extend `QueryResultRow`**

In `src/query/record.ts`, add:

```ts
export interface QueryResultRow {
  row: string[];
  originalIndex: number;
  id: string;
  values: TypedValue[];
  computed?: Record<number, string>;
}
```

And add a helper:

```ts
export function getDisplayValue(row: QueryResultRow, colIdx: number): string {
  return row.computed?.[colIdx] ?? row.row[colIdx] ?? "";
}
```

Re-export `getDisplayValue` from `src/query/index.ts`.

- [ ] **Step 2: Extend `resolveValue` for formula/rollup**

`resolveValue` currently returns `empty` for unknown types. Add explicit branches so `formula`/`rollup` resolve to an empty typed value (their real value comes from `computed`). In `src/query/resolve.ts`, add `"formula" | "rollup"` to the fallthrough so they return `{ kind: "empty" }` (no raw cell). Extend `ColumnType` union in `src/types.ts`:

```ts
export type ColumnType = "text" | "number" | "date" | "checkbox" | "select" | "multiselect" | "note" | "title" | "relation" | "url" | "link" | "formula" | "rollup";
```

- [ ] **Step 3: Implement formula/rollup computation in `runQuery`**

In `src/query/index.ts`, change `runQuery` to accept an optional `RelationResolver` and to compute formula/rollup values after resolving rows, before filtering/sorting. Add:

```ts
import { evaluateFormula, FormulaEnv } from "./formula";
import { computeRollup } from "./rollup";
import { getDisplayValue } from "./record";
import { ColumnDef } from "../types";

export type RelationResolver = (opts: { targetPath: string; column: string; valueColumn?: string }) => { rows: Array<{ row: string[] }>; columns: ColumnDef[] };
```

Add a `computeComputed(row, model)` step:

```ts
function computeComputed(
  row: QueryResultRow,
  model: DatabaseModel,
  resolveRelation: RelationResolver | undefined,
): QueryResultRow {
  const computed: Record<number, string> = {};
  model.columns.forEach((col, colIdx) => {
    if (col.type === "formula" && col.formula) {
      const env: FormulaEnv = {
        getColumn: (name) => {
          const idx = model.columns.findIndex((c) => c.name === name);
          if (idx === -1) return null;
          return row.values[idx] !== undefined ? typedToFormulaValue(row.values[idx]) : null;
        },
        getRelatedNumbers: (relationColumn, valueColumn) => {
          const relCol = model.columns.find((c) => c.name === relationColumn);
          if (!relCol || !resolveRelation) return [];
          const targetPath = relCol.relationTargetPath ?? "";
          const { rows, columns } = resolveRelation({ targetPath, column: relationColumn, valueColumn });
          const vi = columns.findIndex((c) => c.name === valueColumn);
          if (vi === -1) return [];
          return rows.map((r) => {
            const raw = r.row[vi];
            const n = Number(raw);
            return Number.isNaN(n) ? 0 : n;
          });
        },
      };
      const cell = evaluateFormula(col.formula, env);
      computed[colIdx] = cell.kind === "error" ? `#ERROR: ${cell.message}` : String(cell.value);
    } else if (col.type === "rollup" && col.rollup && resolveRelation) {
      const relCol = model.columns.find((c) => c.name === col.rollup!.relationColumn);
      if (relCol) {
        const related = resolveRelation({ targetPath: relCol.relationTargetPath ?? "", column: relCol.name });
        // Resolve indices from the related database's columns — the resolver returns
        // { row: string[], columns: ColumnDef[] } so target/filter indices are known.
        const targetIndex = related.columns?.findIndex((c) => c.name === col.rollup!.targetColumn) ?? -1;
        const filter = col.rollup!.targetFilter
          ? { index: related.columns?.findIndex((c) => c.name === col.rollup!.targetFilter!.column) ?? -1, equals: col.rollup!.targetFilter!.equals }
          : undefined;
        if (targetIndex !== -1) {
          const value = computeRollup(related.rows as any, targetIndex, filter, col.rollup!.handler);
          computed[colIdx] = value === null ? "" : String(value);
        }
      }
    }
  });
  if (Object.keys(computed).length) row.computed = computed;
  return row;
}
```

And wire it into `runQuery` (after the resolve map, before filter). The `RelationResolver` is only used when the model has a relation column and the caller passes it; if undefined, formula aggregates/rollups over relations return empty (render blank). Add the `typedToFormulaValue` helper:

```ts
function typedToFormulaValue(v: TypedValue): FormulaValue {
  if (v.kind === "number") return v.number;
  if (v.kind === "text") return v.text;
  if (v.kind === "date") return v.date.toISOString();
  if (v.kind === "multi") return v.multi.join(", ");
  return null;
}
```

- [ ] **Step 4: Write a formula-query test**

Create `test/query-formula.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { runQuery, getDisplayValue } from "../src/query/index.ts";
import { DatabaseModel, ColumnDef } from "../src/types.ts";

const columns: ColumnDef[] = [
  { name: "Price", type: "number" },
  { name: "Qty", type: "number" },
  { name: "Total", type: "formula", formula: "Price * Qty" },
];

const model: DatabaseModel = {
  columns,
  rows: [["4", "3", ""], ["10", "2", ""]],
  views: [{ name: "Default", sorts: [], filters: [], hiddenColumns: [] }],
  formatVersion: 1,
};

test("formula column computes per row", () => {
  const out = runQuery(model, model.views[0]);
  assert.equal(out[0].computed?.[2], "12");
  assert.equal(out[1].computed?.[2], "20");
  // the raw cell stays empty (not written back)
  assert.equal(out[0].row[2], "");
});

test("getDisplayValue prefers computed", () => {
  const out = runQuery(model, model.views[0]);
  assert.equal(getDisplayValue(out[0], 2), "12");
});
```

(Import `runQuery` and `getDisplayValue` together at the top as shown. If tsx complains, import `getDisplayValue` from `../src/query/record.ts` instead.)

- [ ] **Step 5: Run typecheck + query suite**

Run:
```bash
npm run typecheck
npx tsx --test test/query-formula.test.ts test/chart.test.ts test/group.test.ts test/query-resolve.test.ts test/query-compare.test.ts test/query-filter.test.ts test/query-sort.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

Run:
```bash
git add src/types.ts src/query/record.ts src/query/resolve.ts src/query/index.ts test/query-formula.test.ts
git diff --cached --check
git commit -m "feat(query): compute formula and rollup columns in runQuery"
```

---

### Task 4: Column Schema And Config UI For Formula/Rollup

**Files:**
- Modify: `src/types.ts` (add `formula?`, `rollup?` to `ColumnDef`)
- Modify: `src/constants.ts` (add formula/rollup to COLUMN_TYPES + getTypeIcon)
- Modify: `src/components/ColumnModal.tsx` (formula/rollup config UI)
- Test: `npm run typecheck`.

**Interfaces:**
- Produces `ColumnDef.formula?: string` and `ColumnDef.rollup?: { relationColumn: string; targetColumn: string; handler: "count"|"sum"|"avg"|"min"|"max"|"list"; targetFilter?: { column: string; equals: string } }`.
- Produces COLUMN_TYPES entries `{ value: "formula", label: "Formula" }` and `{ value: "rollup", label: "Rollup" }`.
- Produces type icons for formula/rollup in `getTypeIcon`.

- [ ] **Step 1: Extend `ColumnDef`**

In `src/types.ts`, add to `ColumnDef`:

```ts
  formula?: string;
  rollup?: { relationColumn: string; targetColumn: string; handler: "count" | "sum" | "avg" | "min" | "max" | "list"; targetFilter?: { column: string; equals: string } };
```

- [ ] **Step 2: Add COLUMN_TYPES + icons**

In `src/constants.ts`, add to `COLUMN_TYPES`:

```ts
  { value: "formula", label: "Formula" },
  { value: "rollup", label: "Rollup" },
```

And to `getTypeIcon`:

```ts
    case "formula": return "ƒ";
    case "rollup": return "Σ";
```

- [ ] **Step 3: Add formula/rollup config to `ColumnModal.tsx`**

In `ColumnModalContent`, when `type === "formula"` show a textarea for the expression bound to `formula` (local state), and when `type === "rollup"` show selectors: relation column (select columns only), target column (all columns), handler (count/sum/avg/min/max/list), optional target filter (column + equals). On save, pass the formula string / rollup config through the existing `onSave` callback — this requires extending the `onSave` signature to include `formula` and `rollup`. Update `ColumnModalContentProps.onSave` and the `ColumnModalWrapper`/`DatabaseTable.handleColumnClick` callback signature accordingly.

Concretely:
- Add local state `formula` (default `column.formula || ""`), `rollup` (default `column.rollup`).
- The type select's `onChange` resets related config when switching away from formula/rollup.
- `handleSave` calls `onSave(name, type, options, wrapContent, titleNoteEnabled, titleNoteFolder, relationTargetPath, relationMultiple, formula, rollup)`.
- Update the prop type `onSave` in `ColumnModalContentProps` and the `ColumnModalWrapper` constructor signature, then the caller in `DatabaseTable.handleColumnClick` (which currently passes a callback without formula/rollup) to accept and dispatch them into the `UPDATE_COLUMN` action.

- [ ] **Step 4: Extend the `UPDATE_COLUMN` action**

In `src/components/DatabaseTable.tsx`, extend `Action.UPDATE_COLUMN` payload and the `handleColumnClick`/`UPDATE_COLUMN` reducer case to carry `formula?: string` and `rollup?: RollupConfig`. The `ColumnModalWrapper` constructor signature must be updated to the new `onSave` arity.

- [ ] **Step 5: Run typecheck**

Run:
```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

Run:
```bash
git add src/types.ts src/constants.ts src/components/ColumnModal.tsx src/components/DatabaseTable.tsx
git diff --cached --check
git commit -m "feat(view): add formula and rollup column config UI"
```

---

### Task 5: Render Computed Cells Read-Only In Every View

**Files:**
- Modify: `src/components/Cell.tsx` (formula/rollup → read-only display)
- Modify: `src/components/TableRow.tsx` (use `getDisplayValue`)
- Modify: `src/components/KanbanCard.tsx` (use computed value for formula/rollup)
- Modify: `src/components/ListView.tsx` (use computed value)
- Modify: `src/components/GalleryView.tsx` (use computed value)
- Modify: `src/components/RowDetailModal.tsx` (formula/rollup read-only display)
- Test: `npm run typecheck` + manual Obsidian smoke.

**Interfaces:**
- Produces read-only rendering of formula/rollup columns everywhere; no `onChange` for computed cells.
- Consumes: `getDisplayValue` from `../query/record`.

- [ ] **Step 1: Make `Cell` render computed columns read-only**

In `src/components/Cell.tsx`, add early branches before the text fallback:

```tsx
  if (column.type === "formula" || column.type === "rollup") {
    return (
      <td className={`csv-db-cell csv-db-cell-computed${column.wrapContent ? " csv-db-cell-wrap" : ""}`}>
        <span className="csv-db-cell-computed-value">{value === "" || value == null ? "" : value}</span>
      </td>
    );
  }
```

The `value` passed to `Cell` is the raw `row[dataIdx]` — but for computed columns we want `getDisplayValue(row, dataIdx)`. So `TableRow` must pass the computed display value for formula/rollup columns. Update `DatabaseTable`/`TableRow` to compute the displayed value.

- [ ] **Step 2: Pass computed display value through `TableRow`**

`TableRow` receives `row: string[]` currently. Change it to receive `QueryResultRow` so it can call `getDisplayValue`. In `TableBody`, map `RowLine`/`TableRow` to pass `row.originalIndex` and the resolved display per column. Simplest: change `TableRow`/`TableBody` to accept the full `QueryResultRow` and use `getDisplayValue(row, dataIdx)` for its cell values (instead of `row[dataIdx]`), while `onSetCell(rowIdx, dataIdx, value)` still writes to the raw row via `rowIdx = originalIndex`. Update `TableBody.tsx` to pass `row: QueryResultRow` and read display values accordingly.

- [ ] **Step 3: Apply the same computed-display in Kanban/List/Gallery/Detail**

For `KanbanCard`, `ListView`'s `RowLine`, `GalleryView`, and `RowDetailField`: where they read `row[dataIdx]`, use `getDisplayValue(row, dataIdx)` so formula/rollup columns show their computed value. These components currently receive raw `row: string[]`; pass the `QueryResultRow` (they already have `row.originalIndex` in some) or pass a precomputed display tuple. Prefer threading the `QueryResultRow` and calling `getDisplayValue`.

- [ ] **Step 4: Run typecheck**

Run:
```bash
npm run typecheck && npm run build && npm run test:offline
```
Expected: PASS.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/components/Cell.tsx src/components/TableRow.tsx src/components/TableBody.tsx src/components/KanbanCard.tsx src/components/ListView.tsx src/components/GalleryView.tsx src/components/RowDetailModal.tsx
git diff --cached --check
git commit -m "feat(view): render formula and rollup columns read-only"
```

---

### Task 6: Styles And Verify In Obsidian

**Files:**
- Modify: `styles.css`
- Modify: `package.json` (add `test:formula`, `test:rollup`, `test:queryFormula`)
- Create: `docs/superpowers/verification/2026-09-03-rowbase-formula-rollup.md`
- Test: `npm run check:baseline` + manual Obsidian smoke.

**Interfaces:**
- Produces CSS classes: `csv-db-cell-computed`, `csv-db-cell-computed-value`.
- Wires all new test files into `check:baseline`.

- [ ] **Step 1: Add styles**

Append to `styles.css`:

```css
.csv-db-cell-computed { font-style: italic; color: var(--text-muted); font-weight: 500; }
.csv-db-cell-computed-value { white-space: nowrap; }
```

- [ ] **Step 2: Wire tests into `package.json`**

Add:

```json
"test:formula": "tsx --test test/formula.test.ts",
"test:rollup": "tsx --test test/rollup.test.ts",
"test:queryFormula": "tsx --test test/query-formula.test.ts"
```

And extend `check:baseline`:

```json
"check:baseline": "npm run typecheck && npm run test:metadata && npm run test:csvdb && npm run test:query && npm run test:chart && npm run test:formula && npm run test:rollup && npm run test:queryFormula && npm run build && npm run test:offline"
```

- [ ] **Step 3: Run the gate**

Run:
```bash
npm run check:baseline
```
Expected: all green.

- [ ] **Step 4: Rebuild and reload Obsidian**

Run:
```bash
npm run build
```
Reload Obsidian in `$HOME/rowbase-dev-vault`. Confirm no console errors.

- [ ] **Step 5: Verify formula + rollup**

Add a Formula column (e.g. `Price * Qty`), confirm it computes live in the table as read-only, and that editing Price or Qty recomputes it. Add a Rollup column over a relation, confirm it aggregates the related column. Confirm the formula/rollup columns are NOT editable (no inline editor) and that the `.csvdb` file stores the expression/config, not the computed value.

- [ ] **Step 6: Run baseline gate and commit verification notes**

Run:
```bash
npm run check:baseline
```
Expected: all green. Create `docs/superpowers/verification/2026-09-03-rowbase-formula-rollup.md` documenting steps/results, then commit:

```bash
git add styles.css package.json docs/superpowers/verification/2026-09-03-rowbase-formula-rollup.md
git diff --cached --check
git commit -m "test: verify formula and rollup columns in Obsidian"
```

## Plan Completion Gate

Phase 5 is complete when:

- `src/query/formula.ts` provides `evaluateFormula` (safe, no eval) — tested; re-exported.
- `src/query/rollup.ts` provides `computeRollup` — tested; re-exported.
- `runQuery` computes formula/rollup columns into `QueryResultRow.computed`; `getDisplayValue` reads computed-first.
- `ColumnType`/`ColumnDef` carry `formula`/`rollup`; COLUMN_TYPES/icons updated; ColumnModal config UI present.
- Formula/rollup columns render read-only in Table, Kanban, List, Gallery, and RowDetail; computed values never written to raw `.row` cells.
- `.csvdb` stores the expression/config, not computed values (human-readable, backward compatible).
- `npm run check:baseline` green (incl. formula/rollup/queryFormula tests); offline audit passes.
- Obsidian smoke confirms live recompute on edit, read-only computed cells, and relation-based rollups.

The next phase (Phase 6: cross-database relations hardening with stable row IDs, then rollup-to-relation wiring) starts after this gate.
