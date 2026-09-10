import { App, PluginSettingTab, Setting } from "obsidian";
import type DatabasePlugin from "./main";
import { ColumnDef } from "./types";

export interface DatabasePluginSettings {
  defaultFolder: string;
  defaultTemplateName: string;
  defaultTemplateColumns: string;
  noteLinkingDefault: boolean;
  folderLinkingDefault: boolean;
  showRowNumbers: boolean;
}

export const DEFAULT_TEMPLATE_COLUMNS = JSON.stringify([
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
]);

export const DEFAULT_SETTINGS: DatabasePluginSettings = {
  defaultFolder: "",
  defaultTemplateName: "Untitled Database",
  defaultTemplateColumns: DEFAULT_TEMPLATE_COLUMNS,
  noteLinkingDefault: true,
  folderLinkingDefault: false,
  showRowNumbers: false,
};

interface TemplateValidation {
  ok: boolean;
  columns?: ColumnDef[];
  error?: string;
}

function validateTemplateColumns(json: string): TemplateValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, error: "Expected a non-empty array of columns." };
  }
  const columns: ColumnDef[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Each column must be an object." };
    }
    const record = item as Record<string, unknown>;
    if (typeof record.name !== "string" || record.name.trim() === "") {
      return { ok: false, error: 'Every column needs a non-empty "name".' };
    }
    if (typeof record.type !== "string") {
      return { ok: false, error: `Column "${record.name}" is missing a "type".` };
    }
    columns.push(item as ColumnDef);
  }
  return { ok: true, columns };
}

/**
 * Renders the template-columns editor (textarea + validation status + live preview
 * + Format / Reset buttons) into the given container.
 */
function renderTemplateEditor(container: HTMLElement, plugin: DatabasePlugin): void {
  const textarea = container.createEl("textarea", { cls: "rbase-settings-json" });
  textarea.value = plugin.settings.defaultTemplateColumns;
  textarea.spellcheck = false;

  const statusEl = container.createDiv({ cls: "rbase-settings-status" });
  const previewEl = container.createDiv({ cls: "rbase-settings-preview" });
  const buttons = container.createDiv({ cls: "rbase-settings-buttons" });
  const formatBtn = buttons.createEl("button", { text: "Format", cls: "rbase-settings-btn" });
  const resetBtn = buttons.createEl("button", { text: "Reset to default", cls: "rbase-settings-btn" });

  const update = (value: string, persist: boolean) => {
    const result = validateTemplateColumns(value);
    statusEl.empty();
    previewEl.empty();
    if (result.ok && result.columns) {
      statusEl.className = "rbase-settings-status is-valid";
      statusEl.setText(`✓ ${result.columns.length} column${result.columns.length === 1 ? "" : "s"}`);
      for (const col of result.columns) {
        const row = previewEl.createDiv({ cls: "rbase-settings-preview-row" });
        row.createSpan({ text: col.name, cls: "rbase-settings-preview-name" });
        row.createSpan({ text: col.type, cls: "rbase-settings-preview-type" });
      }
    } else {
      statusEl.className = "rbase-settings-status is-invalid";
      statusEl.setText(`✕ ${result.error ?? "Invalid JSON"}`);
    }
    if (persist) {
      plugin.settings.defaultTemplateColumns = value;
      void plugin.saveSettings();
    }
  };

  textarea.addEventListener("input", () => update(textarea.value, true));

  formatBtn.addEventListener("click", () => {
    const result = validateTemplateColumns(textarea.value);
    if (result.ok && result.columns) {
      textarea.value = JSON.stringify(result.columns, null, 2);
      update(textarea.value, true);
    } else {
      update(textarea.value, false);
    }
  });

  resetBtn.addEventListener("click", () => {
    textarea.value = DEFAULT_TEMPLATE_COLUMNS;
    update(textarea.value, true);
  });

  update(textarea.value, false);
}

export class SettingsTab extends PluginSettingTab {
  plugin: DatabasePlugin;

  constructor(app: App, plugin: DatabasePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Obsidian 1.13+ uses these searchable definitions. Older versions ignore
  // this method and continue to render the compatible display() fallback.
  getSettingDefinitions(): unknown[] {
    return [
      {
        name: "Default folder",
        desc: "Where new databases are created. Leave empty for the vault root.",
        control: { type: "text", key: "defaultFolder", placeholder: "Databases" },
      },
      {
        name: "Default template name",
        desc: "The name used when creating a new database.",
        control: { type: "text", key: "defaultTemplateName", placeholder: "Untitled database" },
      },
      {
        name: "Template columns",
        desc: "Columns added to every new database (JSON).",
        render: (setting: Setting) => {
          const wrap = setting.settingEl.createDiv({ cls: "rbase-settings-editor" });
          renderTemplateEditor(wrap, this.plugin);
        },
      },
      {
        name: "Enable note linking by default",
        desc: "New title columns will have 'link to note' enabled.",
        control: { type: "toggle", key: "noteLinkingDefault" },
      },
      {
        name: "Enable folder linking by default",
        desc: "New title columns will have 'link to folder' enabled.",
        control: { type: "toggle", key: "folderLinkingDefault" },
      },
      {
        name: "Show row numbers",
        desc: "Show a row number on the left of every row in table and list views.",
        control: { type: "toggle", key: "showRowNumbers" },
      },
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setHeading().setName("General");

    new Setting(containerEl)
      .setName("Default folder")
      .setDesc("Where new databases are created. Leave empty for the vault root.")
      .addText((text) =>
        text
          .setPlaceholder("Databases")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default template name")
      .setDesc("The name used when creating a new database.")
      .addText((text) =>
        text
          .setPlaceholder("Untitled database")
          .setValue(this.plugin.settings.defaultTemplateName)
          .onChange(async (value) => {
            this.plugin.settings.defaultTemplateName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("New database template");

    new Setting(containerEl)
      .setName("Template columns")
      .setDesc("Columns added to every new database. Edit as JSON; validated as you type.");

    const editorWrap = containerEl.createDiv({ cls: "rbase-settings-editor" });
    renderTemplateEditor(editorWrap, this.plugin);

    new Setting(containerEl).setHeading().setName("Linking defaults");

    new Setting(containerEl)
      .setName("Enable note linking by default")
      .setDesc("New title columns will have 'link to note' enabled.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.noteLinkingDefault)
          .onChange(async (value) => {
            this.plugin.settings.noteLinkingDefault = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable folder linking by default")
      .setDesc("New title columns will have 'link to folder' enabled.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.folderLinkingDefault)
          .onChange(async (value) => {
            this.plugin.settings.folderLinkingDefault = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl).setHeading().setName("Display");

    new Setting(containerEl)
      .setName("Show row numbers")
      .setDesc("Show a row number on the left of every row in table and list views.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showRowNumbers)
          .onChange(async (value) => {
            this.plugin.settings.showRowNumbers = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
