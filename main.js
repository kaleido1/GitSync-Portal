var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ObsidianViewerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/viewer-view.ts
var import_obsidian = require("obsidian");
var VIEW_TYPE_VIEWER = "obsidian-viewer-dashboard";
var ViewerDashboardView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.activeTab = "home";
    this.searchQuery = "";
    this.searchSequence = 0;
    this.searchTimer = null;
    this.currentFolderPath = "";
    this.folderBackStack = [];
    this.folderForwardStack = [];
  }
  getViewType() {
    return VIEW_TYPE_VIEWER;
  }
  getDisplayText() {
    return "Obsidian Viewer";
  }
  getIcon() {
    return "library";
  }
  async onOpen() {
    this.contentEl.addClass("ov-dashboard");
    await this.render();
  }
  async onClose() {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
  }
  async render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("ov-dashboard");
    const header = root.createDiv({ cls: "ov-dashboard-header" });
    const titleBox = header.createDiv();
    titleBox.createEl("h2", { text: "Obsidian Viewer" });
    titleBox.createEl("small", { text: `${this.app.vault.getMarkdownFiles().length} \u7BC7\u7B14\u8BB0` });
    const refresh = header.createEl("button", { cls: "clickable-icon ov-icon-button", attr: { "aria-label": "\u5237\u65B0" } });
    (0, import_obsidian.setIcon)(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.render());
    this.renderTabs(root);
    this.renderActiveNote(root);
    if (this.activeTab === "home") await this.renderHome(root);
    if (this.activeTab === "files") await this.renderFiles(root);
    if (this.activeTab === "favorites") this.renderTrackedItems(root, "\u6536\u85CF", this.plugin.settings.favorites, "\u8FD8\u6CA1\u6709\u6536\u85CF\u3002", true);
    if (this.activeTab === "history") this.renderHistory(root);
  }
  renderTabs(root) {
    const tabs = root.createDiv({ cls: "ov-tabs" });
    const choices = [
      ["home", "\u9996\u9875", "home"],
      ["files", "\u6587\u4EF6", "files"],
      ["favorites", "\u6536\u85CF", "star"],
      ["history", "\u5386\u53F2", "history"]
    ];
    choices.forEach(([tab, label, icon]) => {
      const button = tabs.createEl("button", {
        cls: `ov-tab${this.activeTab === tab ? " is-active" : ""}`,
        attr: { "aria-pressed": String(this.activeTab === tab) }
      });
      (0, import_obsidian.setIcon)(button.createSpan({ cls: "ov-tab-icon" }), icon);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        this.activeTab = tab;
        this.searchQuery = "";
        void this.render();
      });
    });
  }
  renderActiveNote(root) {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") return;
    const card = root.createDiv({ cls: "ov-active-card" });
    card.createEl("small", { text: "\u5F53\u524D\u7B14\u8BB0" });
    card.createEl("strong", { text: file.basename });
    card.createEl("span", { text: file.path, cls: "ov-muted ov-path" });
    const actions = card.createDiv({ cls: "ov-inline-actions" });
    this.iconButton(actions, this.plugin.isFavorite(file.path) ? "star-off" : "star", this.plugin.isFavorite(file.path) ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF", () => void this.plugin.toggleFavorite(file));
    this.iconButton(actions, "house-plus", "\u8BBE\u4E3A\u9996\u9875", () => void this.plugin.setHomeNote(file));
  }
  async renderHome(root) {
    var _a;
    const home = this.plugin.getMarkdownFile(this.plugin.settings.homeNote);
    const hero = root.createDiv({ cls: "ov-home-card" });
    hero.createEl("div", { text: "\u9996\u9875\u7B14\u8BB0", cls: "ov-eyebrow" });
    hero.createEl("h3", { text: (_a = home == null ? void 0 : home.basename) != null ? _a : "\u5C1A\u672A\u8BBE\u7F6E" });
    hero.createEl("p", {
      text: home ? home.path : "\u6253\u5F00\u4E00\u7BC7\u7B14\u8BB0\u540E\uFF0C\u4F7F\u7528\u5F53\u524D\u7B14\u8BB0\u5361\u7247\u4E0A\u7684\u9996\u9875\u6309\u94AE\u3002",
      cls: "ov-muted"
    });
    const heroActions = hero.createDiv({ cls: "ov-inline-actions" });
    const openHome = heroActions.createEl("button", { text: "\u6253\u5F00\u9996\u9875", cls: "mod-cta" });
    openHome.disabled = !home;
    openHome.addEventListener("click", () => void this.plugin.openHomeNote());
    this.renderSyncCard(root);
    const favorites = this.plugin.settings.favorites.map((path) => this.plugin.getFileOrFolder(path)).filter((item) => item !== null).slice(0, 5);
    this.renderSection(root, "\u6536\u85CF", favorites, "\u8FD8\u6CA1\u6709\u6536\u85CF\u7B14\u8BB0\u3002", true);
    const recent = this.plugin.settings.history.map((path) => this.plugin.getMarkdownFile(path)).filter((file) => file !== null).slice(0, 8);
    this.renderSection(root, "\u6700\u8FD1\u9605\u8BFB", recent, "\u6253\u5F00\u8FC7\u7684\u7B14\u8BB0\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002", false);
    this.renderOutline(root);
  }
  renderSyncCard(root) {
    const status = this.plugin.syncStatus;
    const card = root.createDiv({ cls: `ov-sync-card is-${status.stage}` });
    const header = card.createDiv({ cls: "ov-sync-card-header" });
    const title = header.createDiv();
    title.createEl("strong", { text: "GitHub \u8DE8\u5E73\u53F0\u540C\u6B65" });
    title.createEl("small", { text: `${this.plugin.settings.syncRepository} \xB7 ${this.plugin.settings.syncBranch || "\u9ED8\u8BA4\u5206\u652F"}` });
    const sync = header.createEl("button", { text: this.plugin.githubSync.isRunning ? "\u540C\u6B65\u4E2D\u2026" : "\u7ACB\u5373\u540C\u6B65", cls: "mod-cta" });
    sync.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    sync.addEventListener("click", () => void this.plugin.syncNow());
    card.createDiv({
      text: this.plugin.getGitHubToken() ? status.message : "\u5C1A\u672A\u4FDD\u5B58 GitHub token\uFF0C\u8BF7\u5148\u524D\u5F80\u63D2\u4EF6\u8BBE\u7F6E\u3002",
      cls: "ov-sync-message"
    });
    if (status.total && status.current !== void 0) {
      const progress = card.createEl("progress", { attr: { max: String(status.total), value: String(status.current) } });
      progress.value = status.current;
      progress.max = status.total;
    }
    if (this.plugin.settings.lastSyncAt) {
      card.createEl("small", {
        text: `${new Date(this.plugin.settings.lastSyncAt).toLocaleString()} \xB7 ${this.plugin.settings.lastSyncSummary}`,
        cls: "ov-muted"
      });
    }
  }
  async renderFiles(root) {
    const searchBox = root.createDiv({ cls: "ov-search-box", attr: { tabindex: "0", role: "search" } });
    (0, import_obsidian.setIcon)(searchBox.createSpan(), "search");
    const input = searchBox.createEl("input", {
      type: "search",
      placeholder: "\u641C\u7D22\u6587\u4EF6\u540D\u548C\u6B63\u6587\u2026",
      value: this.searchQuery,
      attr: { "aria-label": "\u641C\u7D22\u6587\u4EF6\u540D\u548C\u6B63\u6587" }
    });
    searchBox.addEventListener("click", () => input.focus());
    searchBox.addEventListener("focus", () => input.focus());
    input.addEventListener("input", () => {
      this.searchQuery = input.value;
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => void this.render(), 250);
    });
    const sequence = ++this.searchSequence;
    let files;
    if (this.searchQuery.trim()) {
      const status = root.createDiv({ text: "\u6B63\u5728\u641C\u7D22\u2026", cls: "ov-search-status" });
      files = await this.plugin.searchFiles(this.searchQuery);
      if (sequence !== this.searchSequence) return;
      status.remove();
      this.renderSection(root, `\u641C\u7D22\u7ED3\u679C\uFF08${files.length}\uFF09`, files, "\u6CA1\u6709\u5339\u914D\u7684\u7B14\u8BB0\u3002", true);
    } else {
      this.renderDirectory(root);
    }
  }
  renderDirectory(root) {
    const folder = this.getCurrentFolder();
    const controls = root.createDiv({ cls: "ov-directory-controls" });
    this.iconButton(controls, "arrow-left", "\u540E\u9000", () => this.navigateHistory(-1)).disabled = this.folderBackStack.length === 0;
    this.iconButton(controls, "arrow-right", "\u524D\u8FDB", () => this.navigateHistory(1)).disabled = this.folderForwardStack.length === 0;
    this.iconButton(controls, "arrow-up", "\u4E0A\u4E00\u7EA7", () => this.openParentFolder()).disabled = !this.currentFolderPath;
    const location = controls.createDiv({ cls: "ov-directory-location" });
    (0, import_obsidian.setIcon)(location.createSpan(), "folder-open");
    location.createSpan({ text: this.currentFolderPath || "Vault \u6839\u76EE\u5F55" });
    this.renderBreadcrumbs(root);
    const children = [...folder.children].sort(compareVaultItems);
    this.renderDirectoryList(root, children);
  }
  renderBreadcrumbs(root) {
    const crumbs = root.createDiv({ cls: "ov-breadcrumbs" });
    const rootButton = crumbs.createEl("button", { text: "\u6839\u76EE\u5F55" });
    rootButton.addEventListener("click", () => this.openFolder("", true));
    if (!this.currentFolderPath) return;
    let path = "";
    for (const segment of this.currentFolderPath.split("/")) {
      crumbs.createSpan({ text: "/" });
      path = path ? `${path}/${segment}` : segment;
      const button = crumbs.createEl("button", { text: segment });
      const target = path;
      button.addEventListener("click", () => this.openFolder(target, true));
    }
  }
  renderDirectoryList(root, children) {
    root.createEl("h3", { text: `${this.currentFolderPath || "\u6839\u76EE\u5F55"}\uFF08${children.length}\uFF09`, cls: "ov-section-title" });
    const list = root.createDiv({ cls: "ov-file-list" });
    if (!children.length) {
      list.createEl("p", { text: "\u5F53\u524D\u76EE\u5F55\u4E3A\u7A7A\u3002", cls: "ov-empty" });
      return;
    }
    children.forEach((child) => {
      const row = list.createDiv({ cls: "ov-file-row" });
      const open = row.createEl("button", { cls: "ov-file-open" });
      if (child instanceof import_obsidian.TFolder) {
        (0, import_obsidian.setIcon)(open.createSpan({ cls: "ov-file-icon" }), "folder");
        const labels = open.createSpan({ cls: "ov-file-labels" });
        labels.createEl("strong", { text: child.name || "\u6839\u76EE\u5F55" });
        labels.createEl("small", { text: `${child.children.length} \u9879 \xB7 ${child.path || "Vault \u6839\u76EE\u5F55"}` });
        open.addEventListener("click", () => this.openFolder(child.path, true));
        this.iconButton(row, this.plugin.isFavorite(child.path) ? "star-off" : "star", this.plugin.isFavorite(child.path) ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF", () => void this.plugin.toggleFavorite(child));
        return;
      }
      if (child instanceof import_obsidian.TFile) {
        (0, import_obsidian.setIcon)(open.createSpan({ cls: "ov-file-icon" }), child.extension === "md" ? "file-text" : "file");
        const labels = open.createSpan({ cls: "ov-file-labels" });
        labels.createEl("strong", { text: child.basename });
        labels.createEl("small", { text: child.path });
        open.addEventListener("click", () => void this.plugin.openFile(child));
        if (child.extension === "md") {
          this.iconButton(row, this.plugin.isFavorite(child.path) ? "star-off" : "star", this.plugin.isFavorite(child.path) ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF", () => void this.plugin.toggleFavorite(child));
        }
      }
    });
  }
  renderHistory(root) {
    const heading = root.createDiv({ cls: "ov-section-heading" });
    heading.createEl("h3", { text: `\u9605\u8BFB\u5386\u53F2\uFF08${this.plugin.settings.history.length}\uFF09` });
    const clear = heading.createEl("button", { text: "\u6E05\u7A7A", cls: "mod-warning" });
    clear.disabled = this.plugin.settings.history.length === 0;
    clear.addEventListener("click", () => void this.plugin.clearHistory());
    this.renderTrackedItems(root, "", this.plugin.settings.history, "\u6682\u65E0\u9605\u8BFB\u5386\u53F2\u3002", false, false);
  }
  renderTrackedItems(root, title, paths, emptyText, showFavorite, showHeading = true) {
    const items = paths.map((path) => showFavorite ? this.plugin.getFileOrFolder(path) : this.plugin.getMarkdownFile(path)).filter((item) => item !== null);
    if (showHeading && title) root.createEl("h3", { text: `${title}\uFF08${items.length}\uFF09`, cls: "ov-section-title" });
    this.renderFileList(root, items, emptyText, showFavorite);
  }
  renderSection(root, title, files, emptyText, showFavorite) {
    root.createEl("h3", { text: title, cls: "ov-section-title" });
    this.renderFileList(root, files, emptyText, showFavorite);
  }
  renderFileList(root, files, emptyText, showFavorite) {
    const list = root.createDiv({ cls: "ov-file-list" });
    if (!files.length) {
      list.createEl("p", { text: emptyText, cls: "ov-empty" });
      return;
    }
    files.forEach((file) => {
      const row = list.createDiv({ cls: "ov-file-row" });
      const open = row.createEl("button", { cls: "ov-file-open" });
      (0, import_obsidian.setIcon)(open.createSpan({ cls: "ov-file-icon" }), file instanceof import_obsidian.TFolder ? "folder" : "file-text");
      const labels = open.createSpan({ cls: "ov-file-labels" });
      labels.createEl("strong", { text: file instanceof import_obsidian.TFolder ? file.name || "\u6839\u76EE\u5F55" : file.basename });
      labels.createEl("small", { text: file instanceof import_obsidian.TFolder ? `${file.children.length} \u9879 \xB7 ${file.path || "Vault \u6839\u76EE\u5F55"}` : file.path });
      open.addEventListener("click", () => {
        if (file instanceof import_obsidian.TFolder) {
          this.activeTab = "files";
          this.searchQuery = "";
          this.openFolder(file.path, true);
        } else {
          void this.plugin.openFile(file);
        }
      });
      if (showFavorite) {
        this.iconButton(row, this.plugin.isFavorite(file.path) ? "star-off" : "star", this.plugin.isFavorite(file.path) ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF", () => void this.plugin.toggleFavorite(file));
      }
    });
  }
  renderOutline(root) {
    var _a, _b;
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof import_obsidian.TFile)) return;
    const headings = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.headings) != null ? _b : [];
    root.createEl("h3", { text: "\u672C\u9875\u76EE\u5F55", cls: "ov-section-title" });
    const outline = root.createDiv({ cls: "ov-outline" });
    if (!headings.length) {
      outline.createEl("p", { text: "\u5F53\u524D\u7B14\u8BB0\u6CA1\u6709\u6807\u9898\u3002", cls: "ov-empty" });
      return;
    }
    headings.forEach(({ heading, level }) => {
      const button = outline.createEl("button", { text: heading, cls: "ov-outline-item" });
      button.style.paddingLeft = `${8 + (level - 1) * 12}px`;
      button.addEventListener("click", () => void this.app.workspace.openLinkText(`${file.path}#${heading}`, file.path, false));
    });
  }
  iconButton(root, icon, label, action) {
    const button = root.createEl("button", { cls: "clickable-icon ov-icon-button", attr: { "aria-label": label, title: label } });
    (0, import_obsidian.setIcon)(button, icon);
    button.addEventListener("click", action);
    return button;
  }
  getCurrentFolder() {
    if (!this.currentFolderPath) return this.app.vault.getRoot();
    const folder = this.app.vault.getAbstractFileByPath(this.currentFolderPath);
    if (folder instanceof import_obsidian.TFolder) return folder;
    this.currentFolderPath = "";
    return this.app.vault.getRoot();
  }
  openFolder(path, trackHistory) {
    if (path === this.currentFolderPath) return;
    if (trackHistory) {
      this.folderBackStack.push(this.currentFolderPath);
      this.folderForwardStack = [];
    }
    this.currentFolderPath = path;
    void this.render();
  }
  openParentFolder() {
    if (!this.currentFolderPath) return;
    const parent = this.currentFolderPath.includes("/") ? this.currentFolderPath.slice(0, this.currentFolderPath.lastIndexOf("/")) : "";
    this.openFolder(parent, true);
  }
  navigateHistory(direction) {
    const from = direction < 0 ? this.folderBackStack : this.folderForwardStack;
    const to = direction < 0 ? this.folderForwardStack : this.folderBackStack;
    const next = from.pop();
    if (next === void 0) return;
    to.push(this.currentFolderPath);
    this.currentFolderPath = next;
    void this.render();
  }
};
function compareVaultItems(a, b) {
  const aFolder = a instanceof import_obsidian.TFolder;
  const bFolder = b instanceof import_obsidian.TFolder;
  if (aFolder !== bFolder) return aFolder ? -1 : 1;
  return a.name.localeCompare(b.name);
}

