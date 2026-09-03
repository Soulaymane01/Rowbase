# Rowbase Phase 3 Verification — List And Gallery Views

Date: 2026-09-03

## Scope

List and Gallery layouts built on the `runQuery` result, sharing a pure
`groupRowsBySelect` helper with Kanban. Verified in the isolated dev vault
(`$HOME/rowbase-dev-vault`), symlinked to the source repo. Production Haven vault
unmodified.

## Results

1. **Reload** — No console errors. The View menu now shows **List** and
   **Gallery**. ✅
2. **List** — Rows render as compact lines. Setting a group-by select column
   (via View menu → Group by) produces collapsible sections in option order with
   a "No value" group; collapse/re-expand works. Clicking a row opens the detail
   modal; editing a field persists. ✅
3. **Gallery** — Responsive card grid. Setting a cover column renders cover
   images (vault path and/or https URL). Clicking a card opens the detail modal;
   editing persists; delete ✕ removes the row. ✅
4. **Save-back under filter+sort** — After applying a filter/sort, edits in List
   and in Gallery detail write to the correct underlying rows (no index shift). ✅
5. **Table/Kanban unaffected** — Table and Kanban (incl. grouping) still render
   and work as before. ✅

## Verification-discovered fix

The Group-by picker was initially gated to Kanban only, so List-view users had no
way to choose a grouping column (List groups via the same `groupByColumn`). Fixed
by expanding the ViewMenu gating condition to `(activeLayout === "kanban" ||
activeLayout === "list")`. Reviewed ADDRESSED; typecheck/build/offline pass.

## Console observation

Intermittent `removeChild`/`NotFoundError` (recorded in Phase 2 verification) did
not recur during this pass.

## Gate

`npm run check:baseline` passes — typecheck, metadata, csvdb, query (20 tests),
build (main.js 299kb), offline audit all green.
