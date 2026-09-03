# Obsidian CSV Database

An [Obsidian](https://obsidian.md) plugin that provides an interactive database view backed by CSV files, supporting multiple column types, inline editing, and more.

<p align="center">
  <img src="screenshots/overall.png" alt="Database view with multiple column types" /><br />
  <span>Database view with multiple column types</span>
</p>

<p align="center">
  <img src="screenshots/views-and-filters.png" width="560" alt="Multiple views with sort and filter" /><br />
  <span>Multiple views with sort and filter</span>
</p>

<p align="center">
  <img src="screenshots/inline-editing.png" width="380" alt="Inline editing with multi-select dropdown" /><br />
  <span>Inline editing with multi-select dropdown</span>
</p>

<p align="center">
  <img src="screenshots/layout-kanban.png" width="680" alt="Board layout with drag-and-drop" /><br />
  <span>Board layout with drag-and-drop</span>
</p>

## Features

- **Rich column types**: text, number, date, checkbox, select, multi-select, note, title, and relation
- **Inline editing**: click any cell to edit its value directly
- **Manual row ordering**: drag rows to adjust their order
- **Column management**: rename, change type, configure options, resize, reorder, and delete columns
- **Wrap content**: per-column toggle to wrap cell content to multiple lines
- **Select & multi-select**: color-coded tags with a dropdown picker
- **Title & relation**: give each row a unique title and reference rows from other databases
- **Multiple views**: create named views, each with its own sort, filter, and column visibility settings
- **Board layout**: kanban-style board view grouped by a select column, with drag-and-drop between columns
- **Sort & filter**: sort by multiple columns, filter with contains / does not contain / is empty / is not empty operators
- **Auto-save**: all changes are saved back to the CSV file immediately

## Installation

<details>
<summary>This plugin has not yet been approved in the Obsidian community plugin directory (<a href="https://github.com/obsidianmd/obsidian-releases/pull/10269">review in progress</a>).</summary>

1. Open **Settings** → **Community Plugins** → **Browse**
2. Search for **CSV Database**
3. Click **Install**, then **Enable**

</details>

You need to install it via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install the **BRAT** plugin from **Settings** → **Community Plugins** → **Browse**
2. Open BRAT settings, click **Add Beta Plugin**
3. Enter `jysperm/obsidian-csv-database` and click **Add Plugin**
4. Enable **CSV Database** in **Settings** → **Community Plugins**

## Usage

1. Use the command palette (`Ctrl/Cmd + P`) and run **Create new database** to create a `.csvdb` file
2. Add columns using the **+** button in the header row
3. Add rows using the **+ New** button at the bottom

The `.csvdb` file is a standard CSV file with column metadata encoded in the header row. It remains human-readable and can be opened with any text editor or spreadsheet application.

## Development

```bash
npm ci
npm run dev    # watch mode
npm run build  # production build
```

To test locally, create a symlink from your vault's plugin directory to the project root:

```bash
ln -s /path/to/obsidian-csv-database /path/to/vault/.obsidian/plugins/csv-database
```

## License

The majority of this code was written by Claude Code (Opus), but all code has been thoroughly reviewed and tested by a human. I don't really care about licensing, but Obsidian's "Submission requirements for plugins" requires me to pick one, so: [MIT](LICENSE).