// src/settings.ts
var import_obsidian2 = require("obsidian");
var ObsidianViewerSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Obsidian Viewer" });
    containerEl.createEl("p", {
      text: "\u9605\u8BFB\u5DE5\u4F5C\u53F0\u3001\u641C\u7D22\u3001\u6536\u85CF\u3001\u5386\u53F2\u548C\u4E92\u52A8\u6D4B\u9A8C\u5747\u4FDD\u5B58\u5728\u5F53\u524D vault \u7684\u63D2\u4EF6\u6570\u636E\u4E2D\u3002",
      cls: "setting-item-description"
    });
    containerEl.createEl("h3", { text: "GitHub \u8DE8\u5E73\u53F0\u540C\u6B65" });
    containerEl.createEl("p", {
      text: "\u901A\u8FC7 GitHub REST API \u53CC\u5411\u540C\u6B65\uFF0C\u4E0D\u8C03\u7528\u7CFB\u7EDF Git\uFF0C\u56E0\u6B64\u53EF\u5728 Android\u3001iOS\u3001Windows\u3001macOS \u548C Linux \u4F7F\u7528\u3002\u9996\u6B21\u540C\u6B65\u4F1A\u4FDD\u7559\u4E24\u7AEF\u72EC\u6709\u6587\u4EF6\uFF1B\u540C\u4E00\u8DEF\u5F84\u5185\u5BB9\u51B2\u7A81\u65F6\uFF0C\u8FDC\u7AEF\u4F5C\u4E3A\u4E3B\u6587\u4EF6\uFF0C\u672C\u5730\u7248\u672C\u4FDD\u5B58\u4E3A conflict \u526F\u672C\u3002",
      cls: "setting-item-description"
    });
    new import_obsidian2.Setting(containerEl).setName("GitHub token").setDesc("\u5EFA\u8BAE\u4F7F\u7528\u53EA\u6388\u6743\u6B64\u4ED3\u5E93\u3001Contents: Read and write \u7684 fine-grained token\u3002token \u7531 Obsidian SecretStorage \u4FDD\u5B58\uFF0C\u4E0D\u5199\u5165\u63D2\u4EF6 data.json\u3002").addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder(this.plugin.getGitHubToken() ? "\u5DF2\u5B89\u5168\u4FDD\u5B58\uFF1B\u8F93\u5165\u65B0 token \u53EF\u66FF\u6362" : "github_pat_\u2026");
      text.onChange((value) => {
        if (value.trim()) this.plugin.setGitHubToken(value);
      });
    }).addButton((button) => button.setButtonText("\u6E05\u9664 token").setWarning().onClick(() => {
      this.plugin.setGitHubToken("");
      this.display();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u4ED3\u5E93").setDesc("\u683C\u5F0F\uFF1Aowner/repository").addText((text) => text.setPlaceholder("owner/repository").setValue(this.plugin.settings.syncRepository).onChange(async (value) => {
      this.plugin.settings.syncRepository = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u5206\u652F").setDesc("\u7559\u7A7A\u65F6\u4F7F\u7528\u4ED3\u5E93\u9ED8\u8BA4\u5206\u652F\u3002").addText((text) => text.setPlaceholder("main").setValue(this.plugin.settings.syncBranch).onChange(async (value) => {
      this.plugin.settings.syncBranch = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u81EA\u52A8\u8BC6\u522B\u8BBE\u5907").setDesc(`\u5F53\u524D\u8BBE\u5907\uFF1A${this.plugin.getCurrentDeviceName()}\u3002\u5F00\u542F\u540E\u4F1A\u5728\u6BCF\u4E2A\u5E73\u53F0\u81EA\u52A8\u4F7F\u7528\u6B63\u786E\u7684\u7CFB\u7EDF\u540D\u79F0\u3002`).addToggle((toggle) => toggle.setValue(this.plugin.settings.syncDeviceNameAuto).onChange(async (value) => {
      this.plugin.settings.syncDeviceNameAuto = value;
      if (value) this.plugin.settings.syncDeviceName = this.plugin.getCurrentDeviceName();
      await this.plugin.saveSettings();
      this.display();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u8BBE\u5907\u540D\u79F0").setDesc(this.plugin.settings.syncDeviceNameAuto ? "\u5DF2\u7531\u5F53\u524D\u5E73\u53F0\u81EA\u52A8\u586B\u5199\uFF1B\u5173\u95ED\u4E0A\u65B9\u5F00\u5173\u540E\u53EF\u81EA\u5B9A\u4E49\u3002" : "\u7528\u4E8E commit message \u548C\u51B2\u7A81\u526F\u672C\u6587\u4EF6\u540D\u3002").addText((text) => text.setDisabled(this.plugin.settings.syncDeviceNameAuto).setValue(this.plugin.settings.syncDeviceName).onChange(async (value) => {
      this.plugin.settings.syncDeviceName = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u6D4B\u8BD5\u4E0E\u540C\u6B65").setDesc(this.syncDescription()).addButton((button) => button.setButtonText("\u6D4B\u8BD5\u8FDE\u63A5").onClick(async () => {
      button.setDisabled(true).setButtonText("\u6D4B\u8BD5\u4E2D\u2026");
      try {
        new import_obsidian2.Notice(`GitHub \u8FDE\u63A5\u6210\u529F\uFF1A${await this.plugin.testGitHubConnection()}`);
      } catch (error) {
        new import_obsidian2.Notice(error instanceof Error ? error.message : "\u8FDE\u63A5\u5931\u8D25", 8e3);
      } finally {
        button.setDisabled(false).setButtonText("\u6D4B\u8BD5\u8FDE\u63A5");
      }
    })).addButton((button) => button.setCta().setButtonText("\u7ACB\u5373\u53CC\u5411\u540C\u6B65").onClick(async () => {
      button.setDisabled(true).setButtonText("\u540C\u6B65\u4E2D\u2026");
      await this.plugin.syncNow();
      button.setDisabled(false).setButtonText("\u7ACB\u5373\u53CC\u5411\u540C\u6B65");
      this.display();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u542F\u52A8\u65F6\u540C\u6B65").setDesc("Obsidian \u6253\u5F00\u5F53\u524D vault \u540E\u81EA\u52A8\u540C\u6B65\u4E00\u6B21\u3002").addToggle((toggle) => toggle.setValue(this.plugin.settings.syncOnStartup).onChange(async (value) => {
      this.plugin.settings.syncOnStartup = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u4FDD\u5B58\u540E\u540C\u6B65").setDesc("\u6587\u4EF6\u53D8\u5316\u505C\u6B62 30 \u79D2\u540E\u81EA\u52A8\u540C\u6B65\uFF1B\u8FDE\u7EED\u7F16\u8F91\u53EA\u89E6\u53D1\u4E00\u6B21\u3002").addToggle((toggle) => toggle.setValue(this.plugin.settings.syncOnSave).onChange(async (value) => {
      this.plugin.settings.syncOnSave = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u5B9A\u65F6\u540C\u6B65").setDesc("\u4EC5\u5728 Obsidian \u6B63\u5728\u8FD0\u884C\u65F6\u751F\u6548\uFF0C\u79FB\u52A8\u7AEF\u88AB\u7CFB\u7EDF\u6302\u8D77\u65F6\u4E0D\u4F1A\u540E\u53F0\u5524\u9192\u3002").addToggle((toggle) => toggle.setValue(this.plugin.settings.syncPeriodically).onChange(async (value) => {
      this.plugin.settings.syncPeriodically = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u540C\u6B65\u95F4\u9694\uFF08\u5206\u949F\uFF09").setDesc("\u6700\u77ED 5 \u5206\u949F\u3002").addText((text) => text.setValue(String(this.plugin.settings.syncIntervalMinutes)).onChange(async (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return;
      this.plugin.settings.syncIntervalMinutes = Math.max(5, parsed);
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u5355\u6587\u4EF6\u4E0A\u9650\uFF08MB\uFF09").setDesc("\u9ED8\u8BA4 50 MB\uFF1B\u8D85\u8FC7\u4E0A\u9650\u4F1A\u505C\u6B62\u540C\u6B65\u800C\u4E0D\u662F\u9759\u9ED8\u9057\u6F0F\u3002GitHub \u666E\u901A Git blob \u4E0D\u9002\u5408\u8D85\u5927\u6587\u4EF6\u3002").addText((text) => text.setValue(String(this.plugin.settings.syncMaxFileSizeMb)).onChange(async (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return;
      this.plugin.settings.syncMaxFileSizeMb = Math.min(99, Math.max(1, parsed));
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u5FFD\u7565\u8DEF\u5F84").setDesc("\u6BCF\u884C\u4E00\u4E2A vault \u76F8\u5BF9\u8DEF\u5F84\u6216 glob\u3002\u7B14\u8BB0\u3001\u4E3B\u9898\u3001CSS\u3001\u63D2\u4EF6\u672C\u4F53\u3001\u63D2\u4EF6\u542F\u7528\u5217\u8868\u548C\u63D2\u4EF6\u8BBE\u7F6E\u4F1A\u6B63\u5E38\u540C\u6B65\uFF1B\u5DE5\u4F5C\u533A\u5E03\u5C40\u3001\u56DE\u6536\u7AD9\u3001Git \u5185\u90E8\u5E93\u548C\u540C\u6B65\u5668\u8FD0\u884C\u72B6\u6001\u6309\u8BBE\u5907\u4FDD\u7559\u3002").addTextArea((text) => text.setPlaceholder(".DS_Store\n.obsidian/workspace*.json").setValue(this.plugin.settings.syncIgnorePatterns).onChange(async (value) => {
      this.plugin.settings.syncIgnorePatterns = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("p", {
      text: "\u6CE8\u610F\uFF1A\u5F53\u524D vault \u540C\u65F6\u542F\u7528\u4E86 Obsidian Git\u3002\u542F\u7528\u81EA\u52A8\u540C\u6B65\u524D\uFF0C\u8BF7\u5173\u95ED Obsidian Git \u7684\u81EA\u52A8 pull/backup\uFF0C\u907F\u514D\u4E24\u4E2A\u540C\u6B65\u5668\u540C\u65F6\u66F4\u65B0\u8FDC\u7AEF\u5206\u652F\u3002",
      cls: "ov-setting-warning"
    });
    new import_obsidian2.Setting(containerEl).setName("\u9996\u9875\u7B14\u8BB0").setDesc("\u8F93\u5165 vault \u5185\u7684\u5B8C\u6574 Markdown \u8DEF\u5F84\uFF0C\u4E5F\u53EF\u901A\u8FC7\u547D\u4EE4\u628A\u5F53\u524D\u7B14\u8BB0\u8BBE\u4E3A\u9996\u9875\u3002").addText((text) => text.setPlaceholder("\u4F8B\u5982\uFF1ADATA2002/DATA2002 \u9996\u9875.md").setValue(this.plugin.settings.homeNote).onChange(async (value) => {
      this.plugin.settings.homeNote = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u4F7F\u7528\u5F53\u524D\u7B14\u8BB0").setDesc("\u628A\u5F53\u524D\u6253\u5F00\u7684 Markdown \u7B14\u8BB0\u8BBE\u4E3A\u9996\u9875\u3002").addButton((button) => button.setButtonText("\u8BBE\u4E3A\u9996\u9875").onClick(async () => {
      const file = this.app.workspace.getActiveFile();
      if (file instanceof import_obsidian2.TFile) await this.plugin.setHomeNote(file);
    }));
    new import_obsidian2.Setting(containerEl).setName("\u542F\u52A8\u65F6\u6253\u5F00\u5DE5\u4F5C\u53F0").setDesc("Obsidian \u5B8C\u6210\u5E03\u5C40\u52A0\u8F7D\u540E\u5728\u5DE6\u4FA7\u6253\u5F00 Viewer\u3002").addToggle((toggle) => toggle.setValue(this.plugin.settings.openDashboardOnStartup).onChange(async (value) => {
      this.plugin.settings.openDashboardOnStartup = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u9605\u8BFB\u5386\u53F2\u4E0A\u9650").setDesc("\u4FDD\u7559\u6700\u8FD1 10\u2013500 \u7BC7\u7B14\u8BB0\u3002").addText((text) => text.setValue(String(this.plugin.settings.maxHistory)).onChange(async (value) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return;
      this.plugin.settings.maxHistory = Math.min(500, Math.max(10, parsed));
      this.plugin.settings.history = this.plugin.settings.history.slice(0, this.plugin.settings.maxHistory);
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "\u9605\u8BFB\u663E\u793A" });
    this.addSlider("\u6B63\u6587\u5B57\u53F7", "14\u201324 px", 14, 24, 1, this.plugin.settings.fontSize, (value) => {
      this.plugin.settings.fontSize = value;
    });
    this.addSlider("\u6B63\u6587\u884C\u8DDD", "1.2\u20132.2", 1.2, 2.2, 0.1, this.plugin.settings.lineHeight, (value) => {
      this.plugin.settings.lineHeight = value;
    });
    this.addSlider("\u5185\u5BB9\u6700\u5927\u5BBD\u5EA6", "600\u20131200 px", 600, 1200, 50, this.plugin.settings.contentWidth, (value) => {
      this.plugin.settings.contentWidth = value;
    });
    this.addSlider("\u6BB5\u843D\u95F4\u8DDD", "0.5\u20132.0 em", 0.5, 2, 0.1, this.plugin.settings.paragraphSpacing, (value) => {
      this.plugin.settings.paragraphSpacing = value;
    });
    containerEl.createEl("h3", { text: "\u6570\u636E\u7BA1\u7406" });
    new import_obsidian2.Setting(containerEl).setName("\u6E05\u7A7A\u9605\u8BFB\u5386\u53F2").setDesc(`\u5F53\u524D\u4FDD\u5B58 ${this.plugin.settings.history.length} \u6761\u8BB0\u5F55\uFF0C\u4E0D\u4F1A\u5220\u9664\u4EFB\u4F55\u7B14\u8BB0\u3002`).addButton((button) => button.setWarning().setButtonText("\u6E05\u7A7A").onClick(async () => {
      await this.plugin.clearHistory();
      this.display();
    }));
    new import_obsidian2.Setting(containerEl).setName("\u6E05\u7A7A\u7B54\u9898\u8FDB\u5EA6").setDesc("\u6E05\u9664\u6240\u6709 Quizzable \u4F5C\u7B54\u548C\u8BC4\u5206\u8BB0\u5F55\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u9898\u76EE\u3002").addButton((button) => button.setWarning().setButtonText("\u6E05\u7A7A").onClick(async () => {
      this.plugin.settings.quizProgress = {};
      await this.plugin.saveSettings();
      this.display();
    }));
  }
  addSlider(name, description, min, max, step, value, assign) {
    new import_obsidian2.Setting(this.containerEl).setName(name).setDesc(description).addSlider((slider) => slider.setLimits(min, max, step).setValue(value).setDynamicTooltip().onChange(async (next) => {
      assign(next);
      await this.plugin.saveSettings();
    }));
  }
  syncDescription() {
    const date = this.plugin.settings.lastSyncAt ? new Date(this.plugin.settings.lastSyncAt).toLocaleString() : "\u4ECE\u672A";
    return `\u4E0A\u6B21\u540C\u6B65\uFF1A${date}\uFF1B${this.plugin.settings.lastSyncSummary}`;
  }
};

// src/quiz.ts
var import_obsidian3 = require("obsidian");
function registerQuizProcessors(plugin) {
  plugin.registerMarkdownCodeBlockProcessor("quiz", (source, el) => {
    el.addClass("ov-quiz-definition");
    try {
      const definition = unwrapQuiz((0, import_obsidian3.parseYaml)(source));
      el.setText((definition == null ? void 0 : definition.id) ? `\u9898\u5E93\u5B9A\u4E49\uFF1A${definition.id}` : "\u9898\u5E93\u5B9A\u4E49");
    } catch (e) {
      el.setText("\u9898\u5E93\u5B9A\u4E49\u683C\u5F0F\u9519\u8BEF");
    }
  });
  plugin.registerMarkdownCodeBlockProcessor("playable-quiz", (source, el, context) => {
    const child = new QuizRenderChild(el, source, context, plugin);
    context.addChild(child);
  });
}
var QuizRenderChild = class extends import_obsidian3.MarkdownRenderChild {
  constructor(containerEl, source, context, plugin) {
    super(containerEl);
    this.source = source;
    this.context = context;
    this.plugin = plugin;
  }
  onload() {
    void this.initialize();
  }
  async initialize() {
    try {
      const quiz = await this.resolveQuiz();
      validateQuiz(quiz);
      this.renderQuiz(quiz);
    } catch (error) {
      this.containerEl.empty();
      this.containerEl.createDiv({
        text: `Quizzable\uFF1A${error instanceof Error ? error.message : String(error)}`,
        cls: "ov-quiz-error"
      });
    }
  }
  async resolveQuiz() {
    var _a;
    const parsed = (0, import_obsidian3.parseYaml)(this.source);
    const direct = unwrapQuiz(parsed);
    if ((_a = direct == null ? void 0 : direct.questions) == null ? void 0 : _a.length) return direct;
    const record = asRecord(parsed);
    const definitions = await this.readDefinitions();
    const id = typeof (record == null ? void 0 : record.id) === "string" ? record.id : null;
    if (id && definitions.has(id)) return definitions.get(id);
    if ((record == null ? void 0 : record.source) === "current") {
      const first = definitions.values().next().value;
      if (first) return first;
    }
    throw new Error(id ? `\u627E\u4E0D\u5230\u9898\u5E93\u5B9A\u4E49\uFF1A${id}` : "\u9700\u8981\u5B8C\u6574 quiz\u3001\u9898\u5E93 id\uFF0C\u6216 source: current\u3002");
  }
  async readDefinitions() {
    var _a;
    const definitions = /* @__PURE__ */ new Map();
    const file = this.plugin.app.vault.getAbstractFileByPath(this.context.sourcePath);
    if (!(file instanceof import_obsidian3.TFile)) return definitions;
    const markdown = await this.plugin.app.vault.cachedRead(file);
    const pattern = /```quiz\s*\n([\s\S]*?)```/gi;
    for (const match of markdown.matchAll(pattern)) {
      try {
        const quiz = unwrapQuiz((0, import_obsidian3.parseYaml)((_a = match[1]) != null ? _a : ""));
        if (quiz == null ? void 0 : quiz.id) definitions.set(quiz.id, quiz);
      } catch (e) {
      }
    }
    return definitions;
  }
  renderQuiz(quiz) {
    const key = `${this.context.sourcePath}:${quiz.id}`;
    const stored = this.plugin.getQuizProgress(key);
    const state = {
      answers: { ...stored.answers },
      page: Number.isFinite(stored.page) ? stored.page : 0,
      submitted: Boolean(stored.submitted)
    };
    const questions = quiz.questions;
    state.page = Math.max(0, Math.min(state.page, questions.length - 1));
    const save = () => {
      if (quiz.persistAnswers !== false) this.plugin.setQuizProgress(key, state);
    };
    const draw = () => {
      this.containerEl.empty();
      const card = this.containerEl.createDiv({ cls: "ov-quiz-card" });
      card.createEl("h3", { text: quiz.title || quiz.id });
      if (quiz.description) card.createDiv({ text: quiz.description, cls: "ov-quiz-description" });
      if (state.submitted) this.renderTotal(card, quiz, state);
      const oneAtATime = quiz.mode !== "all-at-once";
      const visibleQuestions = oneAtATime ? [questions[state.page]] : questions;
      visibleQuestions.forEach((question) => this.renderQuestion(card, question, state, save, draw));
      if (oneAtATime) {
        const navigation = card.createDiv({ cls: "ov-quiz-nav" });
        const previous = navigation.createEl("button", { text: "\u4E0A\u4E00\u9898" });
        previous.disabled = state.page === 0;
        previous.addEventListener("click", () => {
          state.page = Math.max(0, state.page - 1);
          save();
          draw();
        });
        navigation.createSpan({ text: `${state.page + 1}/${questions.length}` });
        const next = navigation.createEl("button", { text: "\u4E0B\u4E00\u9898" });
        next.disabled = state.page >= questions.length - 1;
        next.addEventListener("click", () => {
          state.page = Math.min(questions.length - 1, state.page + 1);
          save();
          draw();
        });
      }
      const actions = card.createDiv({ cls: "ov-quiz-actions" });
      const submit = actions.createEl("button", { text: state.submitted ? "\u91CD\u65B0\u8BC4\u5206" : "\u63D0\u4EA4", cls: "mod-cta" });
      submit.addEventListener("click", () => {
        state.submitted = true;
        save();
        draw();
      });
      const retry = actions.createEl("button", { text: "\u91CD\u65B0\u4F5C\u7B54" });
      retry.addEventListener("click", () => {
        state.answers = {};
        state.submitted = false;
        state.page = 0;
        this.plugin.setQuizProgress(key, state);
        draw();
      });
    };
    draw();
  }
  renderQuestion(card, question, state, save, draw) {
    var _a, _b, _c, _d;
    const section = card.createEl("section", { cls: "ov-quiz-question" });
    section.createEl("strong", { text: question.prompt });
    const answer = state.answers[question.id];
    const disabled = state.submitted;
    if (question.type === "multiple-choice" || question.type === "true-false") {
      const options = question.type === "true-false" ? [{ id: "true", text: "True" }, { id: "false", text: "False" }] : (_a = question.options) != null ? _a : [];
      options.forEach((option) => {
        const label = section.createEl("label", { cls: "ov-quiz-option" });
        const input = label.createEl("input", { type: "radio", attr: { name: `${question.id}-${this.context.sourcePath}` } });
        input.value = option.id;
        input.checked = String(answer != null ? answer : "") === String(option.id);
        input.disabled = disabled;
        label.createSpan({ text: option.text });
        input.addEventListener("change", () => {
          state.answers[question.id] = option.id;
          save();
        });
      });
    } else if (question.type === "multiple-select") {
      const selected = new Set(asStringArray(answer));
      ((_b = question.options) != null ? _b : []).forEach((option) => {
        const label = section.createEl("label", { cls: "ov-quiz-option" });
        const input = label.createEl("input", { type: "checkbox" });
        input.checked = selected.has(option.id);
        input.disabled = disabled;
        label.createSpan({ text: option.text });
        input.addEventListener("change", () => {
          if (input.checked) selected.add(option.id);
          else selected.delete(option.id);
          state.answers[question.id] = [...selected];
          save();
        });
      });
    } else if (question.type === "short-text" || question.type === "numeric") {
      const input = section.createEl("input", {
        type: question.type === "numeric" ? "number" : "text",
        cls: "ov-quiz-text-input"
      });
      input.value = typeof answer === "string" ? answer : "";
      input.disabled = disabled;
      input.addEventListener("input", () => {
        state.answers[question.id] = input.value;
        save();
      });
    } else if (question.type === "matching") {
      const matches = isStringRecord(answer) ? answer : {};
      ((_c = question.prompts) != null ? _c : []).forEach((prompt) => {
        var _a2, _b2;
        const label = section.createEl("label", { cls: "ov-quiz-match" });
        label.createSpan({ text: prompt.text });
        const select = label.createEl("select");
        select.createEl("option", { text: "\u2014", value: "" });
        ((_a2 = question.choices) != null ? _a2 : []).forEach((choice) => select.createEl("option", { text: choice.text, value: choice.id }));
        select.value = (_b2 = matches[prompt.id]) != null ? _b2 : "";
        select.disabled = disabled;
        select.addEventListener("change", () => {
          state.answers[question.id] = { ...matches, [prompt.id]: select.value };
          save();
        });
      });
    } else if (question.type === "reorder") {
      const items = (_d = question.items) != null ? _d : [];
      const order = asStringArray(answer).length ? asStringArray(answer) : items.map((item) => item.id);
      const byId = new Map(items.map((item) => [item.id, item]));
      const orderBox = section.createDiv({ cls: "ov-quiz-order" });
      order.forEach((id, index) => {
        var _a2, _b2;
        const row = orderBox.createDiv({ cls: "ov-quiz-order-row" });
        row.createSpan({ text: `${index + 1}. ${(_b2 = (_a2 = byId.get(id)) == null ? void 0 : _a2.text) != null ? _b2 : id}` });
        const up = row.createEl("button", { text: "\u25B2", attr: { "aria-label": "\u4E0A\u79FB" } });
        up.disabled = disabled || index === 0;
        up.addEventListener("click", () => {
          [order[index - 1], order[index]] = [order[index], order[index - 1]];
          state.answers[question.id] = order;
          save();
          draw();
        });
        const down = row.createEl("button", { text: "\u25BC", attr: { "aria-label": "\u4E0B\u79FB" } });
        down.disabled = disabled || index === order.length - 1;
        down.addEventListener("click", () => {
          [order[index], order[index + 1]] = [order[index + 1], order[index]];
          state.answers[question.id] = order;
          save();
          draw();
        });
      });
    }
    if (state.submitted) {
      const result = scoreQuestion(question, state.answers[question.id]);
      const feedback = section.createDiv({
        cls: `ov-quiz-feedback ${result.ratio === 1 ? "is-correct" : "is-wrong"}`
      });
      feedback.createSpan({ text: result.ratio === 1 ? "\u6B63\u786E" : "\u672A\u5B8C\u5168\u6B63\u786E" });
      if (question.explanation) feedback.createSpan({ text: ` \u2014 ${question.explanation}` });
    }
  }
  renderTotal(card, quiz, state) {
    const scores = quiz.questions.map((question) => scoreQuestion(question, state.answers[question.id]));
    const score = scores.reduce((sum, item) => sum + item.points, 0);
    const total = scores.reduce((sum, item) => sum + item.total, 0);
    const percent = total ? Math.round(score / total * 100) : 0;
    const result = card.createDiv({ cls: "ov-quiz-result" });
    let suffix = "";
    if (quiz.passingScore !== void 0) suffix = percent >= quiz.passingScore ? " \xB7 \u901A\u8FC7" : " \xB7 \u672A\u901A\u8FC7";
    result.setText(`\u5F97\u5206 ${score.toFixed(1)}/${total}\uFF08${percent}%\uFF09${suffix}`);
  }
};
function scoreQuestion(question, answer) {
  var _a, _b, _c, _d, _e, _f;
  let ratio = 0;
  if (question.type === "multiple-choice" || question.type === "true-false") {
    ratio = String(answer) === String(question.correctAnswer) ? 1 : 0;
  } else if (question.type === "multiple-select") {
    const actual = new Set(asStringArray(answer));
    const correct = new Set(((_a = question.correctAnswers) != null ? _a : []).map(String));
    if (question.scoring === "partial") {
      const good = [...actual].filter((value) => correct.has(value)).length;
      const bad = [...actual].filter((value) => !correct.has(value)).length;
      ratio = Math.max(0, (good - bad) / Math.max(1, correct.size));
    } else {
      ratio = actual.size === correct.size && [...actual].every((value) => correct.has(value)) ? 1 : 0;
    }
  } else if (question.type === "short-text") {
    const actual = String(answer != null ? answer : "").trim();
    ratio = ((_b = question.acceptedAnswers) != null ? _b : []).some((candidate) => {
      const expected = String(candidate).trim();
      return question.caseSensitive ? actual === expected : actual.toLocaleLowerCase() === expected.toLocaleLowerCase();
    }) ? 1 : 0;
  } else if (question.type === "numeric") {
    const actual = Number(answer);
    const expected = Number(question.correctAnswer);
    ratio = Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= Number((_c = question.tolerance) != null ? _c : 0) ? 1 : 0;
  } else if (question.type === "matching") {
    const actual = isStringRecord(answer) ? answer : {};
    const expected = Object.entries((_d = question.correctMatches) != null ? _d : {});
    ratio = expected.length ? expected.filter(([key, value]) => actual[key] === value).length / expected.length : 0;
  } else if (question.type === "reorder") {
    ratio = JSON.stringify(asStringArray(answer)) === JSON.stringify((_e = question.correctOrder) != null ? _e : []) ? 1 : 0;
  }
  const total = Number((_f = question.points) != null ? _f : 1);
  return { ratio, points: total * ratio, total };
}
function validateQuiz(quiz) {
  if (!quiz || typeof quiz !== "object") throw new Error("\u9898\u76EE\u5FC5\u987B\u662F YAML \u5BF9\u8C61\u3002");
  if (!quiz.id || typeof quiz.id !== "string") throw new Error("\u9898\u76EE\u9700\u8981 id\u3002");
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) throw new Error("\u9898\u76EE\u9700\u8981\u975E\u7A7A questions\u3002");
  const ids = /* @__PURE__ */ new Set();
  quiz.questions.forEach((question, index) => {
    if (!(question == null ? void 0 : question.id) || !question.type || !question.prompt) throw new Error(`\u7B2C ${index + 1} \u9898\u7F3A\u5C11 id\u3001type \u6216 prompt\u3002`);
    if (ids.has(question.id)) throw new Error(`\u9898\u76EE id \u91CD\u590D\uFF1A${question.id}`);
    ids.add(question.id);
    if (!["multiple-choice", "true-false", "multiple-select", "short-text", "numeric", "matching", "reorder"].includes(question.type)) {
      throw new Error(`\u4E0D\u652F\u6301\u7684\u9898\u578B\uFF1A${String(question.type)}`);
    }
  });
}
function unwrapQuiz(value) {
  const record = asRecord(value);
  if (!record) return null;
  const nested = asRecord(record.quiz);
  return nested != null ? nested : record;
}
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function asStringArray(value) {
  return Array.isArray(value) ? value.map(String) : [];
}
function isStringRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// src/github-sync.ts
var import_obsidian4 = require("obsidian");
var API_ROOT = "https://api.github.com";
var API_VERSION = "2026-03-10";
var HARD_EXCLUDES = [".git/", ".trash/"];
var MAX_SYNC_ATTEMPTS = 5;
var MAX_REF_UPDATE_ATTEMPTS = 8;
var GitHubSyncService = class {
  constructor(plugin, onStatus) {
    this.plugin = plugin;
    this.onStatus = onStatus;
    this.running = false;
  }
  get isRunning() {
    return this.running;
  }
  async testConnection() {
    const token = this.requireToken();
    const repository = await this.getRepository(token);
    const branch = this.plugin.settings.syncBranch.trim() || repository.default_branch;
    const head = await this.getHead(token, branch);
    return { repository: repository.full_name, branch, commitSha: head.commitSha };
  }
  async sync() {
    if (this.running) throw new Error("\u540C\u6B65\u5DF2\u7ECF\u5728\u8FDB\u884C\u4E2D\u3002");
    this.running = true;
    try {
      const token = this.requireToken();
      this.update("connecting", "\u6B63\u5728\u8FDE\u63A5 GitHub\u2026");
      const repository = await this.getRepository(token);
      const branch = this.plugin.settings.syncBranch.trim() || repository.default_branch;
      let latestRemoteChange = null;
      for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
        try {
          if (attempt > 1) {
            await sleep(600 * attempt);
            this.update("connecting", `\u8FDC\u7AEF\u521A\u521A\u66F4\u65B0\uFF0C\u6B63\u5728\u91CD\u65B0\u540C\u6B65\uFF08\u7B2C ${attempt} \u6B21\uFF09\u2026`);
          }
          return await this.syncAttempt(token, branch);
        } catch (error) {
          if (isRemoteChangedDuringSync(error) && attempt < MAX_SYNC_ATTEMPTS) {
            latestRemoteChange = error;
            continue;
          }
          throw error;
        }
      }
      throw latestRemoteChange != null ? latestRemoteChange : new Error("\u540C\u6B65\u91CD\u8BD5\u5931\u8D25\u3002");
    } catch (error) {
      this.update("error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.running = false;
    }
  }
  async syncAttempt(token, branch) {
    var _a;
    const remote = await this.getHead(token, branch);
    const base = this.plugin.settings.lastSyncedCommit ? await this.tryGetSnapshot(token, this.plugin.settings.lastSyncedCommit) : null;
    this.update("scanning", "\u6B63\u5728\u8BA1\u7B97\u672C\u5730\u6587\u4EF6\u6307\u7EB9\u2026");
    const local = await this.getLocalSnapshot();
    const plan = createReconcilePlan(local, remote.files, (_a = base == null ? void 0 : base.files) != null ? _a : null);
    this.update("reconciling", "\u6B63\u5728\u5408\u5E76\u672C\u5730\u4E0E\u8FDC\u7AEF\u53D8\u66F4\u2026");
    let pulled = 0;
    let deleted = 0;
    let conflicts = 0;
    const upload = new Map(plan.upload);
    const protectedConflicts = /* @__PURE__ */ new Set();
    const localWins = /* @__PURE__ */ new Set();
    for (const conflict of plan.conflicts) {
      if (!conflict.remote && this.isSelfCoreFile(conflict.path)) {
        upload.set(conflict.path, conflict.local);
        protectedConflicts.add(conflict.path);
        continue;
      }
      const remoteModifiedAt = await this.getRemoteModifiedAt(token, branch, conflict.path);
      if (conflict.local.mtime >= remoteModifiedAt) {
        upload.set(conflict.path, conflict.local);
        localWins.add(conflict.path);
        if (conflict.remote) {
          const preserved = await this.createRemoteConflictCopy(token, conflict.remote);
          upload.set(preserved.path, preserved);
        }
      } else {
        const preserved = await this.createConflictCopy(conflict.local);
        upload.set(preserved.path, preserved);
      }
      conflicts++;
    }
    const pullOperations = [
      ...plan.conflicts.filter(({ path }) => !protectedConflicts.has(path) && !localWins.has(path)).map(({ path, remote: remoteFile }) => ({ path, remote: remoteFile })),
      ...plan.pull.filter(({ path, remote: remoteFile }) => {
        if (remoteFile || !this.isSelfCoreFile(path)) return true;
        const localFile = local.get(path);
        if (localFile) upload.set(path, localFile);
        return false;
      })
    ];
    for (let index = 0; index < pullOperations.length; index++) {
      const operation = pullOperations[index];
      this.update("pulling", `\u6B63\u5728\u5E94\u7528\u8FDC\u7AEF\u53D8\u66F4\uFF1A${operation.path}`, index + 1, pullOperations.length);
      if (operation.remote) {
        await this.writeRemoteFile(token, operation.remote);
        pulled++;
      } else {
        const existing = this.plugin.app.vault.getFileByPath(operation.path);
        if (existing || await this.plugin.app.vault.adapter.exists(operation.path)) {
          if (existing) await this.plugin.app.vault.trash(existing, false);
          else await this.plugin.app.vault.adapter.trashLocal(operation.path);
          deleted++;
        }
      }
    }
    const enabledList = await this.ensureSelfEnabled();
    if (enabledList) upload.set(enabledList.path, enabledList);
    let commitSha = remote.commitSha;
    let pushed = 0;
    if (upload.size) {
      const entries = [];
      let index = 0;
      for (const [path, localFile] of upload) {
        index++;
        this.update("pushing", `\u6B63\u5728\u4E0A\u4F20\u672C\u5730\u53D8\u66F4\uFF1A${path}`, index, upload.size);
        if (!localFile) {
          entries.push({ path, mode: "100644", type: "blob", sha: null });
          pushed++;
          continue;
        }
        if (!await this.plugin.app.vault.adapter.exists(localFile.path)) continue;
        const data = await this.readLocalBinary(localFile.path);
        this.ensureFileSize(localFile.path, data.byteLength);
        const blob = await this.api(token, "POST", "/git/blobs", {
          content: (0, import_obsidian4.arrayBufferToBase64)(data),
          encoding: "base64"
        });
        entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
        pushed++;
      }
      if (entries.length) commitSha = await this.pushEntriesWithRemoteRetry(token, branch, remote, entries);
    }
    const result = {
      branch,
      commitSha,
      pulled,
      pushed,
      deleted,
      conflicts,
      changed: pulled + pushed + deleted + conflicts > 0
    };
    this.update("complete", result.changed ? "\u540C\u6B65\u5B8C\u6210" : "\u672C\u5730\u4E0E\u8FDC\u7AEF\u5DF2\u7ECF\u4E00\u81F4");
    return result;
  }
  async pushEntriesWithRemoteRetry(token, branch, plannedRemote, entries) {
    let remote = plannedRemote;
    let latestRemoteChange = null;
    for (let attempt = 1; attempt <= MAX_REF_UPDATE_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await sleep(Math.min(5e3, 350 * attempt));
        this.update("pushing", `\u8FDC\u7AEF\u521A\u521A\u66F4\u65B0\uFF0C\u6B63\u5728\u57FA\u4E8E\u6700\u65B0\u7248\u672C\u63D0\u4EA4\uFF08\u7B2C ${attempt} \u6B21\uFF09\u2026`);
        remote = await this.getHead(token, branch);
        if (this.entriesTouchChangedRemotePaths(entries, plannedRemote, remote)) {
          throw new RemoteChangedDuringSyncError("\u8FDC\u7AEF\u5728\u540C\u6B65\u671F\u95F4\u4FEE\u6539\u4E86\u540C\u4E00\u8DEF\u5F84\uFF0C\u6B63\u5728\u91CD\u65B0\u5408\u5E76\u3002");
        }
      }
      try {
        const tree = await this.api(token, "POST", "/git/trees", {
          base_tree: remote.treeSha,
          tree: entries
        });
        const commit = await this.api(token, "POST", "/git/commits", {
          message: this.commitMessage(),
          tree: tree.sha,
          parents: [remote.commitSha]
        });
        await this.api(token, "PATCH", `/git/refs/heads/${encodeURIComponent(branch)}`, {
          sha: commit.sha,
          force: false
        });
        return commit.sha;
      } catch (error) {
        if (isRemoteChangedDuringSync(error) && attempt < MAX_REF_UPDATE_ATTEMPTS) {
          latestRemoteChange = error;
          continue;
        }
        throw error;
      }
    }
    throw latestRemoteChange != null ? latestRemoteChange : new Error("\u8FDC\u7AEF\u6301\u7EED\u53D8\u5316\uFF0C\u540C\u6B65\u63D0\u4EA4\u5931\u8D25\u3002");
  }
  entriesTouchChangedRemotePaths(entries, plannedRemote, latestRemote) {
    return entries.some((entry) => {
      var _a, _b;
      return ((_a = plannedRemote.files.get(entry.path)) == null ? void 0 : _a.sha) !== ((_b = latestRemote.files.get(entry.path)) == null ? void 0 : _b.sha);
    });
  }
  requireToken() {
    const token = this.plugin.getGitHubToken();
    if (!token) throw new Error("\u8BF7\u5148\u5728 Obsidian Viewer \u8BBE\u7F6E\u4E2D\u4FDD\u5B58 GitHub token\u3002");
    return token;
  }
  async getRepository(token) {
    return this.api(token, "GET", "");
  }
  async getHead(token, branch) {
    const reference = await this.api(token, "GET", `/git/ref/heads/${encodeURIComponent(branch)}`);
    return this.getSnapshot(token, reference.object.sha);
  }
  async tryGetSnapshot(token, commitSha) {
    if (!/^[0-9a-f]{40}$/i.test(commitSha)) return null;
    try {
      return await this.getSnapshot(token, commitSha);
    } catch (e) {
      return null;
    }
  }
  async getSnapshot(token, commitSha) {
    const commit = await this.api(token, "GET", `/git/commits/${encodeURIComponent(commitSha)}`);
    const tree = await this.api(token, "GET", `/git/trees/${encodeURIComponent(commit.tree.sha)}?recursive=1`);
    if (tree.truncated) throw new Error("\u8FDC\u7AEF\u4ED3\u5E93\u6587\u4EF6\u6811\u8D85\u8FC7 GitHub \u5355\u6B21\u9012\u5F52\u8BFB\u53D6\u4E0A\u9650\uFF0C\u5DF2\u505C\u6B62\u540C\u6B65\u4EE5\u907F\u514D\u9057\u6F0F\u6587\u4EF6\u3002");
    const files = /* @__PURE__ */ new Map();
    tree.tree.forEach((entry) => {
      var _a;
      const path = (0, import_obsidian4.normalizePath)(entry.path);
      if (entry.type !== "blob" || this.isIgnored(path)) return;
      files.set(path, { path, sha: entry.sha, mode: entry.mode, size: (_a = entry.size) != null ? _a : 0 });
    });
    return { commitSha: commit.sha, treeSha: commit.tree.sha, files };
  }
  async getLocalSnapshot() {
    const files = await this.listAdapterFiles();
    const snapshot = /* @__PURE__ */ new Map();
    for (let index = 0; index < files.length; index++) {
      const path = files[index];
      this.update("scanning", `\u6B63\u5728\u626B\u63CF\uFF1A${path}`, index + 1, files.length);
      const data = await this.readLocalBinary(path);
      this.ensureFileSize(path, data.byteLength);
      snapshot.set(path, { path, sha: await gitBlobSha(data), mtime: await this.getLocalModifiedAt(path) });
    }
    return snapshot;
  }
  async listAdapterFiles() {
    const output = [];
    const visit = async (directory) => {
      const listed = await this.plugin.app.vault.adapter.list(directory || "/");
      for (const rawPath of listed.files) {
        const path = adapterPath(rawPath);
        if (path && !this.isIgnored(path)) output.push(path);
      }
      for (const rawPath of listed.folders) {
        const path = adapterPath(rawPath);
        if (path && !this.isIgnored(path)) await visit(path);
      }
    };
    await visit("/");
    return [...new Set(output)].sort();
  }
  async readLocalBinary(path) {
    const file = this.plugin.app.vault.getFileByPath(path);
    return file ? this.plugin.app.vault.readBinary(file) : this.plugin.app.vault.adapter.readBinary(path);
  }
  async writeRemoteFile(token, remote) {
    this.ensureFileSize(remote.path, remote.size);
    const blob = await this.api(token, "GET", `/git/blobs/${encodeURIComponent(remote.sha)}`);
    if (blob.encoding !== "base64") throw new Error(`GitHub \u8FD4\u56DE\u4E86\u4E0D\u652F\u6301\u7684\u7F16\u7801\uFF1A${remote.path}`);
    const data = (0, import_obsidian4.base64ToArrayBuffer)(blob.content.replace(/\s/g, ""));
    this.ensureFileSize(remote.path, data.byteLength);
    await this.ensureParentFolders(remote.path);
    try {
      const existing = this.plugin.app.vault.getAbstractFileByPath(remote.path);
      if (existing instanceof import_obsidian4.TFile) {
        await this.plugin.app.vault.modifyBinary(existing, data);
      } else if (existing) {
        throw new Error(`\u8FDC\u7AEF\u6587\u4EF6\u4E0E\u672C\u5730\u6587\u4EF6\u5939\u540C\u540D\uFF1A${remote.path}`);
      } else if (await this.plugin.app.vault.adapter.exists(remote.path)) {
        await this.plugin.app.vault.adapter.writeBinary(remote.path, data);
      } else {
        await this.plugin.app.vault.createBinary(remote.path, data);
      }
    } catch (error) {
      throw new Error(`\u5199\u5165\u8FDC\u7AEF\u6587\u4EF6\u5931\u8D25\uFF1A${remote.path}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async createConflictCopy(local) {
    const data = await this.readLocalBinary(local.path);
    const path = await this.availableConflictPath(local.path);
    await this.ensureParentFolders(path);
    await this.plugin.app.vault.adapter.writeBinary(path, data);
    return { path, sha: await gitBlobSha(data), mtime: Date.now() };
  }
  async createRemoteConflictCopy(token, remote) {
    this.ensureFileSize(remote.path, remote.size);
    const blob = await this.api(token, "GET", `/git/blobs/${encodeURIComponent(remote.sha)}`);
    if (blob.encoding !== "base64") throw new Error(`GitHub \u8FD4\u56DE\u4E86\u4E0D\u652F\u6301\u7684\u7F16\u7801\uFF1A${remote.path}`);
    const data = (0, import_obsidian4.base64ToArrayBuffer)(blob.content.replace(/\s/g, ""));
    const path = await this.availableConflictPath(remote.path);
    await this.ensureParentFolders(path);
    await this.plugin.app.vault.adapter.writeBinary(path, data);
    return { path, sha: await gitBlobSha(data), mtime: Date.now() };
  }
  async getLocalModifiedAt(path) {
    var _a;
    const file = this.plugin.app.vault.getFileByPath(path);
    if (file instanceof import_obsidian4.TFile) return file.stat.mtime;
    try {
      const stat = await this.plugin.app.vault.adapter.stat(path);
      return (_a = stat == null ? void 0 : stat.mtime) != null ? _a : 0;
    } catch (e) {
      return 0;
    }
  }
  async getRemoteModifiedAt(token, branch, path) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
      const commits = await this.api(token, "GET", `/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=1`);
      const date = (_h = (_g = (_c = (_b = (_a = commits[0]) == null ? void 0 : _a.commit) == null ? void 0 : _b.committer) == null ? void 0 : _c.date) != null ? _g : (_f = (_e = (_d = commits[0]) == null ? void 0 : _d.commit) == null ? void 0 : _e.author) == null ? void 0 : _f.date) != null ? _h : "";
      const timestamp = Date.parse(date);
      return Number.isFinite(timestamp) ? timestamp : 0;
    } catch (e) {
      return 0;
    }
  }
  async availableConflictPath(path) {
    const slash = path.lastIndexOf("/");
    const directory = slash >= 0 ? path.slice(0, slash + 1) : "";
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : "";
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const device = sanitizeSegment(this.plugin.settings.syncDeviceName || "device");
    let candidate = `${directory}${stem}.conflict-${device}-${stamp}${extension}`;
    let counter = 2;
    while (await this.plugin.app.vault.adapter.exists(candidate)) {
      candidate = `${directory}${stem}.conflict-${device}-${stamp}-${counter}${extension}`;
      counter++;
    }
    return candidate;
  }
  async ensureParentFolders(path) {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (!parent) return;
    let current = "";
    for (const segment of parent.split("/")) {
      current = current ? `${current}/${segment}` : segment;
      const existing = this.plugin.app.vault.getAbstractFileByPath(current);
      if (existing instanceof import_obsidian4.TFile) throw new Error(`\u65E0\u6CD5\u521B\u5EFA\u6587\u4EF6\u5939\uFF0C\u5DF2\u6709\u540C\u540D\u6587\u4EF6\uFF1A${current}`);
      if (!existing && !await this.plugin.app.vault.adapter.exists(current)) {
        try {
          await this.plugin.app.vault.createFolder(current);
        } catch (error) {
          if (!await this.plugin.app.vault.adapter.exists(current)) throw error;
        }
      }
    }
  }
  async ensureSelfEnabled() {
    const path = (0, import_obsidian4.normalizePath)(`${this.plugin.app.vault.configDir}/community-plugins.json`);
    let enabled;
    try {
      const content = await this.plugin.app.vault.adapter.read(path);
      enabled = JSON.parse(content);
    } catch (error) {
      throw new Error(`\u65E0\u6CD5\u8BFB\u53D6\u63D2\u4EF6\u542F\u7528\u5217\u8868 ${path}\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
    if (!Array.isArray(enabled) || !enabled.every((id) => typeof id === "string")) {
      throw new Error(`\u63D2\u4EF6\u542F\u7528\u5217\u8868\u683C\u5F0F\u65E0\u6548\uFF1A${path}`);
    }
    if (enabled.includes(this.plugin.manifest.id)) return null;
    const updated = [...enabled, this.plugin.manifest.id];
    const bytes = new TextEncoder().encode(`${JSON.stringify(updated, null, 2)}
`);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await this.plugin.app.vault.adapter.writeBinary(path, data);
    if (this.isIgnored(path)) return null;
    return { path, sha: await gitBlobSha(data), mtime: Date.now() };
  }
  isSelfCoreFile(path) {
    const enabledList = (0, import_obsidian4.normalizePath)(`${this.plugin.app.vault.configDir}/community-plugins.json`);
    if (path === enabledList) return true;
    const root = (0, import_obsidian4.normalizePath)(`${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}`);
    return ["main.js", "manifest.json", "styles.css"].some((name) => path === `${root}/${name}`);
  }
  isIgnored(path) {
    const normalized = (0, import_obsidian4.normalizePath)(path);
    if (HARD_EXCLUDES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))) return true;
    return parseIgnorePatterns(this.plugin.settings.syncIgnorePatterns).some((pattern) => matchesPattern(normalized, pattern));
  }
  ensureFileSize(path, bytes) {
    const maximum = Math.max(1, this.plugin.settings.syncMaxFileSizeMb) * 1024 * 1024;
    if (bytes > maximum) {
      throw new Error(`\u6587\u4EF6\u8D85\u8FC7 ${this.plugin.settings.syncMaxFileSizeMb} MB \u540C\u6B65\u4E0A\u9650\uFF1A${path}`);
    }
  }
  commitMessage() {
    const device = this.plugin.settings.syncDeviceName.trim() || "Obsidian";
    return `Vault sync from ${device} at ${(/* @__PURE__ */ new Date()).toISOString()}`;
  }
  async api(token, method, endpoint, body) {
    const { owner, repository } = parseRepository(this.plugin.settings.syncRepository);
    const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${endpoint}`;
    const response = await (0, import_obsidian4.requestUrl)({
      url,
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "obsidian-viewer-sync"
      },
      contentType: "application/json",
      body: body === void 0 ? void 0 : JSON.stringify(body),
      throw: false
    });
    if (response.status >= 200 && response.status < 300) return response.json;
    let detail = "";
    try {
      const parsed = response.json;
      detail = (parsed == null ? void 0 : parsed.message) ? `\uFF1A${parsed.message}` : "";
    } catch (e) {
      detail = response.text ? `\uFF1A${response.text.slice(0, 200)}` : "";
    }
    if (response.status === 401) throw new Error("GitHub token \u65E0\u6548\u6216\u5DF2\u7ECF\u8FC7\u671F\u3002");
    if (response.status === 403) throw new Error("GitHub token \u7F3A\u5C11\u4ED3\u5E93 Contents \u8BFB\u5199\u6743\u9650\uFF0C\u6216\u8BF7\u6C42\u53D7\u5230\u901F\u7387\u9650\u5236\u3002");
    if (response.status === 404) throw new Error("\u627E\u4E0D\u5230\u4ED3\u5E93\u3001\u5206\u652F\u6216 commit\uFF1B\u8BF7\u68C0\u67E5 token \u6388\u6743\u8303\u56F4\u548C\u540C\u6B65\u8BBE\u7F6E\u3002");
    if (response.status === 409 || response.status === 422) throw new RemoteChangedDuringSyncError(`\u8FDC\u7AEF\u5728\u540C\u6B65\u671F\u95F4\u53D1\u751F\u53D8\u5316\uFF0C\u5DF2\u81EA\u52A8\u91CD\u65B0\u540C\u6B65${detail}`);
    throw new Error(`GitHub API \u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09${detail}`);
  }
  update(stage, message, current, total) {
    this.onStatus({ stage, message, current, total });
  }
};
function createReconcilePlan(local, remote, base) {
  var _a;
  const upload = /* @__PURE__ */ new Map();
  const pull = [];
  const conflicts = [];
  const paths = /* @__PURE__ */ new Set([...local.keys(), ...remote.keys(), ...(_a = base == null ? void 0 : base.keys()) != null ? _a : []]);
  for (const path of [...paths].sort()) {
    const localFile = local.get(path);
    const remoteFile = remote.get(path);
    if (!base) {
      if (localFile && !remoteFile) upload.set(path, localFile);
      else if (!localFile && remoteFile) pull.push({ path, remote: remoteFile });
      else if (localFile && remoteFile && localFile.sha !== remoteFile.sha) conflicts.push({ path, local: localFile, remote: remoteFile });
      continue;
    }
    const baseFile = base.get(path);
    const localChanged = (localFile == null ? void 0 : localFile.sha) !== (baseFile == null ? void 0 : baseFile.sha);
    const remoteChanged = (remoteFile == null ? void 0 : remoteFile.sha) !== (baseFile == null ? void 0 : baseFile.sha);
    if (!localChanged && !remoteChanged) continue;
    if (localChanged && !remoteChanged) {
      upload.set(path, localFile != null ? localFile : null);
      continue;
    }
    if (!localChanged && remoteChanged) {
      pull.push({ path, remote: remoteFile != null ? remoteFile : null });
      continue;
    }
    if ((localFile == null ? void 0 : localFile.sha) === (remoteFile == null ? void 0 : remoteFile.sha)) continue;
    if (localFile) conflicts.push({ path, local: localFile, remote: remoteFile != null ? remoteFile : null });
    else if (remoteFile) pull.push({ path, remote: remoteFile });
  }
  return { upload, pull, conflicts };
}
async function gitBlobSha(data) {
  const header = new TextEncoder().encode(`blob ${data.byteLength}\0`);
  const payload = new Uint8Array(header.byteLength + data.byteLength);
  payload.set(header, 0);
  payload.set(new Uint8Array(data), header.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", payload);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function parseRepository(value) {
  const match = value.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (!match) throw new Error("\u4ED3\u5E93\u683C\u5F0F\u5FC5\u987B\u662F owner/repository\u3002");
  return { owner: match[1], repository: match[2] };
}
function parseIgnorePatterns(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}
function matchesPattern(path, pattern) {
  const normalized = (0, import_obsidian4.normalizePath)(pattern.replace(/^\//, ""));
  if (normalized.endsWith("/")) {
    const directory = normalized.slice(0, -1);
    return normalized.includes("/") ? path === directory || path.startsWith(normalized) : path.split("/").includes(directory);
  }
  if (!normalized.includes("*") && !normalized.includes("?")) {
    return normalized.includes("/") ? path === normalized || path.startsWith(`${normalized}/`) : path.split("/").includes(normalized);
  }
  const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}
function sanitizeSegment(value) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "device";
}
function adapterPath(value) {
  return (0, import_obsidian4.normalizePath)(value.replace(/^\/+/, ""));
}
var RemoteChangedDuringSyncError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RemoteChangedDuringSyncError";
  }
};
function sleep(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}
function isRemoteChangedDuringSync(error) {
  return error instanceof RemoteChangedDuringSyncError || error instanceof Error && error.name === "RemoteChangedDuringSyncError";
}

// main.ts
var GITHUB_TOKEN_SECRET_ID = "obsidian-viewer-github-token";
var SYNCED_VIEWER_STATE_PATH = ".obsidian/plugins/obsidian-viewer/sync-state.json";
var LOCAL_SYNC_STATE_PATH = ".obsidian/plugins/obsidian-viewer/local-sync-state.json";
var DEFAULT_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  ".obsidian/plugins/obsidian-viewer/local-sync-state.json",
  ".obsidian/plugins/obsidian-viewer/*.conflict-*",
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/"
].join("\n");
var PLUGIN_SYNC_IGNORE_PATTERNS_WITHOUT_CONFLICTS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  ".obsidian/plugins/obsidian-viewer/local-sync-state.json",
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/"
].join("\n");
var DEVICE_LOCAL_PLUGIN_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/community-plugins*.json",
  ".obsidian/core-plugins*.json",
  ".obsidian/page-preview.json",
  ".obsidian/plugins/obsidian-viewer/data.json",
  ".obsidian/plugins/obsidian-git/data.json",
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/"
].join("\n");
var PREVIOUS_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/plugins/obsidian-viewer/data.json",
  "node_modules/"
].join("\n");
var LEGACY_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/plugins/obsidian-viewer/data.json",
  ".obsidian/plugins/obsidian-git/data.json",
  "node_modules/"
].join("\n");
var DEFAULT_SETTINGS = {
  homeNote: "",
  favorites: [],
  history: [],
  maxHistory: 100,
  openDashboardOnStartup: false,
  fontSize: 17,
  lineHeight: 1.7,
  contentWidth: 900,
  paragraphSpacing: 1,
  quizProgress: {},
  syncRepository: "kaleido1/Class-Notes",
  syncBranch: "main",
  syncDeviceNameAuto: true,
  syncDeviceName: defaultDeviceName(),
  syncIgnorePatterns: DEFAULT_SYNC_IGNORE_PATTERNS,
  syncMaxFileSizeMb: 50,
  syncOnStartup: false,
  syncOnSave: false,
  syncPeriodically: false,
  syncIntervalMinutes: 30,
  lastSyncedCommit: "",
  lastSyncAt: 0,
  lastSyncSummary: "\u5C1A\u672A\u540C\u6B65"
};
var ObsidianViewerPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.searchCache = /* @__PURE__ */ new Map();
    this.quizSaveTimer = null;
    this.syncOnSaveTimer = null;
    this.periodicSyncTimer = null;
    this.periodicSyncKey = "";
    this.syncStatus = { stage: "idle", message: "\u5C1A\u672A\u540C\u6B65" };
    this.githubSync = new GitHubSyncService(this, (status) => {
      this.syncStatus = status;
      void this.refreshDashboard();
    });
  }
  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_VIEWER, (leaf) => new ViewerDashboardView(leaf, this));
    this.addRibbonIcon("library", "\u6253\u5F00 Obsidian Viewer", () => void this.activateDashboard());
    this.addCommand({
      id: "open-dashboard",
      name: "\u6253\u5F00\u9605\u8BFB\u5DE5\u4F5C\u53F0",
      callback: () => void this.activateDashboard()
    });
    this.addCommand({
      id: "sync-github-now",
      name: "\u7ACB\u5373\u4E0E GitHub \u53CC\u5411\u540C\u6B65",
      callback: () => void this.syncNow()
    });
    this.addCommand({
      id: "open-home-note",
      name: "\u6253\u5F00\u9996\u9875\u7B14\u8BB0",
      callback: () => void this.openHomeNote()
    });
    this.addCommand({
      id: "toggle-current-favorite",
      name: "\u6536\u85CF\u6216\u53D6\u6D88\u6536\u85CF\u5F53\u524D\u7B14\u8BB0",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.toggleFavorite(file);
        return true;
      }
    });
    this.addCommand({
      id: "set-current-as-home",
      name: "\u5C06\u5F53\u524D\u7B14\u8BB0\u8BBE\u4E3A\u9996\u9875",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.setHomeNote(file);
        return true;
      }
    });
    this.addCommand({
      id: "toggle-focus-reading",
      name: "\u5207\u6362\u4E13\u6CE8\u9605\u8BFB\u6A21\u5F0F",
      callback: () => {
        document.body.classList.toggle("ov-focus-reading");
        new import_obsidian5.Notice(document.body.classList.contains("ov-focus-reading") ? "\u5DF2\u8FDB\u5165\u4E13\u6CE8\u9605\u8BFB\u6A21\u5F0F" : "\u5DF2\u9000\u51FA\u4E13\u6CE8\u9605\u8BFB\u6A21\u5F0F");
      }
    });
    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (file instanceof import_obsidian5.TFile && file.extension === "md") void this.recordOpen(file);
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian5.TFile) this.searchCache.delete(file.path);
      this.scheduleSyncOnSave();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      this.searchCache.delete(file.path);
      if (file instanceof import_obsidian5.TAbstractFile) void this.removeMissingPath(file.path);
      this.scheduleSyncOnSave();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.searchCache.delete(oldPath);
      if (file instanceof import_obsidian5.TAbstractFile) void this.renameTrackedPath(oldPath, file.path);
      this.scheduleSyncOnSave();
    }));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleSyncOnSave()));
    registerQuizProcessors(this);
    this.addSettingTab(new ObsidianViewerSettingTab(this.app, this));
    this.applyReaderSettings();
    this.configurePeriodicSync();
    this.app.workspace.onLayoutReady(() => {
      if (this.settings.openDashboardOnStartup) void this.activateDashboard();
      if (this.settings.syncOnStartup && this.getGitHubToken()) {
        const timer = window.setTimeout(() => void this.syncNow(false), 2e3);
        this.register(() => window.clearTimeout(timer));
      }
    });
  }
  onunload() {
    document.body.classList.remove("ov-reader-enabled", "ov-focus-reading");
    ["--ov-reader-font-size", "--ov-reader-line-height", "--ov-reader-width", "--ov-reader-paragraph-spacing"].forEach((name) => document.body.style.removeProperty(name));
    if (this.quizSaveTimer !== null) window.clearTimeout(this.quizSaveTimer);
    if (this.syncOnSaveTimer !== null) window.clearTimeout(this.syncOnSaveTimer);
    if (this.periodicSyncTimer !== null) window.clearInterval(this.periodicSyncTimer);
  }
  async loadSettings() {
    var _a, _b;
    const loaded = await this.loadData();
    const localSyncState = await this.loadLocalSyncState(loaded);
    const loadedDeviceName = (_b = (_a = loaded == null ? void 0 : loaded.syncDeviceName) == null ? void 0 : _a.trim()) != null ? _b : "";
    const syncDeviceNameAuto = typeof (loaded == null ? void 0 : loaded.syncDeviceNameAuto) === "boolean" ? loaded.syncDeviceNameAuto : !loadedDeviceName || AUTO_GENERATED_DEVICE_NAMES.has(loadedDeviceName);
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded != null ? loaded : {},
      syncDeviceNameAuto,
      syncDeviceName: syncDeviceNameAuto ? defaultDeviceName() : loadedDeviceName || defaultDeviceName(),
      favorites: Array.isArray(loaded == null ? void 0 : loaded.favorites) ? loaded.favorites : [],
      history: Array.isArray(loaded == null ? void 0 : loaded.history) ? loaded.history : [],
      quizProgress: (loaded == null ? void 0 : loaded.quizProgress) && typeof loaded.quizProgress === "object" ? loaded.quizProgress : {},
      lastSyncedCommit: localSyncState.lastSyncedCommit,
      lastSyncAt: localSyncState.lastSyncAt,
      lastSyncSummary: localSyncState.lastSyncSummary
    };
    let migrated = (loaded == null ? void 0 : loaded.syncDeviceNameAuto) !== syncDeviceNameAuto || (loaded == null ? void 0 : loaded.syncDeviceName) !== this.settings.syncDeviceName;
    if ([PLUGIN_SYNC_IGNORE_PATTERNS_WITHOUT_CONFLICTS, DEVICE_LOCAL_PLUGIN_IGNORE_PATTERNS, PREVIOUS_SYNC_IGNORE_PATTERNS, LEGACY_SYNC_IGNORE_PATTERNS].includes(this.settings.syncIgnorePatterns)) {
      this.settings.syncIgnorePatterns = DEFAULT_SYNC_IGNORE_PATTERNS;
      migrated = true;
    }
    if (await this.applySyncedViewerStateFromDisk()) migrated = true;
    if (migrated) await this.savePluginData();
    await this.saveLocalSyncState();
    await this.saveSyncedViewerState();
    this.syncStatus = { stage: "idle", message: this.settings.lastSyncSummary };
  }
  async saveSettings() {
    await this.savePluginData();
    await this.saveLocalSyncState();
    await this.saveSyncedViewerState();
    this.applyReaderSettings();
    this.configurePeriodicSync();
    await this.refreshDashboard();
  }
  getGitHubToken() {
    var _a, _b;
    return (_b = (_a = this.app.secretStorage.getSecret(GITHUB_TOKEN_SECRET_ID)) == null ? void 0 : _a.trim()) != null ? _b : "";
  }
  setGitHubToken(token) {
    this.app.secretStorage.setSecret(GITHUB_TOKEN_SECRET_ID, token.trim());
  }
  getCurrentDeviceName() {
    return defaultDeviceName();
  }
  async testGitHubConnection() {
    const result = await this.githubSync.testConnection();
    return `${result.repository} \xB7 ${result.branch} \xB7 ${result.commitSha.slice(0, 7)}`;
  }
  async syncNow(showNotice = true) {
    if (this.githubSync.isRunning) {
      if (showNotice) new import_obsidian5.Notice("\u540C\u6B65\u5DF2\u7ECF\u5728\u8FDB\u884C\u4E2D\u3002");
      return;
    }
    try {
      await this.saveSettings();
      const result = await this.githubSync.sync();
      this.settings.lastSyncedCommit = result.commitSha;
      this.settings.lastSyncAt = Date.now();
      this.settings.lastSyncSummary = result.changed ? `\u62C9\u53D6 ${result.pulled}\u3001\u4E0A\u4F20 ${result.pushed}\u3001\u5220\u9664 ${result.deleted}\u3001\u51B2\u7A81 ${result.conflicts}` : "\u672C\u5730\u4E0E\u8FDC\u7AEF\u5DF2\u7ECF\u4E00\u81F4";
      await this.saveLocalSyncState();
      await this.loadSettings();
      await this.applySyncedViewerStateFromDisk();
      await this.saveSettings();
      await this.refreshDashboard();
      if (showNotice) new import_obsidian5.Notice(`GitHub \u540C\u6B65\u5B8C\u6210\uFF1A${this.settings.lastSyncSummary}`);
    } catch (error) {
      if (showNotice) new import_obsidian5.Notice(error instanceof Error ? error.message : String(error), 8e3);
    }
  }
  applyReaderSettings() {
    document.body.classList.add("ov-reader-enabled");
    document.body.style.setProperty("--ov-reader-font-size", `${this.settings.fontSize}px`);
    document.body.style.setProperty("--ov-reader-line-height", String(this.settings.lineHeight));
    document.body.style.setProperty("--ov-reader-width", `${this.settings.contentWidth}px`);
    document.body.style.setProperty("--ov-reader-paragraph-spacing", `${this.settings.paragraphSpacing}em`);
  }
  async activateDashboard() {
    var _a;
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_VIEWER)[0];
    if (!leaf) {
      leaf = (_a = this.app.workspace.getLeftLeaf(false)) != null ? _a : this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE_VIEWER, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }
  async openHomeNote() {
    const path = this.settings.homeNote;
    const file = path ? this.app.vault.getAbstractFileByPath(path) : null;
    if (!(file instanceof import_obsidian5.TFile)) {
      new import_obsidian5.Notice("\u5C1A\u672A\u8BBE\u7F6E\u6709\u6548\u7684\u9996\u9875\u7B14\u8BB0\u3002\u53EF\u5728\u5F53\u524D\u7B14\u8BB0\u4E2D\u8FD0\u884C\u201C\u5C06\u5F53\u524D\u7B14\u8BB0\u8BBE\u4E3A\u9996\u9875\u201D\u3002");
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(file);
  }
  async openFile(file) {
    await this.app.workspace.getLeaf(false).openFile(file);
  }
  isFavorite(path) {
    return this.settings.favorites.includes(path);
  }
  async toggleFavorite(file) {
    const isFavorite = this.isFavorite(file.path);
    const name = file instanceof import_obsidian5.TFile ? file.basename : file.name || "\u6839\u76EE\u5F55";
    this.settings.favorites = isFavorite ? this.settings.favorites.filter((path) => path !== file.path) : [file.path, ...this.settings.favorites.filter((path) => path !== file.path)];
    await this.saveSettings();
    new import_obsidian5.Notice(isFavorite ? `\u5DF2\u53D6\u6D88\u6536\u85CF\uFF1A${name}` : `\u5DF2\u6536\u85CF\uFF1A${name}`);
  }
  async setHomeNote(file) {
    this.settings.homeNote = file.path;
    await this.saveSettings();
    new import_obsidian5.Notice(`\u9996\u9875\u5DF2\u8BBE\u4E3A\uFF1A${file.basename}`);
  }
  async recordOpen(file) {
    this.settings.history = [file.path, ...this.settings.history.filter((path) => path !== file.path)].slice(0, this.settings.maxHistory);
    await this.savePluginData();
    await this.saveSyncedViewerState();
    await this.refreshDashboard();
  }
  async clearHistory() {
    this.settings.history = [];
    await this.saveSettings();
  }
  getMarkdownFile(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof import_obsidian5.TFile && file.extension === "md" ? file : null;
  }
  getFileOrFolder(path) {
    const item = this.app.vault.getAbstractFileByPath(path);
    return item instanceof import_obsidian5.TFile || item instanceof import_obsidian5.TFolder ? item : null;
  }
  async searchFiles(query) {
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const files = this.app.vault.getMarkdownFiles();
    const results = [];
    await Promise.all(files.map(async (file) => {
      const path = file.path.toLocaleLowerCase();
      let content = this.searchCache.get(file.path);
      if (content === void 0) {
        try {
          content = (await this.app.vault.cachedRead(file)).toLocaleLowerCase();
        } catch (e) {
          content = "";
        }
        this.searchCache.set(file.path, content);
      }
      if (!terms.every((term) => path.includes(term) || content.includes(term))) return;
      const score = terms.reduce((total, term) => total + (path.includes(term) ? 10 : 1), 0);
      results.push({ file, score });
    }));
    return results.sort((a, b) => b.score - a.score || a.file.basename.localeCompare(b.file.basename) || a.file.path.localeCompare(b.file.path)).slice(0, 100).map(({ file }) => file);
  }
  getQuizProgress(key) {
    var _a;
    return (_a = this.settings.quizProgress[key]) != null ? _a : { answers: {}, page: 0, submitted: false };
  }
  setQuizProgress(key, progress) {
    this.settings.quizProgress[key] = progress;
    if (this.quizSaveTimer !== null) window.clearTimeout(this.quizSaveTimer);
    this.quizSaveTimer = window.setTimeout(() => {
      this.quizSaveTimer = null;
      void this.savePluginData();
    }, 250);
  }
  async refreshDashboard() {
    await Promise.all(this.app.workspace.getLeavesOfType(VIEW_TYPE_VIEWER).map((leaf) => {
      const view = leaf.view;
      return view instanceof ViewerDashboardView ? view.render() : Promise.resolve();
    }));
  }
  scheduleSyncOnSave() {
    if (!this.settings.syncOnSave || !this.getGitHubToken() || this.githubSync.isRunning) return;
    if (this.syncOnSaveTimer !== null) window.clearTimeout(this.syncOnSaveTimer);
    this.syncOnSaveTimer = window.setTimeout(() => {
      this.syncOnSaveTimer = null;
      if (!this.settings.syncOnSave || !this.getGitHubToken() || this.githubSync.isRunning) return;
      void this.syncNow(false);
    }, 3e4);
  }
  configurePeriodicSync() {
    const minutes = Math.max(5, this.settings.syncIntervalMinutes);
    const key = `${this.settings.syncPeriodically}:${minutes}`;
    if (key === this.periodicSyncKey) return;
    this.periodicSyncKey = key;
    if (this.periodicSyncTimer !== null) window.clearInterval(this.periodicSyncTimer);
    this.periodicSyncTimer = null;
    if (!this.settings.syncPeriodically) return;
    this.periodicSyncTimer = window.setInterval(() => {
      if (this.getGitHubToken() && !this.githubSync.isRunning) void this.syncNow(false);
    }, minutes * 6e4);
  }
  async removeMissingPath(path) {
    const keep = (entry) => entry !== path && !entry.startsWith(`${path}/`);
    this.settings.favorites = this.settings.favorites.filter(keep);
    this.settings.history = this.settings.history.filter(keep);
    if (this.settings.homeNote === path) this.settings.homeNote = "";
    await this.saveSettings();
  }
  async renameTrackedPath(oldPath, newPath) {
    const replace = (path) => {
      if (path === oldPath) return newPath;
      if (path.startsWith(`${oldPath}/`)) return `${newPath}${path.slice(oldPath.length)}`;
      return path;
    };
    this.settings.favorites = this.settings.favorites.map(replace);
    this.settings.history = this.settings.history.map(replace);
    if (this.settings.homeNote === oldPath) this.settings.homeNote = newPath;
    await this.saveSettings();
  }
  async loadSyncedViewerState() {
    const path = syncedViewerStatePath(this.app.vault.configDir);
    if (!await this.app.vault.adapter.exists(path)) return null;
    try {
      const parsed = JSON.parse(await this.app.vault.adapter.read(path));
      return {
        version: 1,
        favorites: normalizeTrackedPaths(parsed.favorites),
        history: normalizeTrackedPaths(parsed.history)
      };
    } catch (error) {
      new import_obsidian5.Notice(`Viewer \u5171\u4EAB\u6536\u85CF/\u5386\u53F2\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, 8e3);
      return null;
    }
  }
  async applySyncedViewerStateFromDisk() {
    const syncedState = await this.loadSyncedViewerState();
    if (!syncedState) return false;
    this.settings.favorites = syncedState.favorites;
    this.settings.history = syncedState.history.slice(0, this.settings.maxHistory);
    return true;
  }
  async saveSyncedViewerState() {
    const path = syncedViewerStatePath(this.app.vault.configDir);
    const state = {
      version: 1,
      favorites: normalizeTrackedPaths(this.settings.favorites),
      history: normalizeTrackedPaths(this.settings.history).slice(0, this.settings.maxHistory)
    };
    this.settings.favorites = state.favorites;
    this.settings.history = state.history;
    const content = `${JSON.stringify(state, null, 2)}
`;
    try {
      if (await this.app.vault.adapter.exists(path) && await this.app.vault.adapter.read(path) === content) return;
      await ensureAdapterParentFolders(this, path);
      await this.app.vault.adapter.write(path, content);
    } catch (error) {
      new import_obsidian5.Notice(`Viewer \u5171\u4EAB\u6536\u85CF/\u5386\u53F2\u6587\u4EF6\u4FDD\u5B58\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`, 8e3);
    }
  }
  async loadLocalSyncState(loaded) {
    const path = localSyncStatePath(this.app.vault.configDir);
    const fallback = {
      lastSyncedCommit: typeof (loaded == null ? void 0 : loaded.lastSyncedCommit) === "string" ? loaded.lastSyncedCommit : DEFAULT_SETTINGS.lastSyncedCommit,
      lastSyncAt: typeof (loaded == null ? void 0 : loaded.lastSyncAt) === "number" ? loaded.lastSyncAt : DEFAULT_SETTINGS.lastSyncAt,
      lastSyncSummary: typeof (loaded == null ? void 0 : loaded.lastSyncSummary) === "string" ? loaded.lastSyncSummary : DEFAULT_SETTINGS.lastSyncSummary
    };
    if (!await this.app.vault.adapter.exists(path)) return fallback;
    try {
      const parsed = JSON.parse(await this.app.vault.adapter.read(path));
      return {
        lastSyncedCommit: typeof parsed.lastSyncedCommit === "string" ? parsed.lastSyncedCommit : fallback.lastSyncedCommit,
        lastSyncAt: typeof parsed.lastSyncAt === "number" ? parsed.lastSyncAt : fallback.lastSyncAt,
        lastSyncSummary: typeof parsed.lastSyncSummary === "string" ? parsed.lastSyncSummary : fallback.lastSyncSummary
      };
    } catch (e) {
      return fallback;
    }
  }
  async saveLocalSyncState() {
    const path = localSyncStatePath(this.app.vault.configDir);
    const state = {
      lastSyncedCommit: this.settings.lastSyncedCommit,
      lastSyncAt: this.settings.lastSyncAt,
      lastSyncSummary: this.settings.lastSyncSummary
    };
    await ensureAdapterParentFolders(this, path);
    await this.app.vault.adapter.write(path, `${JSON.stringify(state, null, 2)}
`);
  }
  async savePluginData() {
    const syncedSettings = { ...this.settings };
    delete syncedSettings.favorites;
    delete syncedSettings.history;
    delete syncedSettings.lastSyncedCommit;
    delete syncedSettings.lastSyncAt;
    delete syncedSettings.lastSyncSummary;
    await this.saveData(syncedSettings);
  }
};
function syncedViewerStatePath(configDir) {
  return (0, import_obsidian5.normalizePath)(configDir ? `${configDir}/plugins/obsidian-viewer/sync-state.json` : SYNCED_VIEWER_STATE_PATH);
}
function localSyncStatePath(configDir) {
  return (0, import_obsidian5.normalizePath)(configDir ? `${configDir}/plugins/obsidian-viewer/local-sync-state.json` : LOCAL_SYNC_STATE_PATH);
}
function normalizeTrackedPaths(paths) {
  if (!Array.isArray(paths)) return [];
  const seen = /* @__PURE__ */ new Set();
  const output = [];
  for (const path of paths) {
    if (typeof path !== "string") continue;
    const normalized = (0, import_obsidian5.normalizePath)(path.trim());
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}
async function ensureAdapterParentFolders(plugin, path) {
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  if (!parent) return;
  let current = "";
  for (const segment of parent.split("/")) {
    current = current ? `${current}/${segment}` : segment;
    if (await plugin.app.vault.adapter.exists(current)) continue;
    try {
      await plugin.app.vault.createFolder(current);
    } catch (error) {
      if (!await plugin.app.vault.adapter.exists(current)) throw error;
    }
  }
}
function defaultDeviceName() {
  if (import_obsidian5.Platform.isIosApp) return "iOS";
  if (import_obsidian5.Platform.isAndroidApp) return "Android";
  if (import_obsidian5.Platform.isWin) return "Windows";
  if (import_obsidian5.Platform.isMacOS) return "macOS";
  if (import_obsidian5.Platform.isLinux) return "Linux";
  return "Obsidian";
}
var AUTO_GENERATED_DEVICE_NAMES = /* @__PURE__ */ new Set(["Android", "iOS", "Windows", "macOS", "Linux", "Obsidian"]);
