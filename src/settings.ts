import { App, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import type ObsidianViewerPlugin from "../main";

export class ObsidianViewerSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ObsidianViewerPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Obsidian Viewer" });
    containerEl.createEl("p", {
      text: "阅读工作台、搜索、收藏、历史和互动测验均保存在当前 vault 的插件数据中。",
      cls: "setting-item-description",
    });

    containerEl.createEl("h3", { text: "GitHub 跨平台同步" });
    containerEl.createEl("p", {
      text: "通过 GitHub REST API 双向同步，不调用系统 Git，因此可在 Android、iOS、Windows、macOS 和 Linux 使用。首次同步会保留两端独有文件；同一路径内容冲突时，远端作为主文件，本地版本保存为 conflict 副本。",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("GitHub token")
      .setDesc("建议使用只授权此仓库、Contents: Read and write 的 fine-grained token。token 由 Obsidian SecretStorage 保存，不写入插件 data.json。")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder(this.plugin.getGitHubToken() ? "已安全保存；输入新 token 可替换" : "github_pat_…");
        text.onChange((value) => {
          if (value.trim()) this.plugin.setGitHubToken(value);
        });
      })
      .addButton((button) => button.setButtonText("清除 token").setWarning().onClick(() => {
        this.plugin.setGitHubToken("");
        this.display();
      }));

    new Setting(containerEl)
      .setName("仓库")
      .setDesc("格式：owner/repository")
      .addText((text) => text
        .setPlaceholder("owner/repository")
        .setValue(this.plugin.settings.syncRepository)
        .onChange(async (value) => {
          this.plugin.settings.syncRepository = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("分支")
      .setDesc("留空时使用仓库默认分支。")
      .addText((text) => text
        .setPlaceholder("main")
        .setValue(this.plugin.settings.syncBranch)
        .onChange(async (value) => {
          this.plugin.settings.syncBranch = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("自动识别设备")
      .setDesc(`当前设备：${this.plugin.getCurrentDeviceName()}。开启后会在每个平台自动使用正确的系统名称。`)
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.syncDeviceNameAuto)
        .onChange(async (value) => {
          this.plugin.settings.syncDeviceNameAuto = value;
          if (value) this.plugin.settings.syncDeviceName = this.plugin.getCurrentDeviceName();
          await this.plugin.saveSettings();
          this.display();
        }));

    new Setting(containerEl)
      .setName("设备名称")
      .setDesc(this.plugin.settings.syncDeviceNameAuto
        ? "已由当前平台自动填写；关闭上方开关后可自定义。"
        : "用于 commit message 和冲突副本文件名。")
      .addText((text) => text
        .setDisabled(this.plugin.settings.syncDeviceNameAuto)
        .setValue(this.plugin.settings.syncDeviceName)
        .onChange(async (value) => {
          this.plugin.settings.syncDeviceName = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("测试与同步")
      .setDesc(this.syncDescription())
      .addButton((button) => button.setButtonText("测试连接").onClick(async () => {
        button.setDisabled(true).setButtonText("测试中…");
        try {
          new Notice(`GitHub 连接成功：${await this.plugin.testGitHubConnection()}`);
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "连接失败", 8000);
        } finally {
          button.setDisabled(false).setButtonText("测试连接");
        }
      }))
      .addButton((button) => button.setCta().setButtonText("立即双向同步").onClick(async () => {
        button.setDisabled(true).setButtonText("同步中…");
        await this.plugin.syncNow();
        button.setDisabled(false).setButtonText("立即双向同步");
        this.display();
      }));

    new Setting(containerEl)
      .setName("启动时同步")
      .setDesc("Obsidian 打开当前 vault 后自动同步一次。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.syncOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("保存后同步")
      .setDesc("文件变化停止 30 秒后自动同步；连续编辑只触发一次。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.syncOnSave)
        .onChange(async (value) => {
          this.plugin.settings.syncOnSave = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("定时同步")
      .setDesc("仅在 Obsidian 正在运行时生效，移动端被系统挂起时不会后台唤醒。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.syncPeriodically)
        .onChange(async (value) => {
          this.plugin.settings.syncPeriodically = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("同步间隔（分钟）")
      .setDesc("最短 5 分钟。")
      .addText((text) => text
        .setValue(String(this.plugin.settings.syncIntervalMinutes))
        .onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isFinite(parsed)) return;
          this.plugin.settings.syncIntervalMinutes = Math.max(5, parsed);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("单文件上限（MB）")
      .setDesc("默认 50 MB；超过上限会停止同步而不是静默遗漏。GitHub 普通 Git blob 不适合超大文件。")
      .addText((text) => text
        .setValue(String(this.plugin.settings.syncMaxFileSizeMb))
        .onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isFinite(parsed)) return;
          this.plugin.settings.syncMaxFileSizeMb = Math.min(99, Math.max(1, parsed));
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("忽略路径")
      .setDesc("每行一个 vault 相对路径或 glob。笔记、主题、CSS、插件本体、插件启用列表和插件设置会正常同步；工作区布局、回收站、Git 内部库和同步器运行状态按设备保留。")
      .addTextArea((text) => text
        .setPlaceholder(".DS_Store\n.obsidian/workspace*.json")
        .setValue(this.plugin.settings.syncIgnorePatterns)
        .onChange(async (value) => {
          this.plugin.settings.syncIgnorePatterns = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("p", {
      text: "注意：当前 vault 同时启用了 Obsidian Git。启用自动同步前，请关闭 Obsidian Git 的自动 pull/backup，避免两个同步器同时更新远端分支。",
      cls: "ov-setting-warning",
    });

    new Setting(containerEl)
      .setName("首页笔记")
      .setDesc("输入 vault 内的完整 Markdown 路径，也可通过命令把当前笔记设为首页。")
      .addText((text) => text
        .setPlaceholder("例如：DATA2002/DATA2002 首页.md")
        .setValue(this.plugin.settings.homeNote)
        .onChange(async (value) => {
          this.plugin.settings.homeNote = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("使用当前笔记")
      .setDesc("把当前打开的 Markdown 笔记设为首页。")
      .addButton((button) => button.setButtonText("设为首页").onClick(async () => {
        const file = this.app.workspace.getActiveFile();
        if (file instanceof TFile) await this.plugin.setHomeNote(file);
      }));

    new Setting(containerEl)
      .setName("启动时打开工作台")
      .setDesc("Obsidian 完成布局加载后在左侧打开 Viewer。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.openDashboardOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.openDashboardOnStartup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("阅读历史上限")
      .setDesc("保留最近 10–500 篇笔记。")
      .addText((text) => text
        .setValue(String(this.plugin.settings.maxHistory))
        .onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isFinite(parsed)) return;
          this.plugin.settings.maxHistory = Math.min(500, Math.max(10, parsed));
          this.plugin.settings.history = this.plugin.settings.history.slice(0, this.plugin.settings.maxHistory);
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: "阅读显示" });
    this.addSlider("正文字号", "14–24 px", 14, 24, 1, this.plugin.settings.fontSize, (value) => { this.plugin.settings.fontSize = value; });
    this.addSlider("正文行距", "1.2–2.2", 1.2, 2.2, 0.1, this.plugin.settings.lineHeight, (value) => { this.plugin.settings.lineHeight = value; });
    this.addSlider("内容最大宽度", "600–1200 px", 600, 1200, 50, this.plugin.settings.contentWidth, (value) => { this.plugin.settings.contentWidth = value; });
    this.addSlider("段落间距", "0.5–2.0 em", 0.5, 2, 0.1, this.plugin.settings.paragraphSpacing, (value) => { this.plugin.settings.paragraphSpacing = value; });

    containerEl.createEl("h3", { text: "数据管理" });
    new Setting(containerEl)
      .setName("清空阅读历史")
      .setDesc(`当前保存 ${this.plugin.settings.history.length} 条记录，不会删除任何笔记。`)
      .addButton((button) => button.setWarning().setButtonText("清空").onClick(async () => {
        await this.plugin.clearHistory();
        this.display();
      }));

    new Setting(containerEl)
      .setName("清空答题进度")
      .setDesc("清除所有 Quizzable 作答和评分记录，不会修改题目。")
      .addButton((button) => button.setWarning().setButtonText("清空").onClick(async () => {
        this.plugin.settings.quizProgress = {};
        await this.plugin.saveSettings();
        this.display();
      }));
  }

  private addSlider(name: string, description: string, min: number, max: number, step: number, value: number, assign: (value: number) => void): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addSlider((slider) => slider
        .setLimits(min, max, step)
        .setValue(value)
        .setDynamicTooltip()
        .onChange(async (next) => {
          assign(next);
          await this.plugin.saveSettings();
        }));
  }

  private syncDescription(): string {
    const date = this.plugin.settings.lastSyncAt
      ? new Date(this.plugin.settings.lastSyncAt).toLocaleString()
      : "从未";
    return `上次同步：${date}；${this.plugin.settings.lastSyncSummary}`;
  }
}
