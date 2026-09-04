import { Plugin, WorkspaceLeaf, TFile, Notice } from "obsidian";
import { DatabaseView, VIEW_TYPE_DATABASE } from "./database-view";
import { serializeCSV } from "./csv-parser";
import { ColumnDef } from "./types";
import { DatabasePluginSettings, DEFAULT_SETTINGS, SettingsTab } from "./settings";

export default class DatabasePlugin extends Plugin {
  settings: DatabasePluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_DATABASE, (leaf: WorkspaceLeaf) => {
      return new DatabaseView(leaf);
    });

    this.registerExtensions(["rbase"], VIEW_TYPE_DATABASE);

    this.addRibbonIcon("table", "New database", () => {
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
        // eslint-disable-next-line obsidianmd/no-unsupported-api
        await this.app.vault.createFolder(folderPath);
      }
    }

    const templateName = this.settings.defaultTemplateName.trim() || "Untitled Database";
    let         fileName = `${templateName}.rbase`;
    let counter = 1;

    while (this.app.vault.getAbstractFileByPath(
      folderPath ? `${folderPath}/${fileName}` : fileName
    )) {
      counter++;
      fileName = `${templateName} ${counter}.rbase`;
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
