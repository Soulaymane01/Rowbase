# Rowbase Design Specification

Date: 2026-09-03

## Decision Summary

Rowbase will be built as a standalone Obsidian plugin repository at
`/home/soulaymane/dev/rowbase`, using `jysperm/obsidian-csv-database` as its
upstream codebase. The implementation will be an engineering fork, not a
runtime dependency, wrapper, or plugin extension installed alongside the
upstream project.

The project documentation remains in
`/home/soulaymane/Main/Haven/projects/rowbase/`. This design document lives in
the source repository so the implementation decisions travel with the code.

## Why CSV Database

The base already provides the strongest foundation for Rowbase's data model:

- One human-readable `.csvdb` file contains rows and schema metadata.
- A dedicated Obsidian file view owns the database panel.
- Typed columns include title, select, multi-select, date, checkbox, note, and
  relation.
- Saved views already carry sort, filter, grouping, and hidden-column state.
- Multi-column sorting, inline editing, drag-reorder, and auto-save exist.
- Cross-database relation handling already exists and can be hardened.

Database Views has more of the desired basic view surface, but lacks relations,
formulas, rollups, and rich filtering. DataDeck has the strongest chart and
formula code, but its schema and saved-view model are less suitable as the
primary Rowbase foundation. DataDeck's optional Anki integration also violates
Rowbase's strict offline runtime policy unless removed.

## Fork Strategy

The source will be copied into the standalone Rowbase repository and rebranded.
The original MIT license and attribution will be preserved. An `UPSTREAM.md`
file will record the upstream URL, starting commit, inherited areas, and any
selectively ported code. The upstream repository may be retained as a Git
remote for comparison, but Rowbase will own its build, release, and plugin
identity.

Rowbase will not depend on the upstream package at build time or runtime. The
source tree will be progressively reorganized only where that improves the
boundaries needed by the feature set; unrelated upstream behavior will not be
carried forward automatically.

## Hard Constraints

1. Every database uses exactly one `.csvdb` file. There is no one-record-per-
   note storage model.
2. Databases open in a dedicated Obsidian view, never as SQL code blocks in
   notes.
3. Runtime behavior is fully offline. No HTTP requests, WebSockets, telemetry,
   CDN assets, or remote service calls are allowed.
4. The initial release is desktop-first and remains `isDesktopOnly: true` until
   a deliberate mobile pass is complete.
5. Database files remain human-readable and compatible with the selected base's
   storage contract.

## Storage Contract

The existing `.csvdb` format is the compatibility contract:

- The file is valid CSV.
- The first row stores JSON column definitions.
- The first column's metadata also stores the format version and saved views.
- Remaining rows store record values as CSV cells.
- New metadata fields are optional so older files continue to parse.
- Unknown metadata fields are preserved during round trips where practical.

Database schema, records, saved views, relation definitions, formula
definitions, and rollup definitions belong in the `.csvdb` file. Only
installation or UI preferences that are not part of the database itself may
live in Obsidian's plugin `data.json`.

### Row Identity

Relations require stable references. Rowbase will add an optional internal row
ID column or equivalent metadata-backed ID representation and migrate existing
rows safely:

- Existing rows receive generated IDs during the first migration that needs
  them.
- IDs are persisted in the database file.
- Display titles remain editable and are never relation keys.
- Relation values reference the target database path and row ID.
- Legacy title-based relation values, if present, are resolved and migrated.

## Architecture

### Storage And Migration

This layer parses and serializes `.csvdb`, validates and normalizes schema,
preserves compatible unknown metadata, and applies explicit format migrations.
It has no DOM or Obsidian UI dependency.

### Query Engine

This layer converts raw cells into typed values and produces the shared derived
dataset consumed by every view. The pipeline is:

1. Load and normalize raw rows.
2. Resolve typed values.
3. Compute formulas.
4. Resolve relations and rollups.
5. Apply filters.
6. Apply grouping.
7. Apply multi-column sorting.
8. Apply hidden-column and display settings.
9. Render the result.

All mutations use one shared API so cell edits, kanban moves, relation changes,
and bulk operations share validation and persistence behavior.

### View Model

The view layer contains table, kanban, list, gallery, and chart renderers plus
the saved-view toolbar and configuration UI. Renderers do not implement their
own filtering or sorting; they consume query results.

### Obsidian Integration

This layer owns file registration, workspace lifecycle, vault reads and writes,
cross-database file observation, relation invalidation, notices, menus, and
modals. It adapts the core model to Obsidian without putting Obsidian APIs into
formula, filter, or query logic.

