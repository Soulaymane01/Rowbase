# Rowbase

<p align="center">
  <a href="https://obsidian.md/plugins?id=rowbase"><img src="https://img.shields.io/badge/Obsidian-Install%20from%20Community%20Plugins-7c3aed?logo=obsidian&logoColor=white" alt="Install from Obsidian"></a>
  <a href="https://github.com/TfTHacker/obsidian42-brat"><img src="https://img.shields.io/badge/beta%20install-BRAT-8a2be2" alt="Install with BRAT"></a>
  <a href="https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugin-stats.json"><img src="https://img.shields.io/badge/dynamic/json?color=7c3aed&label=downloads&query=%24.rowbase.downloads&suffix=%20installs&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json" alt="Obsidian downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
</p>

Rowbase is an [Obsidian](https://obsidian.md) plugin that brings Notion-style databases to your vault. Each database is a single `.rbase` file — a human-readable CSV with JSON column metadata — that opens in a rich, interactive view with multiple layouts, formulas, relations, and more.

## Demo

<p align="center">
  <img src="assets/demo/rowbase-demo.gif" alt="Rowbase demo (table to kanban)" width="720">
</p>

<p align="center">
  <img src="assets/lockup-primary.png" alt="Rowbase icon"  />
</p>


## Features

### Views

- **Table** — Full-featured spreadsheet with inline editing, sorting, filtering, column resizing, and row reordering
- **Kanban** — Drag-and-drop board grouped by a select column
- **List** — Compact grouped rows with collapsible sections
- **Gallery** — Card grid with cover images and clickable detail modals
- **Chart** — Bar, Line, Pie, and Area charts with aggregation and color-by options
- **Stats** — Summary cards, numeric stats, select color distribution, and date distribution
- **Timeline** — Gantt-style timeline with status colors, grid lines, today marker, zoom, and tooltips
- **Dashboard** — Habit tracking with streaks, completion rings, and activity calendar heatmap

### Column Types

- Text, Number, Date, Checkbox, Select, Multi-select, Title, Note, Relation, Rollup, Formula

### Data & Computation

- **Formulas** — Safe expression evaluator with cell references and cross-relation aggregation (SUM, AVG, COUNT, MIN, MAX)
- **Rollups** — Aggregate related rows (sum, count, avg, min, max) across relation columns
- **Relations** — Link rows across databases; preloaded resolver with cache for fast cross-file lookups
- **Sorting** — Multi-column sort with ascending/descending toggle
- **Filtering** — Text (contains, starts with, is empty), Number (>, <, between), Date (before, after, between), Select (is, is not), Checkbox filters
- **Grouping** — Group rows by any column with collapsible sections

### UI/UX

- **Inline editing** — Click any cell to edit; text, number, date, and select types all editable in place
- **Undo/Redo** — Cmd+Z / Cmd+Shift+Z with 100-step history stack
- **Column management** — Add, rename, resize (double-click to auto-fit), reorder, delete columns via context menu
- **Title linking** — Open or create notes from title cells; configure note folder per column
- **Folder linking** — Create folders directly from title cells; configure default folder per column
- **Multi-select keyboard nav** — Arrow keys, Enter to select, Escape to close
- **Empty states** — Friendly placeholder with icons when databases or views are empty
- **Mobile responsive** — Optimized for tablets and phones with touch-friendly targets
- **Import/Export** — Import CSV files into databases; export to CSV or JSON
- **Plugin settings** — Default folder, template name, a validated template-columns editor, note/folder linking defaults, and show-row-numbers

## Screenshots

### Table View

<p align="center">
  <img src="screenshots/Table-projects.png" alt="Table view with projects" width="800" />
</p>

### Kanban Board

<p align="center">
  <img src="screenshots/board-projects.png" alt="Kanban board view" width="800" />
</p>

### Chart View

<p align="center">
  <img src="screenshots/sales-chart.png" alt="Sales chart with data visualization" width="800" />
</p>

### Timeline View

<p align="center">
  <img src="screenshots/timeline-project.png" alt="Timeline Gantt chart" width="800" />
</p>

### Stats View

<p align="center">
  <img src="screenshots/Stats-projects.png" alt="Statistics dashboard" width="800" />
</p>

### Dashboard View

<p align="center">
  <img src="screenshots/Dashboard-habits.png" alt="Habit tracking dashboard" width="800" />
</p>

### Inline Editing

<p align="center">
  <img src="screenshots/inline-editing.png" alt="Inline cell editing" width="600" />
</p>

## Installation

### From the Community plugins store (recommended)

1. Open **Settings → Community plugins** in Obsidian.
2. If needed, turn off **Restricted mode**, then search for **Rowbase** — or open [obsidian.md/plugins?id=rowbase](https://obsidian.md/plugins?id=rowbase) and press **Install**.
3. Enable the plugin in the same screen.

Want the latest beta before it hits the store? Install it via [BRAT](https://github.com/TfTHacker/obsidian42-brat) with the repo `Soulaymane01/Rowbase`.

Rowbase is 100% offline — no account, no telemetry; your data stays in your vault.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Soulaymane01/rowbase/releases)
2. Create a folder `rowbase` in your vault's `.obsidian/plugins/` directory
3. Copy the three files into that folder
4. Enable **Rowbase** in **Settings** → **Community Plugins**

## Usage

1. Use the command palette (`Ctrl/Cmd + P`) and run **Create new database** to create a `.rbase` file
2. Add columns using the **+** button in the header row
3. Add rows using the **+ New** button at the bottom
4. Switch views using the view selector in the toolbar
5. Sort, filter, and group rows using the toolbar controls

The `.rbase` file is a standard CSV file with column metadata encoded in the header row. It remains human-readable and can be opened with any text editor or spreadsheet application.

The complete file-format reference for AI agents lives in [SKILL.md](SKILL.md) — it documents everything needed to create and edit `.rbase` files through direct file manipulation.

## Development

```bash
npm ci
npm run dev    # watch mode
npm run build  # production build
```

To test locally, create a symlink from your vault's plugin directory to the project root:

```bash
ln -s /path/to/rowbase /path/to/vault/.obsidian/plugins/rowbase
```

## Offline baseline

Rowbase's runtime is fully offline. It makes no HTTP requests, WebSocket connections, telemetry, CDN asset fetches, or remote service calls; everything reads from and writes to the local Obsidian vault. Its runtime source and the production bundle are audited against that policy by:

```bash
npm run build            # produces main.js
npm run test:offline     # scans src/ and main.js for network/dynamic-code behavior
```

## Credits

Rowbase is an engineering fork of [jysperm/obsidian-csv-database](https://github.com/jysperm/obsidian-csv-database). The upstream project is licensed under the MIT License; that license and attribution are preserved in [LICENSE](LICENSE). Rowbase is itself released under the [MIT License](LICENSE).
