# CSV Database Plugin

## .rbase File Format

### Format Version

The first column's header cell JSON includes a `formatVersion` field. The current format version is `1`. If `formatVersion` is absent, it is treated as version `1`. This field enables future format migrations.

### Header Row

The first row contains column definitions. Each cell is a JSON object. The first cell also carries database-level metadata alongside the column definition (`ColumnDef & DatabaseMetadata`):

```typescript
interface DatabaseMetadata {
  formatVersion: number;  // current: 1
  views: ViewDef[];       // see ViewDef Schema below
}
```

```
"{""name"":""Title"",""type"":""text"",""formatVersion"":1,""views"":[...]}","{""name"":""Status"",""type"":""select"",""options"":[{""value"":""Todo"",""color"":""red""},{""value"":""Done"",""color"":""green""}]}"
```

### ColumnDef Schema

```typescript
interface ColumnDef {
  name: string;           // unique across all columns
  type: "text" | "number" | "date" | "checkbox" | "select" | "multiselect" | "note" | "title" | "relation" | "progress";
  options?: Array<{ value: string; color?: string }>;
  titleNoteEnabled?: boolean;
  titleNoteFolder?: string;
  relationTargetPath?: string;
  relationMultiple?: boolean;
  width?: number;         // column width in pixels, default 180
  columnIndex?: number;   // display order, defaults to positional index
  wrapContent?: boolean;  // wrap cell content to multiple lines, default false
  progressStyle?: "bar" | "ring"; // progress columns only, default "bar"
  aggregate?: string;     // footer aggregation id (see Calculation Footer Row)
}
```

Color values: see Color Palette below.

### ViewDef Schema

The `views` array is stored in the first column's header cell JSON alongside the column definition. If no `views` field is present, a default view is used.

```typescript
interface SortRule {
  column: string;       // column name
  direction: "asc" | "desc";
}

type FilterOperator = "contains" | "does-not-contain" | "is-empty" | "is-not-empty";

interface FilterRule {
  column: string;       // column name
  operator: FilterOperator;
  value: string[];      // for contains/does-not-contain; array of values to match against
}

type ViewLayout = "table" | "kanban";

interface ViewDef {
  name: string;
  layout?: ViewLayout;           // absent = "table"
  sorts: SortRule[];
  filters: FilterRule[];
  hiddenColumns: string[];       // column names to hide
  groupByColumn?: string;        // select column name (kanban only)
}
```

### Data Storage by Type

| Type        | Storage Format                          | Example            |
| ----------- | --------------------------------------- | ------------------ |
| text        | Plain text                              | `Hello world`      |
| number      | Numeric string                          | `42.5`             |
| date        | ISO 8601 date                           | `2024-01-15`       |
| checkbox    | `true` / `false`                        | `true`             |
| select      | Option value string                     | `Todo`             |
| multiselect | Pipe-separated values (with escaping)   | `Tag1|Tag2|Tag3`   |
| note        | Vault-relative file path                | `folder/My Note.md` |
| title       | Unique row title                        | `Project Alpha`    |
| relation    | Title value, or pipe-separated titles   | `Project Alpha`    |
| progress    | Number 0–100                            | `45`               |

### Note Editing Behavior

`note` cells store a note reference string. The editor supports both:

- Selecting an existing note from the dropdown search results
- Entering an arbitrary vault-relative path string directly

Typing a path and pressing Enter commits it immediately. Moving focus away from the note editor also commits the typed path.

The note editor uses a single-value combobox interaction: opening it places the current value directly in the input and selects it, so typing replaces the existing value instead of appending to it.

In display mode, note cells show an action button instead of a status badge: `OPEN` is always visible when the target note exists, while `CREATE` only appears on hover when the stored path does not currently exist in the vault.

Stored values may include the `.md` suffix or omit it. Existence checks and opening use Obsidian's link resolution directly. If nothing resolves, opening the note passes the stored value to Obsidian, which creates the target note.

### Title and Relation Behavior

Each database can have at most one `title` column. Title values are kept unique within the database by appending a numeric suffix when needed. A database must have a title column before it can be selected as a `relation` target.

Title columns have a `Link to note` setting, enabled by default. When enabled, title cells show an `OPEN` / `CREATE` action and resolve notes from the title value. `titleNoteFolder` controls where those notes live and is preserved even when `Link to note` is disabled: folder paths starting with `/` are relative to the vault root, while other folder paths are relative to the current `.rbase` file's folder. When `Link to note` is disabled, the title is only a unique row label and no note path is resolved.

