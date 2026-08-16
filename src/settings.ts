import { App, Notice, PluginSettingTab, TFile } from "obsidian";
import type { Setting, SettingDefinition, SettingDefinitionItem } from "obsidian";
import type GitSyncPortalPlugin from "../main";
import type { LanguageSetting, TranslationKey } from "./i18n";

export class GitSyncPortalSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: GitSyncPortalPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const t = (key: TranslationKey, values?: Record<string, string | number>): string => this.plugin.t(key, values);
    return [
      {
        type: "group",
        heading: t("appName"),
        items: [
          {
            name: t("language"),
            desc: t("languageDescription"),
            render: (setting) => {
              setting.addDropdown((dropdown) => {
                this.plugin.getLanguageOptions().forEach(([value, label]) => {
                  dropdown.addOption(value, label);
                });
                dropdown.setValue(this.plugin.settings.language).onChange(async (value) => {
                  this.plugin.settings.language = value as LanguageSetting;
                  await this.plugin.saveSettings();
                  this.update();
                });
              });
            },
          },
          { name: t("settingsIntro") },
        ],
      },
      {
        type: "group",
        heading: t("syncSection"),
        items: [
          { name: t("syncDescription") },
          {
            name: t("githubToken"),
            desc: t("githubTokenDescription"),
            render: (setting) => {
              setting
                .addText((text) => {
                  text.inputEl.type = "password";
                  text.setPlaceholder(this.plugin.getGitHubToken() ? t("tokenSavedPlaceholder") : "github_pat_…");
                  text.onChange((value) => { if (value.trim()) this.plugin.setGitHubToken(value); });
                })
                .addButton((button) => button.setButtonText(t("clearToken")).setDestructive().onClick(() => {
                  this.plugin.setGitHubToken("");
                  this.update();
                }));
            },
          },
          {
            name: t("repository"),
            desc: t("repositoryDescription"),
            render: (setting) => {
              setting.addText((text) => text.setPlaceholder("Owner/repository").setValue(this.plugin.settings.syncRepository).onChange(async (value) => {
                this.plugin.settings.syncRepository = value.trim();
                await this.plugin.saveSettings();
              }));
            },
          },
          {
            name: t("branch"),
            desc: t("branchDescription"),
            render: (setting) => {
              setting.addText((text) => text.setPlaceholder("Main").setValue(this.plugin.settings.syncBranch).onChange(async (value) => {
                this.plugin.settings.syncBranch = value.trim();
                await this.plugin.saveSettings();
              }));
            },
          },
          {
            name: t("autoDevice"),
            desc: t("autoDeviceDescription", { device: this.plugin.getCurrentDeviceName() }),
            render: (setting) => {
              setting.addToggle((toggle) => toggle.setValue(this.plugin.settings.syncDeviceNameAuto).onChange(async (value) => {
                this.plugin.settings.syncDeviceNameAuto = value;
                if (value) this.plugin.settings.syncDeviceName = this.plugin.getCurrentDeviceName();
                await this.plugin.saveSettings();
                this.update();
              }));
            },
          },
          {
            name: t("deviceName"),
            desc: t(this.plugin.settings.syncDeviceNameAuto ? "deviceNameAutoDescription" : "deviceNameManualDescription"),
            render: (setting) => {
              setting.addText((text) => text.setDisabled(this.plugin.settings.syncDeviceNameAuto).setValue(this.plugin.settings.syncDeviceName).onChange(async (value) => {
                this.plugin.settings.syncDeviceName = value.trim();
                await this.plugin.saveSettings();
              }));
            },
          },
          {
            name: t("testAndSync"),
            desc: this.syncDescription(),
            render: (setting) => {
              setting
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
                  this.update();
                }));
            },
          },
          this.toggleDefinition("syncOnStartup", "syncOnStartupDescription", this.plugin.settings.syncOnStartup, (value) => { this.plugin.settings.syncOnStartup = value; }),
          this.toggleDefinition("syncOnSave", "syncOnSaveDescription", this.plugin.settings.syncOnSave, (value) => { this.plugin.settings.syncOnSave = value; }),
          this.toggleDefinition("periodicSync", "periodicSyncDescription", this.plugin.settings.syncPeriodically, (value) => { this.plugin.settings.syncPeriodically = value; }),
          this.numberDefinition("syncInterval", "syncIntervalDescription", this.plugin.settings.syncIntervalMinutes, 5, 10080, (value) => { this.plugin.settings.syncIntervalMinutes = value; }),
          this.numberDefinition("maxFileSize", "maxFileSizeDescription", this.plugin.settings.syncMaxFileSizeMb, 1, 99, (value) => { this.plugin.settings.syncMaxFileSizeMb = value; }),
          this.toggleDefinition("useGitignore", "useGitignoreDescription", this.plugin.settings.syncUseGitignore, (value) => { this.plugin.settings.syncUseGitignore = value; }),
          {
            name: t("ignoredPaths"),
            desc: t("ignoredPathsDescription"),
            render: (setting) => {
              setting.addTextArea((text) => text.setPlaceholder(`.DS_Store\n${this.app.vault.configDir}/workspace*.json`).setValue(this.plugin.settings.syncIgnorePatterns).onChange(async (value) => {
                this.plugin.settings.syncIgnorePatterns = value;
                await this.plugin.saveSettings();
              }));
            },
          },
          {
            name: t("obsidianGitWarning"),
            render: (setting) => { setting.setClass("ov-setting-warning"); },
          },
        ],
      },
      {
        type: "group",
        heading: t("homeNote"),
        items: [
          {
            name: t("homeNote"),
            desc: t("homeNoteDescription"),
            render: (setting) => {
              setting.addText((text) => text.setPlaceholder(t("homeNotePlaceholder")).setValue(this.plugin.settings.homeNote).onChange(async (value) => {
                this.plugin.settings.homeNote = value.trim();
                await this.plugin.saveSettings();
              }));
            },
          },
          {
            name: t("useCurrentNote"),
            desc: t("useCurrentNoteDescription"),
            render: (setting) => {
              setting.addButton((button) => button.setButtonText(t("setAsHome")).onClick(async () => {
                const file = this.app.workspace.getActiveFile();
                if (file instanceof TFile) await this.plugin.setHomeNote(file);
              }));
            },
          },
          this.toggleDefinition("openDashboardOnStartup", "openDashboardOnStartupDescription", this.plugin.settings.openDashboardOnStartup, (value) => { this.plugin.settings.openDashboardOnStartup = value; }),
          this.numberDefinition("historyLimit", "historyLimitDescription", this.plugin.settings.maxHistory, 10, 500, (value) => {
            this.plugin.settings.maxHistory = value;
            this.plugin.settings.history = this.plugin.settings.history.slice(0, value);
          }),
        ],
      },
      {
        type: "group",
        heading: t("readingDisplay"),
        items: [
          this.sliderDefinition("bodyFontSize", "14–24 px", 14, 24, 1, this.plugin.settings.fontSize, (value) => { this.plugin.settings.fontSize = value; }),
          this.sliderDefinition("bodyLineHeight", "1.2–2.2", 1.2, 2.2, 0.1, this.plugin.settings.lineHeight, (value) => { this.plugin.settings.lineHeight = value; }),
          this.sliderDefinition("contentMaxWidth", "600–1200 px", 600, 1200, 50, this.plugin.settings.contentWidth, (value) => { this.plugin.settings.contentWidth = value; }),
          this.sliderDefinition("paragraphSpacing", "0.5–2.0 em", 0.5, 2, 0.1, this.plugin.settings.paragraphSpacing, (value) => { this.plugin.settings.paragraphSpacing = value; }),
        ],
      },
      {
        type: "group",
        heading: t("dataManagement"),
        items: [
          {
            name: t("clearHistory"),
            desc: t("clearHistoryDescription", { count: this.plugin.settings.history.length }),
            render: (setting) => {
              setting.addButton((button) => button.setDestructive().setButtonText(t("clear")).onClick(async () => {
                await this.plugin.clearHistory();
                this.update();
              }));
            },
          },
          {
            name: t("clearQuizProgress"),
            desc: t("clearQuizProgressDescription"),
            render: (setting) => {
              setting.addButton((button) => button.setDestructive().setButtonText(t("clear")).onClick(async () => {
                this.plugin.settings.quizProgress = {};
                await this.plugin.saveSettings();
                this.update();
              }));
            },
          },
        ],
      },
    ];
  }

  private toggleDefinition(name: TranslationKey, description: TranslationKey, value: boolean, assign: (value: boolean) => void): SettingDefinition {
    return this.renderDefinition(name, this.plugin.t(description), (setting) => {
      setting.addToggle((toggle) => toggle.setValue(value).onChange(async (next) => {
        assign(next);
        await this.plugin.saveSettings();
      }));
    });
  }

  private numberDefinition(name: TranslationKey, description: TranslationKey, value: number, min: number, max: number, assign: (value: number) => void): SettingDefinition {
    return this.renderDefinition(name, this.plugin.t(description), (setting) => {
      setting.addText((text) => text.setValue(String(value)).onChange(async (raw) => {
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return;
        assign(Math.min(max, Math.max(min, parsed)));
        await this.plugin.saveSettings();
      }));
    });
  }

  private sliderDefinition(name: TranslationKey, description: string, min: number, max: number, step: number, value: number, assign: (value: number) => void): SettingDefinition {
    return this.renderDefinition(name, description, (setting) => {
      setting.addSlider((slider) => slider.setLimits(min, max, step).setValue(value).onChange(async (next) => {
        assign(next);
        await this.plugin.saveSettings();
      }));
    });
  }

  private renderDefinition(name: TranslationKey, desc: string, render: (setting: Setting) => void): SettingDefinition {
    return { name: this.plugin.t(name), desc, render };
  }

  private syncDescription(): string {
    return this.plugin.t("lastSync", {
      date: this.plugin.settings.lastSyncAt ? this.plugin.formatDateTime(this.plugin.settings.lastSyncAt) : this.plugin.t("never"),
      summary: this.plugin.settings.lastSyncSummary || this.plugin.t("notSynced"),
    });
  }
}
