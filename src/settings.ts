import { App, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import type GitSyncPortPlugin from "../main";
import type { LanguageSetting, TranslationKey } from "./i18n";

export class GitSyncPortSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: GitSyncPortPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const t = (key: TranslationKey, values?: Record<string, string | number>): string => this.plugin.t(key, values);
    containerEl.empty();
    containerEl.createEl("h2", { text: t("appName") });

    new Setting(containerEl)
      .setName(t("language"))
      .setDesc(t("languageDescription"))
      .addDropdown((dropdown) => {
        Object.entries(this.plugin.getLanguageOptions()).forEach(([value, label]) => dropdown.addOption(value, label));
        dropdown.setValue(this.plugin.settings.language).onChange(async (value) => {
          this.plugin.settings.language = value as LanguageSetting;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    containerEl.createEl("p", { text: t("settingsIntro"), cls: "setting-item-description" });
    containerEl.createEl("h3", { text: t("syncSection") });
    containerEl.createEl("p", { text: t("syncDescription"), cls: "setting-item-description" });

    new Setting(containerEl)
      .setName(t("githubToken"))
      .setDesc(t("githubTokenDescription"))
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder(this.plugin.getGitHubToken() ? t("tokenSavedPlaceholder") : "github_pat_…");
        text.onChange((value) => { if (value.trim()) this.plugin.setGitHubToken(value); });
      })
      .addButton((button) => button.setButtonText(t("clearToken")).setWarning().onClick(() => {
        this.plugin.setGitHubToken("");
        this.display();
      }));

    new Setting(containerEl)
      .setName(t("repository"))
      .setDesc(t("repositoryDescription"))
      .addText((text) => text.setPlaceholder("owner/repository").setValue(this.plugin.settings.syncRepository).onChange(async (value) => {
        this.plugin.settings.syncRepository = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName(t("branch"))
      .setDesc(t("branchDescription"))
      .addText((text) => text.setPlaceholder("main").setValue(this.plugin.settings.syncBranch).onChange(async (value) => {
        this.plugin.settings.syncBranch = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName(t("autoDevice"))
      .setDesc(t("autoDeviceDescription", { device: this.plugin.getCurrentDeviceName() }))
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.syncDeviceNameAuto).onChange(async (value) => {
        this.plugin.settings.syncDeviceNameAuto = value;
        if (value) this.plugin.settings.syncDeviceName = this.plugin.getCurrentDeviceName();
        await this.plugin.saveSettings();
        this.display();
      }));

    new Setting(containerEl)
      .setName(t("deviceName"))
      .setDesc(t(this.plugin.settings.syncDeviceNameAuto ? "deviceNameAutoDescription" : "deviceNameManualDescription"))
      .addText((text) => text.setDisabled(this.plugin.settings.syncDeviceNameAuto).setValue(this.plugin.settings.syncDeviceName).onChange(async (value) => {
        this.plugin.settings.syncDeviceName = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName(t("testAndSync"))
      .setDesc(this.syncDescription())
      .addButton((button) => button.setButtonText(t("testConnection")).onClick(async () => {
        button.setDisabled(true).setButtonText(t("testing"));
        try {
          new Notice(t("connectionSuccess", { details: await this.plugin.testGitHubConnection() }));
        } catch (error) {
          new Notice(error instanceof Error ? error.message : t("connectionFailed"), 8000);
        } finally {
          button.setDisabled(false).setButtonText(t("testConnection"));
        }
      }))
      .addButton((button) => button.setCta().setButtonText(t("syncNowLong")).onClick(async () => {
        button.setDisabled(true).setButtonText(t("syncing"));
        await this.plugin.syncNow();
        button.setDisabled(false).setButtonText(t("syncNowLong"));
        this.display();
      }));

    this.addToggle("syncOnStartup", "syncOnStartupDescription", this.plugin.settings.syncOnStartup, (value) => { this.plugin.settings.syncOnStartup = value; });
    this.addToggle("syncOnSave", "syncOnSaveDescription", this.plugin.settings.syncOnSave, (value) => { this.plugin.settings.syncOnSave = value; });
    this.addToggle("periodicSync", "periodicSyncDescription", this.plugin.settings.syncPeriodically, (value) => { this.plugin.settings.syncPeriodically = value; });
    this.addNumber("syncInterval", "syncIntervalDescription", this.plugin.settings.syncIntervalMinutes, 5, 10080, (value) => { this.plugin.settings.syncIntervalMinutes = value; });
    this.addNumber("maxFileSize", "maxFileSizeDescription", this.plugin.settings.syncMaxFileSizeMb, 1, 99, (value) => { this.plugin.settings.syncMaxFileSizeMb = value; });

    new Setting(containerEl)
      .setName(t("ignoredPaths"))
      .setDesc(t("ignoredPathsDescription"))
      .addTextArea((text) => text.setPlaceholder(".DS_Store\n.obsidian/workspace*.json").setValue(this.plugin.settings.syncIgnorePatterns).onChange(async (value) => {
        this.plugin.settings.syncIgnorePatterns = value;
        await this.plugin.saveSettings();
      }));

    containerEl.createEl("p", { text: t("obsidianGitWarning"), cls: "ov-setting-warning" });

    new Setting(containerEl)
      .setName(t("homeNote"))
      .setDesc(t("homeNoteDescription"))
      .addText((text) => text.setPlaceholder(t("homeNotePlaceholder")).setValue(this.plugin.settings.homeNote).onChange(async (value) => {
        this.plugin.settings.homeNote = value.trim();
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName(t("useCurrentNote"))
      .setDesc(t("useCurrentNoteDescription"))
      .addButton((button) => button.setButtonText(t("setAsHome")).onClick(async () => {
        const file = this.app.workspace.getActiveFile();
        if (file instanceof TFile) await this.plugin.setHomeNote(file);
      }));

    this.addToggle("openDashboardOnStartup", "openDashboardOnStartupDescription", this.plugin.settings.openDashboardOnStartup, (value) => { this.plugin.settings.openDashboardOnStartup = value; });
    this.addNumber("historyLimit", "historyLimitDescription", this.plugin.settings.maxHistory, 10, 500, (value) => {
      this.plugin.settings.maxHistory = value;
      this.plugin.settings.history = this.plugin.settings.history.slice(0, value);
    });

    containerEl.createEl("h3", { text: t("readingDisplay") });
    this.addSlider("bodyFontSize", "14–24 px", 14, 24, 1, this.plugin.settings.fontSize, (value) => { this.plugin.settings.fontSize = value; });
    this.addSlider("bodyLineHeight", "1.2–2.2", 1.2, 2.2, 0.1, this.plugin.settings.lineHeight, (value) => { this.plugin.settings.lineHeight = value; });
    this.addSlider("contentMaxWidth", "600–1200 px", 600, 1200, 50, this.plugin.settings.contentWidth, (value) => { this.plugin.settings.contentWidth = value; });
    this.addSlider("paragraphSpacing", "0.5–2.0 em", 0.5, 2, 0.1, this.plugin.settings.paragraphSpacing, (value) => { this.plugin.settings.paragraphSpacing = value; });

    containerEl.createEl("h3", { text: t("dataManagement") });
    new Setting(containerEl)
      .setName(t("clearHistory"))
      .setDesc(t("clearHistoryDescription", { count: this.plugin.settings.history.length }))
      .addButton((button) => button.setWarning().setButtonText(t("clear")).onClick(async () => { await this.plugin.clearHistory(); this.display(); }));
    new Setting(containerEl)
      .setName(t("clearQuizProgress"))
      .setDesc(t("clearQuizProgressDescription"))
      .addButton((button) => button.setWarning().setButtonText(t("clear")).onClick(async () => {
        this.plugin.settings.quizProgress = {};
        await this.plugin.saveSettings();
        this.display();
      }));
  }

  private addToggle(name: TranslationKey, description: TranslationKey, value: boolean, assign: (value: boolean) => void): void {
    new Setting(this.containerEl).setName(this.plugin.t(name)).setDesc(this.plugin.t(description)).addToggle((toggle) => toggle.setValue(value).onChange(async (next) => {
      assign(next);
      await this.plugin.saveSettings();
    }));
  }

  private addNumber(name: TranslationKey, description: TranslationKey, value: number, min: number, max: number, assign: (value: number) => void): void {
    new Setting(this.containerEl).setName(this.plugin.t(name)).setDesc(this.plugin.t(description)).addText((text) => text.setValue(String(value)).onChange(async (raw) => {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      assign(Math.min(max, Math.max(min, parsed)));
      await this.plugin.saveSettings();
    }));
  }

  private addSlider(name: TranslationKey, description: string, min: number, max: number, step: number, value: number, assign: (value: number) => void): void {
    new Setting(this.containerEl).setName(this.plugin.t(name)).setDesc(description).addSlider((slider) => slider.setLimits(min, max, step).setValue(value).setDynamicTooltip().onChange(async (next) => {
      assign(next);
      await this.plugin.saveSettings();
    }));
  }

  private syncDescription(): string {
    return this.plugin.t("lastSync", {
      date: this.plugin.settings.lastSyncAt ? this.plugin.formatDateTime(this.plugin.settings.lastSyncAt) : this.plugin.t("never"),
      summary: this.plugin.settings.lastSyncSummary || this.plugin.t("notSynced"),
    });
  }
}