Relation columns store the target row's title value. Multi-relation columns use the same pipe-separated escaping format as multiselect columns. The relation picker lists rows from the target database's title column. `relationTargetPath` uses the same path rules as `titleNoteFolder`: paths starting with `/` are relative to the vault root, while other paths are relative to the current `.rbase` file's folder.

Self-relations are allowed. When a relation targets the current database, candidates are read from the in-memory model rather than re-reading the current file from disk.

Renaming a title value does not update relation cells in other databases. This is a known limitation of using the title as the stored relation identity: existing relations keep the old title string until edited manually.

### Multiselect Escaping

Multiselect values are separated by `|`. To support literal `|` and `\` characters in option values, a backslash escape mechanism is used:

- `\|` → literal `|`
- `\\` → literal `\`
- Unescaped `|` is the value separator

When encoding, each value has `\` escaped to `\\` and `|` escaped to `\|`, then values are joined with `|`. When decoding, the string is scanned character by character; `\` followed by any character produces that literal character; unescaped `|` splits values.

See the `examples/` directory for sample `.rbase` files.

## Features

### Column Display Order

Each column has a `columnIndex` field that determines its display position. The data order in the CSV file is independent of display order. Dragging columns only swaps `columnIndex` values.

### Column Drag-to-Reorder

Mousedown on a header cell + 5px drag threshold enters drag mode. Columns swap in real-time as the cursor crosses the current column's boundary, with a 150ms slide animation.

### Manual Row Ordering

Rows can be manually reordered in table layout when no sort rules are active. Hovering a row reveals a drag handle just outside the left edge. Dragging highlights only insert positions that would change row order, and committing the drag reorders `model.rows`.

### Row Selection and Multi-Row Operations

Each table row has a selection checkbox in the leftmost cell, next to the row name. The checkbox is revealed on hover (or when the row is selected). Selected rows get a subtle highlight. The header cell above holds a select-all checkbox that selects every row currently visible after filtering, sorting, and searching; it shows an indeterminate state when only some rows are selected.

With one or more rows selected, a selection bar appears between the filter/sort bar and the table showing the count with **Delete** (removes all selected rows in one `DELETE_ROWS` action) and **Clear** (deselects everything) actions. The selection stores original row indices, is pruned when rows are deleted, and is cleared after a delete. Single-row deletion is performed by selecting the row and pressing Delete in the selection bar.

### Column Search

Every column except `checkbox` has a magnifier toggle in its header. Clicking it opens a search input in a search row under the header; typing filters rows live (case-insensitive substring match against the cell's display value, including formula/rollup computed values). Multiple columns can be searched at once — terms combine with AND. Clicking the magnifier again closes that column's search and clears its term. Search inputs stop propagation of mouse and keyboard events so they don't trigger column drag/resize or global shortcuts. Search is view-local UI state and is not persisted in the file.

### Quick Sort

Each column header has a sort indicator next to the name: a faint ⇅ icon on hover when unsorted, or a colored ↑/↓ arrow when the column is sorted. Clicking cycles the column's sort rule: none → ascending → descending → removed. When multiple sort rules exist, a small number shows the rule's position in the sort order. Quick sort edits the active view's saved sorts, or the filter/sort bar's draft sorts when the bar is open.

### View Rename

Double-clicking a view tab in the view bar turns its name into an inline input (pre-selected). Enter or blur commits the rename, Escape cancels. Empty names are ignored.

### Row Numbers

The plugin setting **Show row numbers** (Settings → Rowbase) shows a row number on the left of every table row, on all databases. The number reflects the row's position in the current visible order (after filters, sorts, and search), starting at 1. Hovering a row (or selecting it) fades the number out and reveals the selection checkbox in its place; clicking the number cell toggles the row's selection, which also makes selection reachable on touch devices. Toggling the setting re-renders all open database views via a workspace settings-changed event.

### Random Row Pick

The toolbar has a dice button that picks one random row from the rows currently visible in the view (after filters, sorts, and column search). The picked row is selected (highlighted) and a Notice announces its title. The row's first filled `note` column is opened; if none, the row's `title` column (when "Link to note" is enabled) resolves and opens its note. If no note target exists, only the notice is shown.

### Progress Columns

The `progress` column type stores a number 0–100 per cell. In table cells it renders as a bar or a ring (circular progress) with a percent label; empty cells render as `—` with an empty track. Clicking the cell opens a slider + number editor (commits on slider release and number-input blur/Enter, avoiding one undo step per slider tick). Progress values resolve as numbers, so sorting, number filters, footer numeric aggregations, and stats treat them like number columns. The display style is set per column via `progressStyle` ("bar" default, "ring").

The bar/ring rendering is shared across all views: kanban cards, list rows, gallery cards, and the row detail modal all render the same bar-or-ring display; in the row detail modal clicking it opens the same slider editor. Chart views can select progress columns as the Y axis, Stats includes progress in numeric stats, and the Timeline prefers an actual `progress`-type column for the gantt fill (falling back to a column named progress/percent/completion) instead of any number column.

### Dropdown Placement

Cell dropdowns (select, multi-select, note, relation) are anchored to the cell's top edge. On mount the dropdown measures itself (re-measured via ResizeObserver when content changes); if it does not fit below the anchor in the viewport and there is more room above, it flips to open upward, anchored to the cell's top edge. The shared `useDropdownFlip` hook implements this and is reused by the footer's aggregate menu.

### Creating Databases

A database can be created from the ribbon icon, the command palette, or by right-clicking a folder in the file explorer ("New database" menu item), which creates the `.rbase` file inside that folder.

### Timeline View

The timeline is a Gantt chart driven by a movable, zoomable **time window** (a `[start, end]` range in ms), separate from the data's full extent.

- **Fields**: Start date, End date, Color by (a select column), Label column, and **Group by** are all configurable per view (`timelineStartColumn`, `timelineEndColumn`, `timelineStatusColumn`, `timelineLabelColumn`, `timelineGroupBy`). When unset, each falls back to a name/type heuristic (first/second date column, first select column, first column). Group by has Auto (status column), None (single flat list), or any column; the setting is chosen from the toolbar's "Group by" select and a settings (gear) popover.
- **Navigation**: Drag anywhere over the timeline — the date ruler, rows, bars, or empty space — to pan the window (a drag past a 3px threshold pans and suppresses the following row click). ◀ / ▶ buttons pan by half a window; **Today** centers the window on the current date; **Fit** resets to the full data extent. Plain mouse wheel pans the window (horizontal), Shift/vertical wheel included.
- **Zoom**: `+` / `−` buttons and Ctrl/Cmd+wheel zoom around the window center (Ctrl+wheel zooms around the cursor). The toolbar shows the visible range (e.g. `3mo`). Minimum span is one day; maximum is 12× the data extent.
- **Resize**: visible handles at the left and right edges of the time area (an overlay layer aligned to the measured label-column width, and inset from the body scrollbar) let you drag the window start or end to resize the visible range while keeping the opposite edge anchored. Each handle shows a hairline that turns accent-colored on hover.
- **Grouping**: groups render with collapsible headers, a color dot (from the group column's select options, or the color-by column), a name and a count. Bars are colored by the color-by column (past = faded, current = shadowed, future = green/accent), show day count and progress fill (from a `progress`-type column), and open a context menu (Open, set status, Delete). Bars outside the visible window are not rendered.
- **Editing dates by dragging bars**: dragging a bar's body moves both dates; dragging its left or right edge changes only the start or end date. Movement snaps to whole days and is previewed live (the bar follows the cursor and shows `start → end`). On release the changed date cells are written back to the table in a single `SET_CELLS` action (one undo step); a resize is clamped so the start never passes the end. Dragging a bar takes precedence over window panning, and a completed bar drag suppresses the follow-up row click.
- The window is clamped so it always overlaps the data range; a drag that pans suppresses the following row click.

### Calculation Footer Row

Table layout shows a sticky summary row (`<tfoot>`) under the data. Each cell opens a "Calculate" menu with type-appropriate aggregations:

- **Text-like types** (text, title, note, relation, url, link, select, multiselect): Count all, Count filled, Count empty, Count unique, Percent filled
- **Number, formula, rollup**: Count all/filled/empty/unique, Sum, Average, Median, Min, Max, Range
- **Date**: Count all/filled/empty/unique, Earliest, Latest
- **Checkbox**: Count all, Checked, Unchecked, Percent checked, Percent unchecked

Aggregations compute over the currently visible rows (after the view's filters, sorts, and any column search). The chosen aggregation is stored per column as `ColumnDef.aggregate` and persists in the file; choosing "None" clears it. Selecting an aggregation that is invalid for the column's type displays nothing until a valid one is chosen.

### Wrap Content

Each column has an optional `wrapContent` flag. When enabled, cell content wraps to multiple lines and rows auto-expand in height. When disabled (default), content is clipped at the cell boundary. A single-line wrap cell still matches the standard row height.

### Deleting Columns and Options

Deleting a column shows a confirmation modal explaining the column and all its data will be permanently removed.

Deleting a select/multiselect option shows a modal with two choices:
- **Delete from all rows**: removes the option definition and clears the value from all cells that reference it (select → empty, multiselect → removes the value from the pipe-separated list).
- **Remove option only**: removes the option definition but preserves existing cell data. Orphaned values display as gray tags and can still be removed by users in the cell editor.

Both actions take effect immediately (not deferred to the column modal's Save button).

### Multi-View System

#### Column Name Uniqueness

Column names must be unique since views reference columns by name. When adding a column, if the name already exists, a numeric suffix is appended (e.g. "New Column 2"). When renaming, the same uniqueness check applies.

#### Column Rename Propagation

When a column is renamed, all view references are updated: `SortRule.column`, `FilterRule.column`, and `ViewDef.hiddenColumns` entries matching the old name are updated to the new name. When a column is deleted, its references are removed from all views.

#### Active View

The active view always starts at the first view and is not persisted. The active view determines which sorts, filters, and hidden columns are applied. Switching views recomputes the visible columns and filtered/sorted rows.

#### Filter Logic

- **contains**: for text/number/date/note/title/relation, cell includes any value in the array (case-insensitive); for select, cell equals any value; for multiselect, cell values intersect with filter values
- **does-not-contain**: inverse of contains
- **is-empty**: cell is empty string
- **is-not-empty**: cell is non-empty

#### Sort Logic

Sorts are applied in order (stable sort). For `text`/`select`/`note`/`title`/`relation`: locale string compare. For `number`: numeric compare. For `date`: string compare (ISO format sorts correctly). For `checkbox`: "true" > "false". For `multiselect`: compare by joined string.

### Board (Kanban) Layout

Views support two layouts: **Table** (default) and **Board** (kanban). The layout is selected in the view's "..." menu.

- **Group by**: Board layout requires a `groupByColumn` set to a `select`-type column. Without it, an empty state prompt is shown.
- **Column order**: Board columns appear in the order defined by the select column's `options` array. A "No value" column appears at the end only when rows with empty group-by values exist. **Columns can be reordered by dragging their headers** — the change persists by reordering the `options` array (new `REORDER_SELECT_OPTION` action). The "No value" column is not draggable and always stays last. A ghost clone follows the cursor and the insertion position is highlighted with an accent edge on the target column.
- **Hidden board columns**: Each column header has a hide (eye-off) button on hover; hidden columns are stored per view as `ViewDef.hiddenGroups` (group values). Renaming or deleting a select option propagates to `hiddenGroups` of views grouped by that column. When columns are hidden, a slim bar above the board lists chips to restore each one (or "Show all").
- **Board column header**: The group value renders as a title — a colored dot (option color) followed by bold text — plus the row count and the hide button, not as a tag pill.
- **Cards**: Each card shows the first visible column's value as the title (plain text for text-like types, Tag for select/multiselect), and remaining visible columns as properties. Column visibility is controlled by `hiddenColumns`, shared with table layout.
- **Drag-and-drop**: Dragging a card between columns changes the row's group-by cell value via `SET_CELL`. A 5px threshold activates drag mode, a ghost clone follows the cursor, and the target column highlights.
- **New row**: Each column's "+ New" button adds a row with the group-by value pre-set via `ADD_ROW_WITH_VALUES`.
- **Row detail modal**: Clicking a card opens a modal showing all fields (including hidden columns) with inline editing. Each field is rendered as a horizontal row with a type icon and column name on the left, and an editable value on the right. Text/number/date/title fields use plain inputs, select/multiselect/relation fields open their respective dropdowns, checkbox fields toggle directly, and note fields open the note picker. A drag guard (`consumeJustDragged`) prevents the modal from opening after drag-and-drop.

### List Layout

The list layout fills the full view: the scroll container is a flex child of `.rbase-container` (a flex column at 100% height) and the row list stretches to 100% width and at least the full height of the scroll area. Rows show the first visible column as the title on the left, remaining visible columns as properties aligned to the right, and a delete (×) button at the far right.

- **Property rendering**: select/multiselect render as tags, relations as relation pills, progress as bar/ring, checkbox as a check mark, and note as a file icon + basename. Long values are truncated with an ellipsis.
- **Row selection**: each row has a selection checkbox (revealed on hover, or when selected). Selection is shared with the table layout, so the global selection bar (count / Delete / Clear) works in list view too. Selected rows are highlighted.
- **Row numbers**: when the "Show row numbers" plugin setting is on, list rows show their visible position (1…n, skipping collapsed groups), matching the table.
- **Grouping**: when `groupByColumn` is set, rows are grouped with collapsible headers showing a color dot (from the group column's select options), the group name, and a count. Without a group column, a flat list is shown.
- **Empty state**: a friendly "No rows yet" placeholder is shown when there are no rows.

### Gallery Layout

Cards are laid out in a responsive grid (min 260px wide on desktop, 220px on tablet, 160px on phone) with a 180px cover image (130px on phone).

- **Cover**: resolved from a column named cover/image/photo/… or a url/link column. Handles plain paths, `[[wikilinks]]`/`![[embeds]]`, vault files (via link resolution + `getResourcePath`), and http(s) URLs. When no image resolves, a soft gradient placeholder with an image icon is shown instead of an empty box.
- **Card body**: the first visible column is the title (truncated with a tooltip); remaining visible columns render as properties — select/multiselect as tags, relations as pills, progress as bar/ring, checkbox as a check mark, note as a file icon + basename.
- **Selection**: each card has a selection checkbox overlay (top-left, revealed on hover or when selected) wired into the shared selection state, so the global selection bar works in gallery too; selected cards get an accent ring.
- **Delete**: an icon button overlay (top-right, revealed on hover).
- **Empty state**: a friendly "No cards yet" placeholder.

### UI Components

The view bar and toolbar share a single horizontal row above the content: view tabs on the left, icon buttons on the right. The bar has a bottom hairline border and the tab strip scrolls horizontally (hidden scrollbar) when there are many views.

- **ViewBar**: View tabs on the left side of the bar. Non-table layouts show a small stroke icon before the name (board columns, list lines, gallery grid, chart bars, stats pie, timeline gantt bars, dashboard ring). Active tab is bold with an accent underline; hover shows a subtle pill background. Tabs are keyboard-accessible (role tablist/tab, Enter/Space switches). A "+" button at the end of the tab strip creates a new view. Double-clicking a tab renames it inline.
- **Toolbar**: Icon buttons on the right side, grouped with thin separators: Filter (funnel), Sort (arrows) | Fields (eye) | Random pick (dice) | "..." menu. The "..." menu contains: Layout selector (Table / Board / List / Gallery / Chart / Stats / Timeline / Dashboard), Group by selector (board/list layouts only, lists select-type columns), New view, Duplicate "view name" (exact copy with a unique name, including layout, sorts, filters, hidden columns and group-by), Rename (opens a modal), Delete "[view name]" (only shown when more than one view exists), then an **Import** section (CSV → New database, CSV → Append to current) and an **Export** section (Export as CSV, Export as JSON). Filter and Sort buttons highlight in accent color (with a soft accent-tinted background) when saved rules exist. Fields button highlights when columns are hidden. Clicking Sort or Filter toggles the FilterSortBar.
- **FilterSortBar**: A horizontal bar rendered between the view bar row and the table. Contains sort pill, individual filter pills, "+ Filter" button, and Reset/Save action buttons. Clicking the sort pill opens a SortEditor popover. Clicking a filter pill opens a FilterPillEditor popover to edit that rule. Save is a split button with a dropdown for "Save as new view". Filter pills display operator symbols (`⊇` contains, `⊉` does not contain, `= ∅` is empty, `≠ ∅` is not empty) and render select/multiselect values as colored tags.
- **SortEditor**: Popover with a list of sort rules (column dropdown + direction dropdown + remove). "+ Add sort" and "Delete sort" buttons.
- **FilterPillEditor**: Small popover for editing a single filter rule: column dropdown, operator dropdown, value input, and delete button. For select/multiselect columns, the value area shows selected tags with remove buttons; clicking it opens a dropdown listing unselected options.
- **ColumnVisibilityEditor**: Popover with a list of all columns and toggle switches to show/hide each column in the active view.

### FilterSortBar Draft State

Sort and filter changes are managed as draft state while the bar is open:

- **Bar visibility**: The bar is hidden by default. Clicking the Sort or Filter toolbar button opens it, initializing draft state from the active view's saved sorts/filters. Clicking the button again closes the bar only if there are no unsaved changes.
- **Draft state**: While the bar is visible, the table uses draft state for live preview. When hidden, it uses saved view state.
- **Dirty detection**: The bar compares draft state to the saved view to determine if changes exist.
- **Save**: Commits draft values to the active view and closes bar.
- **Reset**: Reverts to saved state and closes bar.
- **Save as new view**: Creates a new view from draft sorts/filters, switches to it, and closes bar.
- **View switching**: Draft state is preserved per-view. When switching tabs while the bar is open, the current view's draft is saved and the target view's draft is restored (or initialized from saved state). The draft map is cleared on Reset/Save/Save-as-New-View.
- **Column rename/delete propagation**: When columns are renamed or deleted while the bar is open, draft sorts/filters are updated to reflect the change.

## Color Palette

### Tag Color Palette (9 Colors)

| Color  | Background | Text      |
| ------ | ---------- | --------- |
| gray   | `#E3E2E080` | `#5A5A5A` |
| brown  | `#EEE0DA`   | `#6B4C3B` |
| orange | `#FADEC9`   | `#AD5700` |
| yellow | `#FDECC8`   | `#AD7700` |
| green  | `#DBEDDB`   | `#2B6B2B` |
| blue   | `#D3E5EF`   | `#24548F` |
| purple | `#E8DEEE`   | `#6940A5` |
| pink   | `#F5E0E9`   | `#AD1A72` |
| red    | `#FFE2DD`   | `#C4554D` |

