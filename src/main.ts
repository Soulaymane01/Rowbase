import { Plugin, WorkspaceLeaf, TFile, Notice } from "obsidian";
import { DatabaseView, VIEW_TYPE_CSV_DATABASE } from "./database-view";
import { serializeCSV } from "./csv-parser";
import { ColumnDef } from "./types";

export default class DatabasePlugin extends Plugin {
  onload() {
    this.registerView(VIEW_TYPE_CSV_DATABASE, (leaf: WorkspaceLeaf) => {
      return new DatabaseView(leaf);
    });

    this.registerExtensions(["csvdb"], VIEW_TYPE_CSV_DATABASE);

    this.addCommand({
      id: "create-new-database",
      name: "Create new database",
      callback: () => this.createNewDatabase(),
    });
  }

  async createNewDatabase() {
    const defaultColumns: ColumnDef[] = [
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

    const content = serializeCSV({ columns: defaultColumns, rows: [], views: [{ name: "Default", sorts: [], filters: [], hiddenColumns: [] }], formatVersion: 1 });

    const activeFile = this.app.workspace.getActiveFile();
    const folder = activeFile ? activeFile.parent : this.app.vault.getRoot();

    let fileName = "Untitled Database.csvdb";
    let counter = 1;
    const folderPath = folder ? folder.path : "";

    while (this.app.vault.getAbstractFileByPath(
      folderPath ? `${folderPath}/${fileName}` : fileName
    )) {
      counter++;
      fileName = `Untitled Database ${counter}.csvdb`;
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
