import { TextFileView, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { createElement } from "react";
import { parseCSV, serializeCSV } from "./csv-parser";
import { DatabaseModel } from "./types";
import { DatabaseTable } from "./components/DatabaseTable";

export const VIEW_TYPE_CSV_DATABASE = "csv-database-view";

export class DatabaseView extends TextFileView {
  private reactRoot: Root | null = null;
  private model: DatabaseModel = { columns: [], rows: [], views: [{ name: "Default", sorts: [], filters: [], hiddenColumns: [] }], formatVersion: 1 };
  private pushModel: ((model: DatabaseModel) => void) | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CSV_DATABASE;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "CSV Database";
  }

  getViewData(): string {
    return serializeCSV(this.model);
  }

  setViewData(data: string, _clear: boolean): void {
    this.model = parseCSV(data);

    if (this.pushModel) {
      // React tree already mounted — push new model in
      this.pushModel(this.model);
    } else {
      this.mountReact();
    }
  }

  clear(): void {
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.pushModel = null;
    this.model = { columns: [], rows: [], views: [{ name: "Default", sorts: [], filters: [], hiddenColumns: [] }], formatVersion: 1 };
  }

  private mountReact(): void {
    this.contentEl.empty();
    this.contentEl.addClass("csv-database-container");

    this.reactRoot = createRoot(this.contentEl);
    this.reactRoot.render(
      createElement(DatabaseTable, {
        initialModel: this.model,
        onModelChange: (newModel: DatabaseModel) => {
          this.model = newModel;
          this.requestSave();
        },
        setModelSetter: (setter: (model: DatabaseModel) => void) => {
          this.pushModel = setter;
        },
        app: this.app,
        databasePath: this.file?.path || "",
      })
    );
  }
}
