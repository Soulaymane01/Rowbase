import { Plugin, WorkspaceLeaf, TFile, Notice, addIcon } from "obsidian";
import { DatabaseView, VIEW_TYPE_CSV_DATABASE } from "./database-view";
import { serializeCSV } from "./csv-parser";
import { ColumnDef } from "./types";
import { DatabasePluginSettings, DEFAULT_SETTINGS, SettingsTab } from "./settings";

const ROWBASE_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4zm0 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2zm0 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2z"/></svg>`;

export default class DatabasePlugin extends Plugin {
  settings: DatabasePluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    addIcon("rowbase", ROWBASE_ICON);

    this.registerView(VIEW_TYPE_CSV_DATABASE, (leaf: WorkspaceLeaf) => {
      return new DatabaseView(leaf);
    });

    this.registerExtensions(["csvdb"], VIEW_TYPE_CSV_DATABASE);

    this.addRibbonIcon("rowbase", "New database", () => {
      this.createNewDatabase();
    });

    this.addCommand({
      id: "create-new-database",
      name: "Create new database",
      callback: () => this.createNewDatabase(),
    });

    this.addSettingTab(new SettingsTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async createNewDatabase() {
    let defaultColumns: ColumnDef[];
    try {
      defaultColumns = JSON.parse(this.settings.defaultTemplateColumns);
      if (!Array.isArray(defaultColumns)) throw new Error();
    } catch {
      defaultColumns = [
        { name: "Name", type: "text" },
        {
          name: "Status",
          type: "select",
          options: [
            { value: "Todo", color: "red" },
            { value: "In Progress", color: "yellow" },
            { value: "Done", color: "green" },
          ],
        },
        { name: "Date", type: "date" },
      ];
    }

    const content = serializeCSV({
      columns: defaultColumns,
      rows: [],
      views: [{ name: "Default", sorts: [], filters: [], hiddenColumns: [] }],
      formatVersion: 1,
    });

    const folderPath = this.settings.defaultFolder.trim().replace(/^\/+|\/+$/g, "");

    if (folderPath) {
      const existing = this.app.vault.getAbstractFileByPath(folderPath);
      if (!existing) {
        await this.app.vault.createFolder(folderPath);
      }
    }

    const templateName = this.settings.defaultTemplateName.trim() || "Untitled Database";
    let fileName = `${templateName}.csvdb`;
    let counter = 1;

    while (this.app.vault.getAbstractFileByPath(
      folderPath ? `${folderPath}/${fileName}` : fileName
    )) {
      counter++;
      fileName = `${templateName} ${counter}.csvdb`;
    }

    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
    const file = await this.app.vault.create(filePath, content);

    const leaf = this.app.workspace.getLeaf(false);
    if (file instanceof TFile) {
      await leaf.openFile(file);
    }

    new Notice(`Created database: ${fileName}`);
  }

  onunload() {}
}
