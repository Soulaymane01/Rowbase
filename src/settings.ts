import { App, PluginSettingTab, Setting } from "obsidian";
import type DatabasePlugin from "./main";

export interface DatabasePluginSettings {
  defaultFolder: string;
  defaultTemplateName: string;
  defaultTemplateColumns: string;
  noteLinkingDefault: boolean;
  folderLinkingDefault: boolean;
}

export const DEFAULT_SETTINGS: DatabasePluginSettings = {
  defaultFolder: "",
  defaultTemplateName: "Untitled Database",
  defaultTemplateColumns: JSON.stringify([
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
  ]),
  noteLinkingDefault: true,
  folderLinkingDefault: false,
};

export class SettingsTab extends PluginSettingTab {
  plugin: DatabasePlugin;

  constructor(app: App, plugin: DatabasePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Rowbase Settings" });

    new Setting(containerEl)
      .setName("Default folder")
      .setDesc("Where new databases are created. Leave empty for vault root.")
      .addText((text) =>
        text
          .setPlaceholder("e.g. Databases")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default template name")
      .setDesc("Name used when creating a new database.")
      .addText((text) =>
        text
          .setPlaceholder("Untitled Database")
          .setValue(this.plugin.settings.defaultTemplateName)
          .onChange(async (value) => {
            this.plugin.settings.defaultTemplateName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default columns (JSON)")
      .setDesc("Columns for new databases. Edit the JSON directly.")
      .addTextArea((text) =>
        text
          .setPlaceholder('[{"name":"Name","type":"text"}]')
          .setValue(this.plugin.settings.defaultTemplateColumns)
          .onChange(async (value) => {
            this.plugin.settings.defaultTemplateColumns = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Enable note linking by default")
      .setDesc("New title columns will have 'Link to note' enabled.")
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
      .setDesc("New title columns will have 'Link to folder' enabled.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.folderLinkingDefault)
          .onChange(async (value) => {
            this.plugin.settings.folderLinkingDefault = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
