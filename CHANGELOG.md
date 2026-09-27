# Release 0.1.5

Follow-up patch for 0.1.4: matrix drag-and-drop, clickable links in Gallery,
filter-aware row creation, and fixes for rollups, relative relation paths,
lazy `IF`, and the default-template migration.

## Fixes

- **Rollup / relation resolution across folders** — relative relation targets
  containing `..` (e.g. `../Tasks.rbase`) were resolved to an unnormalized
  vault path, so the resolver never found the target file and rollup columns
  stayed empty. Targets are now normalized before lookup, so rollups and
  cross-relation formula aggregates work for same-folder, `../`, and
  vault-root (`/file.rbase`) targets alike.
- **Rollups with an empty relation** — an empty relation cell made the
  resolver return *every* row of the target database, so `count`/`sum` rollups
  aggregated the whole table. An empty relation now aggregates nothing.
- **`IF` evaluates only the taken branch** — both branches used to be
  evaluated, so the documented pattern
  `IF(Done, DAYS(Scheduled, Done), "")` failed on rows without an end date
  with `#ERROR: DAYS needs valid dates`. The untaken branch is now skipped.
- **Default Title column for existing vaults** — settings saved before 0.1.4
  kept the old text-first template, so "new database" still started with a
  text column. Untouched legacy templates are migrated to the Title-first
  default on load (custom templates are left alone).
- **Gallery cards: links are clickable, covers are real images** — URL and
  Link values on gallery cards now open the browser / the note, while
  clicking anywhere else on the card still opens the row editor. Cover
  detection no longer turns any URL column into an empty cover area: a cover
  is only used when it can render (a column named Cover/Image/Photo/…, an
  Image-type column, or a URL column whose values really are images). Link
  galleries get compact cards and clickable text.

## New

- **Matrix drag-and-drop** — drag cards between the four Eisenhower quadrants
  (with a drag ghost and drop-target highlight, like the kanban board).
  Dropping writes the importance and urgency columns: checkbox columns get
  `true`/`false`, select columns get the configured "high" value (or the
  option that reads as high) and a non-high option; date urgency columns are
  left unchanged when they can't express the quadrant.
- **Filter-aware "+ New"** — creating a row from a filtered view now
  pre-fills the values the active filters imply, so the row no longer
  disappears the moment it is created (the "I clicked + New and nothing
  happened" kanban papercut). `equals` writes the exact value,
  `contains`/`starts-with` writes the search text, multiselect filters write
  all selected values; rules with no unambiguous value (`is not`,
  `does not contain`, ranges, `is not empty`) are left alone. Works from the
  kanban "+ New", the table's "+ New row", and Cmd/Ctrl+Enter; a kanban
  column's group value still wins over a conflicting filter value.

## Verified

- **`DAYS(start, end)`** is covered by an end-to-end test through
  `serializeCSV` → `parseCSV` → `runQuery` (7-day gap, reversed dates, same
  day, missing date → error).

# Release 0.1.4

Rowbase 0.1.4 is a bug-fix and usability release: formulas can divide again,
link/URL and image cells became first-class, the kanban board edits fields
inline, and a new Eisenhower matrix view landed alongside the beta feedback
fixes.

## Fixes

- **Division (`/`) in formulas** — the tokenizer treated `/` as an identifier
  character, so `10 / 4` failed with "bad identifier" and `6 / 2` with
  "trailing tokens". `/` is now a proper operator: `a / b`, `10 / 4`,
  `1 + 2 / 2`, and `(a / b) * 3` all work. Column names can no longer contain
  `/` (use spaces instead).
- **Link & URL cells** — both rendered as plain text. URL cells now show a
  clickable link that opens the browser (bare domains get `https://`), and
  Link cells open the note in the vault. Both support "Wrap content", and
  the edit action is always available next to the value.
- **Toolbar icons on tablet** — Obsidian's tablet rule
  `body.is-tablet button:not(.clickable-icon)` injected `4px 20px` padding
  into every button, shrinking the toolbar/icon-only buttons' SVG to zero
  width. The plugin's button padding is now re-asserted on tablet, so
  Filter/Sort/Fields/Pick random/View options are visible again.

## New

- **Eisenhower matrix view** — a four-quadrant board (Do first / Schedule /
  Delegate / Eliminate) driven by existing columns. Pick an importance
  column (select or checkbox) and an urgency column (select, checkbox, or
  date — overdue or due within 7 days counts as urgent), and optionally
  which select value counts as high. Rows click through to the detail modal.
- **Inline kanban editing** — edit card fields directly on the board: text,
  number, date, select, multiselect, checkbox, and progress values can be
  changed without opening the row.
- **Wikilinks in text cells** — `[[Note]]`, `[[Note|alias]]`, and
  `[[Note#heading]]` render as clickable links in table, list, gallery, and
  kanban text fields; clicking opens the note.
- **Image column type** — pick from vault images (with thumbnails and search)
  or paste a URL; cells show a thumbnail, and the gallery uses image columns
  as covers. `![[image.png]]` embeds are normalized too.
- **`DAYS(start, end)` formula** — date difference in days between two date
  columns (shipped in `6bf7c70`, released here).

## UX (beta feedback)

- **New databases start with a Title column** — the built-in template's
  first column is now a real `title` column instead of text.
- **Title column behavior** — a single "Title behavior" selector replaces
  the two conflicting toggles: note only, folder only, note + folder, or no
  linking. The cell shows only the button(s) for the chosen mode.
- **Note columns** — per-column default folder for new notes (falls back to
  the Title column's folder), plus an "Allow multiple notes" option with
  pill-based multi-selection in the cell.
- **Rollup target column** — "Target column" is now a dropdown fed from the
  related database's columns (loaded through the selected relation), instead
  of a free-text field.

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