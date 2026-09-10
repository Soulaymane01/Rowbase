---
name: rowbase
description: >
  Create and edit Rowbase databases (.rbase files) in an Obsidian vault by
  direct file manipulation. Use when an AI is asked to create, read, modify,
  generate, convert, import, or batch-edit Rowbase/Notion-style databases:
  columns, rows, views, filters, sorts, formulas, rollups, relations,
  progress tracking, and layouts. Rowbase is an Obsidian plugin; its files
  are CSV with JSON column metadata in the header row.
---

# Rowbase (.rbase) file format — guide for AI agents

Rowbase databases are single `.rbase` files stored inside an Obsidian vault
(same rules as any note). Each file is a standard **CSV** file whose **first
row is a header of JSON column definitions**. The file stays human-readable
and can be created or edited by writing text directly — no plugin required.

## 1. File anatomy

Schematic (unescaped, for readability — real escaping is shown in §2):

```
"{"name":"Title","type":"title",...,"views":[...],"formatVersion":1}","{"name":"Status","type":"select",...}","{"name":"Date","type":"date"}"
"Task A",Todo,2024-01-15
"Task B","Done",2024-02-01
```

- **Row 1 (header)**: one JSON object per column.
- **Rows 2+ (data)**: one CSV cell per column, in the same order.
- The **first column's JSON** additionally carries database-level metadata:
  `formatVersion` (currently `1`) and `views` (array of `ViewDef`).
- Every row must have exactly as many cells as columns; pad missing cells
  with `""`. Missing trailing cells are padded with `""` on load; extra
  cells are trimmed (data loss) — don't rely on that.
- Files end with a newline. Newline style is `\n`.

## 2. CSV quoting rules (critical)

The header cells contain JSON with `"` characters, so per RFC 4180:

1. Wrap any cell containing `"`, `,`, or newline in double quotes.
2. Escape every inner `"` as `""`.

JSON of `{"name":"Status","type":"select"}` becomes the CSV cell:

```
"{""name"":""Status"",""type"":""select""}"
```

Plain values (`42`, `Todo`, `2024-01-15`) need no quoting unless they
contain `,` `"` or newline. When generating files programmatically, prefer
a CSV library (PapaParse, Python `csv` with default excel dialect) over
hand-rolled escaping. Python example:

```python
import csv, json
columns = [{"name": "Name", "type": "title"}, {"name": "Status", "type": "select", "options": [{"value": "Todo", "color": "red"}]}]
rows = [["Buy milk", "Todo"]]
meta = {"formatVersion": 1, "views": [{"name": "Default", "sorts": [], "filters": [], "hiddenColumns": []}]}
with open("Tasks.rbase", "w", newline="") as f:
    w = csv.writer(f)
    first = {**columns[0], **meta}
    w.writerow([json.dumps(first)] + [json.dumps(c) for c in columns[1:]])
    w.writerows(rows)
```

## 3. Column definitions (`ColumnDef`)

```typescript
interface ColumnDef {
  name: string;            // MUST be unique across all columns
  type: "text" | "number" | "date" | "checkbox" | "select" | "multiselect"
      | "note" | "title" | "relation" | "url" | "link" | "formula"
      | "rollup" | "progress";
  options?: { value: string; color?: TagColor }[];   // select/multiselect
  titleNoteEnabled?: boolean;   // title: link to note (default true)
  titleNoteFolder?: string;     // title: folder for auto-created notes
  titleFolderEnabled?: boolean; // title: link to folder
  titleFolderPath?: string;
  relationTargetPath?: string;  // relation: path to target .rbase file
  relationMultiple?: boolean;   // relation: allow multiple targets
  width?: number;               // pixels, default 180
  columnIndex?: number;         // display order; falls back to CSV position
  wrapContent?: boolean;        // wrap cell content to multiple lines
  progressStyle?: "bar" | "ring"; // progress columns only, default "bar"
  aggregate?: string;           // footer calculation (see §8)
  formula?: string;             // formula columns only (see §7)
  rollup?: {                    // rollup columns only (see §7)
    relationColumn: string;     // name of a relation column in THIS file
    targetColumn: string;       // column name in the target database
    handler: "count" | "sum" | "avg" | "min" | "max" | "list";
    targetFilter?: { column: string; equals: string };
  };
}
```

`TagColor` is one of: `gray, brown, orange, yellow, green, blue, purple,
pink, red`. Unknown/missing colors render as `gray`.

Rules:

- **One `title` column max per file.** Its `name` is unique; if another
  column becomes title, the previous one downgrades (handled by the UI,
  but never write two title columns).
- `columnIndex` is the *display* order, independent of CSV data order.
  Always set it explicitly (0, 1, 2, …) — the plugin falls back to CSV
  position when absent, and mixed/missing values cause confusing ordering.