Default (no color): same as `gray`.

Dark mode overrides:

| Color | Background                   | Text      |
| ----- | ---------------------------- | --------- |
| gray  | `rgba(227, 226, 224, 0.68)` | `#3f3f3f` |

## Implementation

`DatabasePlugin` (`main.ts`) registers the view type and file extension. `DatabaseView` (`database-view.ts`) extends Obsidian's `TextFileView`, bridging file I/O with a React component tree mounted via `createRoot`. `csv-parser.ts` handles CSV parsing/serialization using PapaParse.

The React UI is rooted in `DatabaseTable`, which uses `useReducer` to manage the `DatabaseModel` state. Obsidian pushes data in via `setViewData` → `parseCSV` → dispatch; user edits dispatch actions that flow back via `onModelChange` → `requestSave` → `serializeCSV`.

### Column Display Order

`DatabaseTable` computes a `displayColumns: DisplayColumn[]` (sorted by `columnIndex`) for rendering. All UI components receive `displayColumns` and use `dataIdx` (the column's index in the data array) for data operations, and the rendering loop index for DOM operations (resize, drag). Column data order in the CSV file never changes, so `rows[r][i]` always corresponds to `columns[i]`. Manual row ordering changes `model.rows` order, and `serializeCSV` writes rows in that current order.

### Column Drag-to-Reorder

Drag interaction is handled by `useColumnDrag` hook. A direction lock prevents jitter when columns have different widths. `flushSync` ensures no visual flash between clearing transforms and committing the React state update.

### Wrap Content

Wrap cells use adjusted padding (`4px` vertical vs the default `6px`) with `margin-top/bottom: 2px` on tags, so that a single-line wrap cell still matches the standard `32px` row height. Multi-line rows get `4px` vertical gap between tag lines. All cells use `vertical-align: top` so content aligns to the top when other cells in the same row cause it to expand.

### FilterSortBar Draft State

`draftSorts` and `draftFilters` are local `useState` in `DatabaseTable`. Dirty detection compares draft state to the saved view via JSON serialization. Draft state is preserved per-view via `draftStateMapRef` (a `Map<number, {sorts, filters}>`).

### Popover Positioning

All portal-based popovers (select/multiselect dropdown, option edit panel, color picker) check viewport boundaries before rendering. The option edit panel flips from right to left of its anchor when there is insufficient horizontal space, and shifts upward when there is insufficient vertical space. Outside-click detection for FilterPillEditor spans both the popover and portal dropdown using the `data-csv-db-filter-dropdown` attribute.
