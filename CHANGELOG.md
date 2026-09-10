# Release 0.1.3

Rowbase 0.1.3 is a major polish release: every view was reworked, a new
column type and computation features were added, and the timeline, charts,
stats, and dashboard were rebuilt to be genuinely usable.

## New column type & data

- **Progress columns** — store 0–100 and render as a bar or ring everywhere
  (table, kanban, list, gallery, row details, chart, stats, timeline fill).
  Values behave as numbers for sorting, filtering, and aggregation.
- **Calculation footer row** in the table — per-column aggregations (Sum,
  Average, Median, Min, Max, Range, counts, percentages, Earliest/Latest,
  checkbox totals), persisted per column.

## Views

- **Timeline — rebuilt.** A movable time window: drag anywhere to pan, drag
  the edges to resize, wheel to scroll, Ctrl/Cmd+wheel or +/− to zoom,
  Today/Fit controls. Start/End/Color-by/Label fields and the group-by
  column are configurable per view. Bars can be dragged to move a task and
  resized at their edges, writing the new dates back to the table as a
  single undo step.
- **Charts — rebuilt.** Responsive SVG with proper axes, gridlines, legends,
  tooltips, and value labels; grouped or stacked bars; a donut pie with a
  center total; negatives supported. Aggregations now include Min/Max/
  Median and categories can be sorted (natural or by value).
- **Stats — rebuilt.** Distributions for select *and* multiselect (with
  unused options and "No value"), checkbox stats, field-coverage, numeric
  cards with Sum/Range, per-column monthly date bars, and summary cards for
  rows/columns/filled-cells/date-range.
- **Dashboard — rebuilt.** Smarter habit detection, correct today-row
  resolution, last-7 strips and recent-rate on habit cards, and an activity
  heatmap that fills the view width with a legend, totals, and a today
  outline.
- **Kanban** — drag column headers to reorder (persisted), hide columns per
  view with a restore bar, and title-style column headers.
- **List** — fills the full view, row selection, row numbers, better
  property rendering, group color dots, and a proper empty state.
- **Gallery** — bigger cards and covers, robust cover resolution
  (wikilinks/embeds/vault files/URLs), gradient placeholders, selection,
  and better rendering.

## Table & interaction

- **Row selection** with a shared selection bar (Delete / Clear) across
  table, list, and gallery.
- **Per-column search** (text-based) that filters every view.
- **Quick sort** controls in column headers (asc/desc/clear, multi-sort
  order).
- **Double-click a view tab to rename** it; a "+" button adds views and the
  view menu can duplicate views.
- **Cell dropdowns flip above** when there's no room below; long dropdowns
  no longer get cut off.
- **Show row numbers** setting (table + list).

## Settings

- Settings are grouped (General / New database template / Linking defaults /
  Display) with a validated template-columns editor (live validation, column
  preview, Format and Reset to default).
- The sidebar ribbon icon was removed — create databases from the command
  palette or by right-clicking a folder.

## Docs & tooling

- **SKILL.md** — a self-contained guide for AI agents to create and edit
  `.rbase` files through direct file manipulation.
- Test suites for stats, dashboard, timeline, and relations were wired into
  `check:baseline`; new tests cover the aggregation engine and all query
  modules.