- A `relation` column's `relationTargetPath` points at another `.rbase`
  file in the vault. Relative paths resolve from **this file's folder**;
  leading `/` means vault root. The target must contain a `title` column.
  Self-relations (target = this file) are allowed.
- Changing a column's type is allowed; keep stored values compatible with
  the new type (see §5), and drop now-irrelevant fields (`options`,
  `formula`, `rollup`, …) from the JSON.

## 4. Views (`ViewDef`)

Stored in the **first column's JSON** under `views`. If absent, the plugin
uses one default view. There is no "active view" in the file — the plugin
always opens the first view.

```typescript
interface ViewDef {
  name: string;
  layout?: "table" | "kanban" | "list" | "gallery" | "chart" | "stats"
         | "timeline" | "dashboard";      // absent = "table"
  sorts: SortRule[];
  filters: FilterRule[];
  hiddenColumns: string[];               // column names to hide
  groupByColumn?: string;                // select-type column, kanban/list
  chartType?: "bar" | "line" | "pie" | "area";
  chartXColumn?: string;
  chartYColumn?: string;
  chartAgg?: "count" | "sum" | "avg";
  chartColorByColumn?: string;
}

interface SortRule  { column: string; direction: "asc" | "desc" }
interface FilterRule { column: string; operator: FilterOperator; value: string[] }
type FilterOperator =
  | "equals" | "is-not"
  | "contains" | "does-not-contain" | "starts-with"
  | "is-empty" | "is-not-empty"
  | "greater-than" | "less-than" | "between"   // value: [min, max]
  | "before" | "after";
```

Rules:

- Views reference columns **by name**. When you rename a column, update
  every `sorts[].column`, `filters[].column`, `hiddenColumns[]`,
  `groupByColumn`, and any chart column references across all views.
  When you delete a column, remove its references everywhere.
- `filters` combine with AND. `value` is always an array of strings.
- `kanban` and `list` layouts need `groupByColumn` pointing at a
  `select`-type column.

## 5. Value storage per type

| Type        | Cell format                                   | Example              |
| ----------- | --------------------------------------------- | -------------------- |
| text        | Plain text                                    | `Hello world`        |
| number      | Numeric string                                | `42.5`               |
| date        | ISO 8601 (`YYYY-MM-DD`)                       | `2024-01-15`         |
| checkbox    | `true` / `false`                              | `true`               |
| select      | Option value string                           | `Todo`               |
| multiselect | Escaped, pipe-joined values (below)           | `Tag1\|Tag2`         |
| note        | Vault-relative markdown path                  | `folder/My Note.md`  |
| title       | Unique row title                              | `Project Alpha`      |
| relation    | Target row title, or pipe-joined titles       | `Project Alpha`      |
| url / link  | Plain string (URL)                            | `https://…`          |
| progress    | Number 0–100                                  | `45`                 |
| formula     | Leave cells **empty** — computed at runtime   | (empty)              |
| rollup      | Leave cells **empty** — computed at runtime   | (empty)              |

### Pipe escaping (multiselect + multi-relation)

Values are joined with `|` and escaped with backslash:

- `\|` → literal `|`
- `\\` → literal `\`

Encode: `value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|")` then join
with `|`. In a CSV cell a literal `\` is fine as-is (CSV does not escape
backslashes) — the escaping is only for the pipe format.

### Title uniqueness

Title values must be unique within the file. When adding/renaming rows,
append a numeric suffix (`Project Alpha 2`) if the value already exists.

### Notes and title-linked notes

- `note` cells hold a vault-relative path; `.md` may be included or not.
- `title` columns with `titleNoteEnabled` resolve a note named after the
  title. `titleNoteFolder` follows the same path rules as
  `relationTargetPath` (relative to this file's folder; `/` = vault root).

## 6. Relations

- A relation cell stores the **title value** of the referenced row.
- Multi-relation (`relationMultiple: true`) stores pipe-joined titles with
  the escaping from §5.
- The plugin does **not** rewrite relation cells in other databases when a
  target row's title is renamed — relation cells would keep the old title
  and go stale. When renaming a title that other files relate to, update
  those files' relation cells too.

## 7. Formulas and rollups

`formula` columns evaluate per row with a safe parser (no eval).
Supported syntax:

- Column references by name: `Price * Qty`
- Arithmetic `+ - * /`, parentheses, unary minus
- String concat with `&`: `First & " " & Last`
- Comparisons `> >= < <= = !=`; division by zero errors to `#ERROR: …`
- `IF(cond, then, else)`
- Aggregates over **relation columns**: `SUM(col)`, `AVG(col)`,
  `COUNT(col)`, `MIN(col)`, `MAX(col)` where `col` is either a plain
  column name of this row, or `relation.column` referring to a related
  database's numeric column (e.g. `SUM(Tasks.Hours)`).