## Data Model

Supported column types are:

- `text`
- `number`
- `date`
- `checkbox`
- `select`
- `multi-select`
- `note`
- `url`
- `link`
- `relation`
- `formula`
- `rollup`

Select and multi-select options retain defined order and color metadata.
Relations retain target path, single/multiple behavior, and link direction.
Formula columns retain a safe expression. Rollups retain relation column,
target column, aggregation, and optional target filter configuration.

## Query Semantics

### Sorting

Sorting supports multiple ordered rules with ascending or descending direction.
Numbers and dates use typed comparison. Select values use their configured
option order before falling back to stable text ordering. Empty values have a
consistent last-position policy.

### Filtering

Text, URL, note, select, and relation values support equals, is not, contains,
does not contain, starts with, is empty, and is not empty.

Numbers support equals, is not, greater than, less than, between, is empty, and
is not empty. Dates support equals, before, after, between, is empty, and is not
empty. Multi-select contains semantics match any selected value; does-not-
contain requires no matching value.

Invalid or incomplete filters fail closed and expose an inline configuration
warning instead of silently returning misleading results.

### Formulas

Formulas use a small explicitly whitelisted parser and evaluator. They do not
use `eval`, `Function`, or generated JavaScript. Supported operations will cover
arithmetic, comparisons, string concatenation, conditionals, and approved
aggregate functions over linked rows. Formula values are computed in memory and
are not duplicated into raw cells. Cycles and evaluation failures are detected
and shown as per-column errors such as `#ERROR` with a configuration detail.

### Rollups

Rollups aggregate related rows using count, sum, average, minimum, maximum, or
list. An optional target filter narrows the related set. Rollups recompute when
the source database or a referenced database changes.

## Interaction Design

The existing table and kanban interactions will be retained where compatible.
List and gallery will be first-class views over the same query output. Chart
will support bar, line, pie, and area modes, with grouping and color dimensions
applied after filtering. Saved views remain tabs containing view type, filters,
sorts, grouping, and hidden columns.

Cell edits validate against the column type before saving. Saves are debounced
and write the complete `.csvdb` through the Obsidian vault API. Kanban dragging
updates the grouped select value. Relation pickers search `.csvdb` files and
display stable row titles. Destructive actions use undo or confirmation.
External file changes trigger re-read and re-query rather than leaving stale
data visible.

## Offline And Dependency Policy

All runtime dependencies must be bundled into the plugin and operate on local
inputs only. Dependencies are reviewed before introduction. No network-capable
feature from an upstream plugin is retained. In particular, optional
localhost-based integrations are excluded from Rowbase.

The source and built bundle will be audited for fetch, XHR, WebSocket, remote
asset, telemetry, dynamic-code, and secret-access patterns. This is an audit
requirement, not a claim that a package is safe merely because its source is
small.

## Delivery Phases

Each phase must pass verification before the next begins.

1. Fork Rowbase, rebrand it, preserve `.csvdb` compatibility, and verify the
   baseline in a separate Obsidian development vault.
2. Extract or stabilize the shared query model and implement rich filters.
3. Add list and gallery views.
4. Add chart view, selectively porting DataDeck's chart algorithms and safe
   formula parser where useful.
5. Add formula columns and dependency/cycle handling.
6. Harden cross-database relations, stable row IDs, and invalidation.
7. Add rollup columns over the relation model.
8. Polish semantic Obsidian theming, desktop UX, and mobile behavior.
9. Prepare release metadata, README, screenshots, MIT attribution, CSP, and
   community-store submission materials.

## Verification Strategy

Unit tests will cover CSV parsing and round trips, backward compatibility,
migrations, row IDs, every filter operator, typed comparisons, multi-column
sorting, grouping, saved views, formula evaluation, cycle detection, relation
resolution, rollups, and mutation serialization.

View smoke tests will cover all five views, empty and invalid states, inline
editing, kanban updates, saved-view switching, relation display, and formula
display.

The phase gate is:

1. Typecheck and unit tests.
2. Production bundle build.
3. Offline/network audit.
4. Installation in a separate Obsidian development vault.
5. Manual smoke test of the changed feature.
6. One logical Git commit.

## Open Implementation Detail

The exact physical representation of stable row IDs within the CSV remains an
implementation detail to be selected during the baseline migration phase. The
choice must preserve human readability, avoid breaking existing columns, and
keep relation references stable across title edits and row reordering.
