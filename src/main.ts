import { Plugin, WorkspaceLeaf, TFile, TFolder, Notice } from "obsidian";
import { DatabaseView, VIEW_TYPE_DATABASE } from "./database-view";
import { serializeCSV } from "./csv-parser";
import { ColumnDef } from "./types";
import { DatabasePluginSettings, DEFAULT_SETTINGS, SettingsTab } from "./settings";

export const SETTINGS_CHANGED_EVENT = "rowbase:settings-changed";

function isColumnDef(value: unknown): value is ColumnDef {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.name === "string" && typeof candidate.type === "string";
}

export default class DatabasePlugin extends Plugin {
  settings: DatabasePluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_DATABASE, (leaf: WorkspaceLeaf) => {
      return new DatabaseView(leaf, this);
    });

    this.registerExtensions(["rbase"], VIEW_TYPE_DATABASE);

    this.addCommand({
      id: "create-new-database",
      name: "Create new database",
      callback: () => this.createNewDatabase(),
    });

    // Right-click a folder in the file explorer to create a database in it
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem((item) => {
          item
            .setTitle("New database")
            .setIcon("table")
            .onClick(() => {
              void this.createNewDatabase(file.path);
            });
        });
      })
    );

    this.addSettingTab(new SettingsTab(this.app, this));
  }

  async loadSettings() {
    const savedSettings: unknown = await this.loadData();
    if (savedSettings && typeof savedSettings === "object" && !Array.isArray(savedSettings)) {
      this.settings = { ...DEFAULT_SETTINGS, ...savedSettings as Partial<DatabasePluginSettings> };
      return;
    }
    this.settings = { ...DEFAULT_SETTINGS };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Let open database views re-render with the new settings
    this.app.workspace.trigger(SETTINGS_CHANGED_EVENT);
  }

  async createNewDatabase(targetFolder?: string) {
    let defaultColumns: ColumnDef[];
    try {
      const parsed: unknown = JSON.parse(this.settings.defaultTemplateColumns);
      if (!Array.isArray(parsed) || !parsed.every(isColumnDef)) throw new Error();
      defaultColumns = parsed;
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

    const folderPath = targetFolder
      ?? this.settings.defaultFolder.trim().replace(/^\/+|\/+$/g, "");

    if (folderPath) {
      const existing = this.app.vault.getAbstractFileByPath(folderPath);
      if (!existing) {
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
