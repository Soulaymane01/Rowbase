# Rowbase Phase 2 Verification — Query Engine And Rich Filters

Date: 2026-09-03

## Scope

Shared query engine (`src/query/`) + rich filter operators + type-aware filter UI,
routed through the table view. Verified in the isolated dev vault
(`$HOME/rowbase-dev-vault`), symlinked to the source repo. Production Haven vault
unmodified.

## Results

1. **Rich operators (number)** — Greater than / Less than / Between all appear and
   narrow rows correctly. Between shows two inputs (From/To). ✅
2. **Date column** — Before / After / Between appear; Between uses date inputs. ✅
3. **Text column** — Starts with / Does not contain appear. ✅
4. **Is empty** — Shows only blank rows. ✅
5. **Saved-view compatibility** — A view saved with a `between` operator reloads
   and applies correctly (schema unchanged, `value` length 2). Previously-saved
   `contains` views still work. ✅
6. **Save-back correctness** — After filtering/sorting, editing a cell writes to
   the correct underlying row (no index shift). Kanban still opens and drags
   correctly. ✅

## Console observation (intermittent, pre-existing)

During extended filter-UI smoke testing a single console error was observed:

```
plugin:rowbase:8 Uncaught NotFoundError: Failed to execute 'removeChild' on 'Node':
The node to be removed is not a child of this node.
```

Investigation: this is a React DOM portal/unmount `commitDeletion` failure. Code
diff against upstream shows it lives in the unchanged shared view/portal layer — the
view lifecycle (`database-view.ts`), `main.ts`, React tree, portals, and row keys
are byte-identical to the upstream base, and this phase's changes are confined to
the pure `src/query/` engine and an additive filter-UI diff (no new portals). It did
not reproduce on any isolated re-test of the filter editor, operator/column switch,
Save/Reset/hide bar, save-as-new-view, Escape, or click-outside.

Suspected mechanism (not confirmed — needs a reproducible case to pin): a portal
popover node already detached from the DOM when React commits a deletion, i.e. the
filter value dropdown or select popover being torn down while the filter bar/unmount
path runs.

## Treatment

Non-blocking and not reproducible on demand. Recorded for follow-up: if it recurs,
capture the exact triggering action and fix in the shared view layer (not the query
engine). The baseline gate (`npm run check:baseline`) passes — typecheck, metadata,
csvdb, query (21 tests), build, offline audit all green.

## Follow-up item (later enhancement, not blocking)

Single-value number/date operators (e.g. Greater than on a number) currently use a
plain text input; only `between` uses typed date/number inputs. Brief-scoped.