- Quoted strings with `"`; numbers with optional decimals.

Keep formula cells in the CSV **empty** — values are recomputed on load.

`rollup` columns aggregate related rows (see `rollup` field in §3).
Example: count related tasks —
`"rollup":{"relationColumn":"Tasks","targetColumn":"Name","handler":"count"}`
with a filter —
`"targetFilter":{"column":"Status","equals":"Done"}`.
Rollup cells in the CSV stay **empty**.

## 8. Footer aggregations

Optional per-column `aggregate` field. Valid values by column type:

- **text-like** (text, title, note, relation, url, link, select,
  multiselect): `count-all`, `count-filled`, `count-empty`,
  `count-unique`, `percent-filled`
- **number / formula / rollup / progress**: all count values plus `sum`,
  `avg`, `median`, `min`, `max`, `range`
- **date**: counts plus `earliest`, `latest`
- **checkbox**: `count-all`, `checked`, `unchecked`,
  `percent-checked`, `percent-unchecked`

Use `"aggregate"` only on types where it is valid; omit it for "none".

## 9. Complete example file

A tasks database with a select status and two views. The header row is
three JSON cells; unescaped they are:

```json
{"name":"Name","type":"title","titleNoteEnabled":true,"columnIndex":0,"width":220,
 "formatVersion":1,
 "views":[
   {"name":"All Tasks","sorts":[{"column":"Due Date","direction":"asc"}],"filters":[],"hiddenColumns":[]},
   {"name":"In Progress","sorts":[],"filters":[{"column":"Status","operator":"contains","value":["In Progress"]}],"hiddenColumns":["Due Date"]}
 ]}
{"name":"Status","type":"select","columnIndex":1,"options":[{"value":"Todo","color":"red"},{"value":"In Progress","color":"yellow"},{"value":"Done","color":"green"}]}
{"name":"Due Date","type":"date","columnIndex":2,"width":120}
```

As it appears in the file (RFC 4180 escaping, first three data rows):

```
"{""name"":""Name"",""type"":""title"",""titleNoteEnabled"":true,""columnIndex"":0,""width"":220,""formatVersion"":1,""views"":[{""name"":""All Tasks"",""sorts"":[{""column"":""Due Date"",""direction"":""asc""}],""filters"":[],""hiddenColumns"":[]},{""name"":""In Progress"",""sorts"":[],""filters"":[{""column"":""Status"",""operator"":""contains"",""value"":[""In Progress""]}],""hiddenColumns"":[""Due Date""]}]}","{""name"":""Status"",""type"":""select"",""columnIndex"":1,""options"":[{""value"":""Todo"",""color"":""red""},{""value"":""In Progress"",""color"":""yellow""},{""value"":""Done"",""color"":""green""}]}","{""name"":""Due Date"",""type"":""date"",""columnIndex"":2,""width"":120}"
"Write spec",Todo,2024-01-15
"Review spec",In Progress,2024-01-20
"Ship v1",Done,2024-02-01
```

A minimal two-column file is just:

```
"{""name"":""Name"",""type"":""title"",""formatVersion"":1,""views"":[{""name"":""Default"",""sorts"":[],""filters"":[],""hiddenColumns"":[]}],""formatVersion"":1}","{""name"":""Amount"",""type"":""number""}"
"Rent",1200
"Groceries",250.5
```

## 10. Editing checklist

When creating or modifying a `.rbase` file:

1. Keep column `name`s unique; keep one `title` column max.
2. Keep `columnIndex` sequential and explicit.
3. Pad/trim every data row to the exact column count.
4. Rename → update all view references (sorts, filters, hiddenColumns,
   groupByColumn, chart fields) *and* relation cells in other files.
5. Delete column → drop it from every data row and remove view
   references; renumber `columnIndex` of later columns.
6. Insert column → append the JSON to the header and add a cell to every
   row at the same position (or put it at the end and use `columnIndex`).
7. multiselect/relation values → apply the pipe escaping.
8. select values → ideally match an entry in `options`; unknown values
   still render as gray tags but don't invent options silently.
9. checkbox → literal `true`/`false` strings.
10. Formula/rollup cells stay empty.
11. Preserve `formatVersion: 1` and the `views` array in the first
    header cell; keep unknown JSON fields untouched (forward compat).

## 11. Not stored in the file

- The active view (always opens the first view) and filter/sort draft state
- Per-column search terms, row selection, undo history
- Plugin settings (live in Obsidian's plugin data, not in `.rbase` files)
- Computed formula/rollup values
