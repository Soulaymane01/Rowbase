# CSV Database Plugin

## .csvdb File Format

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
  type: "text" | "number" | "date" | "checkbox" | "select" | "multiselect" | "note" | "title" | "relation";
  options?: Array<{ value: string; color?: string }>;
  titleNoteEnabled?: boolean;
  titleNoteFolder?: string;
  relationTargetPath?: string;
  relationMultiple?: boolean;
  width?: number;         // column width in pixels, default 180
  columnIndex?: number;   // display order, defaults to positional index
  wrapContent?: boolean;  // wrap cell content to multiple lines, default false
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

Title columns have a `Link to note` setting, enabled by default. When enabled, title cells show an `OPEN` / `CREATE` action and resolve notes from the title value. `titleNoteFolder` controls where those notes live and is preserved even when `Link to note` is disabled: folder paths starting with `/` are relative to the vault root, while other folder paths are relative to the current `.csvdb` file's folder. When `Link to note` is disabled, the title is only a unique row label and no note path is resolved.

Relation columns store the target row's title value. Multi-relation columns use the same pipe-separated escaping format as multiselect columns. The relation picker lists rows from the target database's title column. `relationTargetPath` uses the same path rules as `titleNoteFolder`: paths starting with `/` are relative to the vault root, while other paths are relative to the current `.csvdb` file's folder.

Self-relations are allowed. When a relation targets the current database, candidates are read from the in-memory model rather than re-reading the current file from disk.

Renaming a title value does not update relation cells in other databases. This is a known limitation of using the title as the stored relation identity: existing relations keep the old title string until edited manually.

### Multiselect Escaping

Multiselect values are separated by `|`. To support literal `|` and `\` characters in option values, a backslash escape mechanism is used:

- `\|` → literal `|`
- `\\` → literal `\`
- Unescaped `|` is the value separator

When encoding, each value has `\` escaped to `\\` and `|` escaped to `\|`, then values are joined with `|`. When decoding, the string is scanned character by character; `\` followed by any character produces that literal character; unescaped `|` splits values.

See the `examples/` directory for sample `.csvdb` files.

## Features

### Column Display Order

Each column has a `columnIndex` field that determines its display position. The data order in the CSV file is independent of display order. Dragging columns only swaps `columnIndex` values.

### Column Drag-to-Reorder

Mousedown on a header cell + 5px drag threshold enters drag mode. Columns swap in real-time as the cursor crosses the current column's boundary, with a 150ms slide animation.

### Manual Row Ordering

Rows can be manually reordered in table layout when no sort rules are active. Hovering a row reveals a drag handle just outside the left edge. Dragging highlights only insert positions that would change row order, and committing the drag reorders `model.rows`.

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
- **Column order**: Board columns appear in the order defined by the select column's `options` array. A "No value" column appears at the end only when rows with empty group-by values exist.
- **Cards**: Each card shows the first visible column's value as the title (plain text for text-like types, Tag for select/multiselect), and remaining visible columns as properties. Column visibility is controlled by `hiddenColumns`, shared with table layout.
- **Drag-and-drop**: Dragging a card between columns changes the row's group-by cell value via `SET_CELL`. A 5px threshold activates drag mode, a ghost clone follows the cursor, and the target column highlights.
- **New row**: Each column's "+ New" button adds a row with the group-by value pre-set via `ADD_ROW_WITH_VALUES`.
- **Row detail modal**: Clicking a card opens a modal showing all fields (including hidden columns) with inline editing. Each field is rendered as a horizontal row with a type icon and column name on the left, and an editable value on the right. Text/number/date/title fields use plain inputs, select/multiselect/relation fields open their respective dropdowns, checkbox fields toggle directly, and note fields open the note picker. A drag guard (`consumeJustDragged`) prevents the modal from opening after drag-and-drop.

### UI Components

The view bar and toolbar share a single horizontal row: view tabs on the left, icon buttons on the right. This row is outside the horizontal scroll area, so it always stays visible even when the table is wider than the viewport.

- **ViewBar**: View tabs on the left side of the bar. Active tab is bold with an underline indicator. Clicking a tab switches the view.
- **Toolbar**: Icon buttons on the right side of the bar — Filter (funnel), Sort (arrows), Fields (eye), and a "..." menu button. The "..." menu contains: Layout selector (Table / Board), Group by selector (board layout only, lists select-type columns), New view, Rename (opens a modal), and Delete "[view name]" (only shown when more than one view exists). Filter and Sort buttons highlight in accent color when saved rules exist. Fields button highlights when columns are hidden. Clicking Sort or Filter toggles the FilterSortBar.
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
