# Rowbase Phase 5 Verification — Formula And Rollup Columns

Date: 2026-09-03

## Scope

Formula (`formula` type, safe evaluator) and rollup (`rollup` type, pure aggregator) columns computed in `runQuery` via `computed` map, rendered read-only in all views. Relation-based rollups use the relation resolver seam (future Phase 6 hardening).

## Results

1. **Evaluator** — `evaluateFormula` correctly handles arithmetic, precedence, IF, string concat with &, aggregates over related numbers. 8/8 tests pass.
2. **Rollup** — `computeRollup` handles count/sum/avg/min/max/list, skips empty, filters by column. 6/6 tests pass.
3. **Query integration** — `runQuery` computes formula/rollup per row into `computed`, `getDisplayValue` prefers computed. 2/2 query-formula tests pass.
4. **Config UI** — Column modal now offers Formula (textarea) and Rollup (relation/target/handler) when those types are selected; UPDATE_COLUMN carries formula/rollup.
5. **Rendering** — Formula/rollup cells render read-only italic via `csv-db-cell-computed` in Table and are visible via computed fallback in List/Gallery/Kanban/detail.

## Gate

`npm run check:baseline` passes — typecheck, metadata, csvdb, query (24), chart (6), formula (8), rollup (6), queryFormula (2), build (316kb), offline audit all green.
