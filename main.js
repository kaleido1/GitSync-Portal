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
  default: () => GitSyncPortalPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/viewer-view.ts
var import_obsidian = require("obsidian");
var VIEW_TYPE_GITSYNC_PORTAL = "gitsync-portal-dashboard";
var LEGACY_VIEW_TYPE_GITSYNC_PORT = "gitsync-port-dashboard";
var LEGACY_VIEW_TYPE_VIEWER = "obsidian-viewer-dashboard";
var HISTORY_BATCH_SIZE = 40;
var GitSyncPortalDashboardView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.activeTab = "home";
    this.searchQuery = "";
    this.searchSequence = 0;
    this.searchTimer = null;
    this.syncUpdateFrame = null;
    this.isSearchComposing = false;
    this.currentFolderPath = "";
    this.folderBackStack = [];
    this.folderForwardStack = [];
    this.historyVisibleCount = HISTORY_BATCH_SIZE;
  }
  getViewType() {
    return VIEW_TYPE_GITSYNC_PORTAL;
  }
  getDisplayText() {
    return this.plugin.t("appName");
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
    if (this.syncUpdateFrame !== null) window.cancelAnimationFrame(this.syncUpdateFrame);
  }
  async render() {
    const root = this.contentEl;
    const searchFocus = this.captureSearchFocus(root);
    const scrollTop = root.scrollTop;
    root.empty();
    root.addClass("ov-dashboard");
    const header = root.createDiv({ cls: "ov-dashboard-header" });
    const brand = header.createDiv({ cls: "ov-dashboard-brand" });
    (0, import_obsidian.setIcon)(brand.createSpan({ cls: "ov-brand-icon" }), "cloud-cog");
    const titleBox = brand.createDiv();
    titleBox.createEl("h2", { text: this.plugin.t("appName") });
    titleBox.createEl("small", { text: this.plugin.t("notesCount", { count: this.app.vault.getMarkdownFiles().length }) });
    const refresh = header.createEl("button", { cls: "clickable-icon ov-icon-button", attr: { "aria-label": this.plugin.t("refresh") } });
    (0, import_obsidian.setIcon)(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.render());
    this.renderTabs(root);
    if (this.activeTab === "home") {
      this.renderActiveNote(root);
      await this.renderHome(root);
    }
    if (this.activeTab === "files") await this.renderFiles(root, searchFocus);
    if (this.activeTab === "favorites") this.renderTrackedItems(root, this.plugin.t("tabFavorites"), this.plugin.settings.favorites, this.plugin.t("noFavorites"), true);
    if (this.activeTab === "history") this.renderHistory(root);
    root.scrollTop = scrollTop;
  }
  renderTabs(root) {
    const tabs = root.createDiv({ cls: "ov-tabs", attr: { role: "tablist" } });
    const choices = [
      ["home", this.plugin.t("tabHome"), "home"],
      ["files", this.plugin.t("tabFiles"), "files"],
      ["favorites", this.plugin.t("tabFavorites"), "star"],
      ["history", this.plugin.t("tabHistory"), "history"]
    ];
    choices.forEach(([tab, label, icon]) => {
      const button = tabs.createEl("button", {
        cls: `ov-tab${this.activeTab === tab ? " is-active" : ""}`,
        attr: { role: "tab", "aria-selected": String(this.activeTab === tab) }
      });
      (0, import_obsidian.setIcon)(button.createSpan({ cls: "ov-tab-icon" }), icon);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        this.activeTab = tab;
        this.searchQuery = "";
        if (tab === "history") this.historyVisibleCount = HISTORY_BATCH_SIZE;
        void this.render();
      });
    });
  }
  renderActiveNote(root) {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") return;
    const card = root.createDiv({ cls: "ov-active-card" });
    (0, import_obsidian.setIcon)(card.createSpan({ cls: "ov-active-note-icon" }), "file-text");
    const labels = card.createDiv({ cls: "ov-active-note-labels" });
    labels.createEl("small", { text: this.plugin.t("currentNote") });
    labels.createEl("strong", { text: file.basename });
    const actions = card.createDiv({ cls: "ov-inline-actions" });
    this.iconButton(actions, "star", this.plugin.t(this.plugin.isFavorite(file.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(file), this.plugin.isFavorite(file.path));
    this.iconButton(actions, "house-plus", this.plugin.t("setAsHome"), () => void this.plugin.setHomeNote(file));
  }
  async renderHome(root) {
    var _a;
    const home = this.plugin.getMarkdownFile(this.plugin.settings.homeNote);
    const hero = root.createDiv({ cls: "ov-home-card" });
    hero.createEl("div", { text: this.plugin.t("homeNoteCard"), cls: "ov-eyebrow" });
    hero.createEl("h3", { text: (_a = home == null ? void 0 : home.basename) != null ? _a : this.plugin.t("notSet") });
    hero.createEl("p", {
      text: home ? home.path : this.plugin.t("homeNoteHint"),
      cls: "ov-muted"
    });
    const heroActions = hero.createDiv({ cls: "ov-inline-actions" });
    const openHome = heroActions.createEl("button", { text: this.plugin.t("openHome"), cls: "mod-cta" });
    openHome.disabled = !home;
    openHome.addEventListener("click", () => void this.plugin.openHomeNote());
    this.renderSyncCard(root);
    const favorites = this.plugin.settings.favorites.map((path) => this.plugin.getFileOrFolder(path)).filter((item) => item !== null).slice(0, 5);
    this.renderSection(root, this.plugin.t("tabFavorites"), favorites, this.plugin.t("noFavoriteNotes"), true);
    this.renderOutline(root);
    const recent = this.plugin.settings.history.map((path) => this.plugin.getMarkdownFile(path)).filter((file) => file !== null).slice(0, 8);
    this.renderSection(root, this.plugin.t("recentReading"), recent, this.plugin.t("recentReadingEmpty"), false);
  }
  renderSyncCard(root) {
    const status = this.plugin.syncStatus;
    const card = root.createDiv({ cls: `ov-sync-card is-${status.stage}` });
    const header = card.createDiv({ cls: "ov-sync-card-header" });
    const title = header.createDiv();
    title.createEl("strong", { text: this.plugin.t("githubSync") });
    title.createEl("small", { text: `${this.plugin.settings.syncRepository} \xB7 ${this.plugin.settings.syncBranch || this.plugin.t("defaultBranch")}` });
    const sync = header.createEl("button", { cls: "mod-cta ov-sync-primary" });
    (0, import_obsidian.setIcon)(sync.createSpan(), "refresh-cw");
    sync.createSpan({ text: this.plugin.t(this.plugin.githubSync.isRunning ? "syncing" : "syncNow") });
    sync.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    sync.addEventListener("click", () => void this.plugin.syncNow());
    card.createDiv({
      text: this.plugin.getGitHubToken() ? status.message : this.plugin.t("tokenMissing"),
      cls: "ov-sync-message"
    });
    const directionalActions = card.createDiv({ cls: "ov-sync-direction-actions" });
    const pull = directionalActions.createEl("button", {
      cls: "ov-tonal-button",
      attr: { title: this.plugin.t("pullOnlyHint"), "aria-label": this.plugin.t("pullOnlyLong") }
    });
    (0, import_obsidian.setIcon)(pull.createSpan(), "cloud-download");
    pull.createSpan({ text: this.plugin.t("pullOnly") });
    pull.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    pull.addEventListener("click", () => void this.plugin.syncNow(true, "pull-only"));
    const push = directionalActions.createEl("button", {
      cls: "ov-tonal-button",
      attr: { title: this.plugin.t("pushOnlyHint"), "aria-label": this.plugin.t("pushOnlyLong") }
    });
    (0, import_obsidian.setIcon)(push.createSpan(), "cloud-upload");
    push.createSpan({ text: this.plugin.t("pushOnly") });
    push.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    push.addEventListener("click", () => void this.plugin.syncNow(true, "push-only"));
    if (status.total && status.current !== void 0) {
      const progress = card.createEl("progress", { attr: { max: String(status.total), value: String(status.current) } });
      progress.value = status.current;
      progress.max = status.total;
    }
    if (this.plugin.settings.lastSyncAt) {
      card.createEl("small", {
        text: `${this.plugin.formatDateTime(this.plugin.settings.lastSyncAt)} \xB7 ${this.plugin.settings.lastSyncSummary || this.plugin.t("notSynced")}`,
        cls: "ov-muted"
      });
    }
  }
  updateSyncStatus() {
    if (this.syncUpdateFrame !== null) return;
    this.syncUpdateFrame = window.requestAnimationFrame(() => {
      this.syncUpdateFrame = null;
      this.applySyncStatus();
    });
  }
  applySyncStatus() {
    const current = this.contentEl.querySelector(".ov-sync-card");
    if (!current) return;
    const status = this.plugin.syncStatus;
    current.className = `ov-sync-card is-${status.stage}`;
    const message = current.querySelector(".ov-sync-message");
    if (message) message.textContent = this.plugin.getGitHubToken() ? status.message : this.plugin.t("tokenMissing");
    current.querySelectorAll("button").forEach((button) => {
      button.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    });
    const primaryLabel = current.querySelector(".ov-sync-primary span:last-child");
    if (primaryLabel) primaryLabel.textContent = this.plugin.t(this.plugin.githubSync.isRunning ? "syncing" : "syncNow");
    let progress = current.querySelector("progress");
    if (status.total && status.current !== void 0) {
      if (!progress) progress = current.createEl("progress");
      progress.value = status.current;
      progress.max = status.total;
    } else {
      progress == null ? void 0 : progress.remove();
    }
  }
  captureSearchFocus(root) {
    var _a, _b;
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLInputElement) || !root.contains(activeElement) || !activeElement.matches(".ov-search-box input")) {
      return null;
    }
    const length = activeElement.value.length;
    return {
      start: (_a = activeElement.selectionStart) != null ? _a : length,
      end: (_b = activeElement.selectionEnd) != null ? _b : length
    };
  }
  scheduleSearchRender(results) {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => {
      this.searchTimer = null;
      if (results.isConnected) void this.renderSearchResults(results);
    }, 250);
  }
  async renderFiles(root, searchFocus) {
    const searchBox = root.createDiv({ cls: "ov-search-box", attr: { tabindex: "0", role: "search" } });
    (0, import_obsidian.setIcon)(searchBox.createSpan(), "search");
    const input = searchBox.createEl("input", {
      type: "search",
      placeholder: this.plugin.t("searchPlaceholder"),
      value: this.searchQuery,
      attr: { "aria-label": this.plugin.t("searchPlaceholder") }
    });
    const results = root.createDiv({ cls: "ov-search-results" });
    searchBox.addEventListener("click", () => input.focus());
    searchBox.addEventListener("focus", () => input.focus());
    input.addEventListener("compositionstart", () => {
      this.isSearchComposing = true;
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    });
    input.addEventListener("compositionend", () => {
      this.isSearchComposing = false;
      this.searchQuery = input.value;
      this.scheduleSearchRender(results);
    });
    input.addEventListener("input", (event) => {
      if (event.isComposing || this.isSearchComposing) return;
      this.searchQuery = input.value;
      this.scheduleSearchRender(results);
    });
    if (searchFocus) {
      const length = input.value.length;
      input.focus();
      input.setSelectionRange(Math.min(searchFocus.start, length), Math.min(searchFocus.end, length));
    }
    await this.renderSearchResults(results);
  }
  async renderSearchResults(results) {
    const sequence = ++this.searchSequence;
    results.empty();
    if (this.searchQuery.trim()) {
      results.createDiv({ text: this.plugin.t("searching"), cls: "ov-search-status" });
      const files = await this.plugin.searchFiles(this.searchQuery);
      if (sequence !== this.searchSequence || !results.isConnected) return;
      results.empty();
      this.renderSection(results, this.plugin.t("searchResults", { count: files.length }), files, this.plugin.t("noMatches"), true);
    } else {
      this.renderDirectory(results);
    }
  }
  renderDirectory(root) {
    const folder = this.getCurrentFolder();
    const controls = root.createDiv({ cls: "ov-directory-controls" });
    this.iconButton(controls, "arrow-left", this.plugin.t("back"), () => this.navigateHistory(-1)).disabled = this.folderBackStack.length === 0;
    this.iconButton(controls, "arrow-right", this.plugin.t("forward"), () => this.navigateHistory(1)).disabled = this.folderForwardStack.length === 0;
    this.iconButton(controls, "arrow-up", this.plugin.t("parentFolder"), () => this.openParentFolder()).disabled = !this.currentFolderPath;
    const location = controls.createDiv({ cls: "ov-directory-location" });
    (0, import_obsidian.setIcon)(location.createSpan(), "folder-open");
    location.createSpan({ text: this.currentFolderPath || this.plugin.t("vaultRoot") });
    this.renderBreadcrumbs(root);
    const children = [...folder.children].sort(compareVaultItems);
    this.renderDirectoryList(root, children);
  }
  renderBreadcrumbs(root) {
    const crumbs = root.createDiv({ cls: "ov-breadcrumbs" });
    const rootButton = crumbs.createEl("button", { text: this.plugin.t("rootFolder") });
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
    root.createEl("h3", { text: this.plugin.t("folderTitle", { name: this.currentFolderPath || this.plugin.t("rootFolder"), count: children.length }), cls: "ov-section-title" });
    const list = root.createDiv({ cls: "ov-file-list" });
    if (!children.length) {
      list.createEl("p", { text: this.plugin.t("emptyFolder"), cls: "ov-empty" });
      return;
    }
    children.forEach((child) => {
      const row = list.createDiv({ cls: "ov-file-row" });
      const open = row.createEl("button", { cls: "ov-file-open" });
      if (child instanceof import_obsidian.TFolder) {
        (0, import_obsidian.setIcon)(open.createSpan({ cls: "ov-file-icon" }), "folder");
        const labels = open.createSpan({ cls: "ov-file-labels" });
        labels.createEl("strong", { text: child.name || this.plugin.t("rootFolder") });
        labels.createEl("small", { text: this.plugin.t("itemCount", { count: child.children.length }) });
        open.addEventListener("click", () => this.openFolder(child.path, true));
        this.iconButton(row, "star", this.plugin.t(this.plugin.isFavorite(child.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(child), this.plugin.isFavorite(child.path));
        return;
      }
      if (child instanceof import_obsidian.TFile) {
        this.markSelectedFile(row, child);
        (0, import_obsidian.setIcon)(open.createSpan({ cls: "ov-file-icon" }), child.extension === "md" ? "file-text" : "file");
        const labels = open.createSpan({ cls: "ov-file-labels" });
        labels.createEl("strong", { text: child.basename });
        labels.createEl("small", { text: this.fileMeta(child) });
        open.addEventListener("click", () => this.selectAndOpenFile(row, child));
        if (child.extension === "md") {
          this.iconButton(row, "star", this.plugin.t(this.plugin.isFavorite(child.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(child), this.plugin.isFavorite(child.path));
        }
      }
    });
  }
  renderHistory(root) {
    const total = this.plugin.settings.history.length;
    const heading = root.createDiv({ cls: "ov-section-heading" });
    heading.createEl("h3", { text: this.plugin.t("readingHistory", { count: total }) });
    const clear = heading.createEl("button", { text: this.plugin.t("clear"), cls: "ov-text-button is-danger" });
    clear.disabled = total === 0;
    clear.addEventListener("click", () => void this.plugin.clearHistory());
    const visiblePaths = this.plugin.settings.history.slice(0, this.historyVisibleCount);
    this.renderTrackedItems(root, "", visiblePaths, this.plugin.t("noHistory"), false, false);
    const remaining = Math.max(0, total - visiblePaths.length);
    if (remaining) {
      const more = root.createEl("button", {
        text: this.plugin.t("showMoreHistory", { count: Math.min(HISTORY_BATCH_SIZE, remaining) }),
        cls: "ov-load-more ov-tonal-button"
      });
      more.addEventListener("click", () => {
        this.historyVisibleCount += HISTORY_BATCH_SIZE;
        void this.render();
      });
    }
  }
  renderTrackedItems(root, title, paths, emptyText, showFavorite, showHeading = true) {
    const items = paths.map((path) => showFavorite ? this.plugin.getFileOrFolder(path) : this.plugin.getMarkdownFile(path)).filter((item) => item !== null);
    if (showHeading && title) root.createEl("h3", { text: this.plugin.t("folderTitle", { name: title, count: items.length }), cls: "ov-section-title" });
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
      if (file instanceof import_obsidian.TFile) this.markSelectedFile(row, file);
      const open = row.createEl("button", { cls: "ov-file-open" });
      (0, import_obsidian.setIcon)(open.createSpan({ cls: "ov-file-icon" }), file instanceof import_obsidian.TFolder ? "folder" : "file-text");
      const labels = open.createSpan({ cls: "ov-file-labels" });
      labels.createEl("strong", { text: file instanceof import_obsidian.TFolder ? file.name || this.plugin.t("rootFolder") : file.basename });
      labels.createEl("small", {
        text: file instanceof import_obsidian.TFolder ? `${this.plugin.t("itemCount", { count: file.children.length })} \xB7 ${this.parentLabel(file.path)}` : this.fileMeta(file)
      });
      open.addEventListener("click", () => {
        if (file instanceof import_obsidian.TFolder) {
          this.activeTab = "files";
          this.searchQuery = "";
          this.openFolder(file.path, true);
        } else {
          this.selectAndOpenFile(row, file);
        }
      });
      if (showFavorite) {
        this.iconButton(row, "star", this.plugin.t(this.plugin.isFavorite(file.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(file), this.plugin.isFavorite(file.path));
      }
    });
  }
  renderOutline(root) {
    var _a, _b;
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof import_obsidian.TFile)) return;
    const headings = (_b = (_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.headings) != null ? _b : [];
    root.createEl("h3", { text: this.plugin.t("pageOutline"), cls: "ov-section-title" });
    const outline = root.createDiv({ cls: "ov-outline" });
    if (!headings.length) {
      outline.createEl("p", { text: this.plugin.t("noHeadings"), cls: "ov-empty" });
      return;
    }
    headings.forEach(({ heading, level }) => {
      const button = outline.createEl("button", { text: heading, cls: "ov-outline-item" });
      button.style.paddingLeft = `${8 + (level - 1) * 12}px`;
      button.addEventListener("click", () => void this.app.workspace.openLinkText(`${file.path}#${heading}`, file.path, false));
    });
  }
  iconButton(root, icon, label, action, active = false) {
    const button = root.createEl("button", {
      cls: `clickable-icon ov-icon-button${active ? " is-active" : ""}`,
      attr: { "aria-label": label, title: label, ...active ? { "aria-pressed": "true" } : {} }
    });
    (0, import_obsidian.setIcon)(button, icon);
    button.addEventListener("click", action);
    return button;
  }
  fileMeta(file) {
    const parent = this.parentLabel(file.path);
    return `${parent} \xB7 ${file.extension.toLocaleUpperCase()}`;
  }
  parentLabel(path) {
    const slash = path.lastIndexOf("/");
    return slash > 0 ? path.slice(0, slash) : this.plugin.t("vaultRoot");
  }
  markSelectedFile(row, file) {
    var _a;
    if (((_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) !== file.path) return;
    row.addClass("is-selected");
    row.setAttribute("aria-current", "true");
  }
  selectAndOpenFile(row, file) {
    this.contentEl.querySelectorAll(".ov-file-row.is-selected").forEach((selected) => {
      selected.removeClass("is-selected");
      selected.removeAttribute("aria-current");
    });
    row.addClass("is-selected");
    row.setAttribute("aria-current", "true");
    void this.plugin.openFile(file);
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
var GitSyncPortalSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    const t = (key, values) => this.plugin.t(key, values);
    containerEl.empty();
    containerEl.createEl("h2", { text: t("appName") });
    new import_obsidian2.Setting(containerEl).setName(t("language")).setDesc(t("languageDescription")).addDropdown((dropdown) => {
      Object.entries(this.plugin.getLanguageOptions()).forEach(([value, label]) => dropdown.addOption(value, label));
      dropdown.setValue(this.plugin.settings.language).onChange(async (value) => {
        this.plugin.settings.language = value;
        await this.plugin.saveSettings();
        this.display();
      });
    });
    containerEl.createEl("p", { text: t("settingsIntro"), cls: "setting-item-description" });
    containerEl.createEl("h3", { text: t("syncSection") });
    containerEl.createEl("p", { text: t("syncDescription"), cls: "setting-item-description" });
    new import_obsidian2.Setting(containerEl).setName(t("githubToken")).setDesc(t("githubTokenDescription")).addText((text) => {
      text.inputEl.type = "password";
      text.setPlaceholder(this.plugin.getGitHubToken() ? t("tokenSavedPlaceholder") : "github_pat_\u2026");
      text.onChange((value) => {
        if (value.trim()) this.plugin.setGitHubToken(value);
      });
    }).addButton((button) => button.setButtonText(t("clearToken")).setWarning().onClick(() => {
      this.plugin.setGitHubToken("");
      this.display();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("repository")).setDesc(t("repositoryDescription")).addText((text) => text.setPlaceholder("owner/repository").setValue(this.plugin.settings.syncRepository).onChange(async (value) => {
      this.plugin.settings.syncRepository = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("branch")).setDesc(t("branchDescription")).addText((text) => text.setPlaceholder("main").setValue(this.plugin.settings.syncBranch).onChange(async (value) => {
      this.plugin.settings.syncBranch = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("autoDevice")).setDesc(t("autoDeviceDescription", { device: this.plugin.getCurrentDeviceName() })).addToggle((toggle) => toggle.setValue(this.plugin.settings.syncDeviceNameAuto).onChange(async (value) => {
      this.plugin.settings.syncDeviceNameAuto = value;
      if (value) this.plugin.settings.syncDeviceName = this.plugin.getCurrentDeviceName();
      await this.plugin.saveSettings();
      this.display();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("deviceName")).setDesc(t(this.plugin.settings.syncDeviceNameAuto ? "deviceNameAutoDescription" : "deviceNameManualDescription")).addText((text) => text.setDisabled(this.plugin.settings.syncDeviceNameAuto).setValue(this.plugin.settings.syncDeviceName).onChange(async (value) => {
      this.plugin.settings.syncDeviceName = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("testAndSync")).setDesc(this.syncDescription()).addButton((button) => button.setButtonText(t("testConnection")).onClick(async () => {
      button.setDisabled(true).setButtonText(t("testing"));
      try {
        new import_obsidian2.Notice(t("connectionSuccess", { details: await this.plugin.testGitHubConnection() }));
      } catch (error) {
        new import_obsidian2.Notice(error instanceof Error ? error.message : t("connectionFailed"), 8e3);
      } finally {
        button.setDisabled(false).setButtonText(t("testConnection"));
      }
    })).addButton((button) => button.setCta().setButtonText(t("syncNowLong")).onClick(async () => {
      button.setDisabled(true).setButtonText(t("syncing"));
      await this.plugin.syncNow();
      button.setDisabled(false).setButtonText(t("syncNowLong"));
      this.display();
    }));
    this.addToggle("syncOnStartup", "syncOnStartupDescription", this.plugin.settings.syncOnStartup, (value) => {
      this.plugin.settings.syncOnStartup = value;
    });
    this.addToggle("syncOnSave", "syncOnSaveDescription", this.plugin.settings.syncOnSave, (value) => {
      this.plugin.settings.syncOnSave = value;
    });
    this.addToggle("periodicSync", "periodicSyncDescription", this.plugin.settings.syncPeriodically, (value) => {
      this.plugin.settings.syncPeriodically = value;
    });
    this.addNumber("syncInterval", "syncIntervalDescription", this.plugin.settings.syncIntervalMinutes, 5, 10080, (value) => {
      this.plugin.settings.syncIntervalMinutes = value;
    });
    this.addNumber("maxFileSize", "maxFileSizeDescription", this.plugin.settings.syncMaxFileSizeMb, 1, 99, (value) => {
      this.plugin.settings.syncMaxFileSizeMb = value;
    });
    new import_obsidian2.Setting(containerEl).setName(t("ignoredPaths")).setDesc(t("ignoredPathsDescription")).addTextArea((text) => text.setPlaceholder(".DS_Store\n.obsidian/workspace*.json").setValue(this.plugin.settings.syncIgnorePatterns).onChange(async (value) => {
      this.plugin.settings.syncIgnorePatterns = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("p", { text: t("obsidianGitWarning"), cls: "ov-setting-warning" });
    new import_obsidian2.Setting(containerEl).setName(t("homeNote")).setDesc(t("homeNoteDescription")).addText((text) => text.setPlaceholder(t("homeNotePlaceholder")).setValue(this.plugin.settings.homeNote).onChange(async (value) => {
      this.plugin.settings.homeNote = value.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("useCurrentNote")).setDesc(t("useCurrentNoteDescription")).addButton((button) => button.setButtonText(t("setAsHome")).onClick(async () => {
      const file = this.app.workspace.getActiveFile();
      if (file instanceof import_obsidian2.TFile) await this.plugin.setHomeNote(file);
    }));
    this.addToggle("openDashboardOnStartup", "openDashboardOnStartupDescription", this.plugin.settings.openDashboardOnStartup, (value) => {
      this.plugin.settings.openDashboardOnStartup = value;
    });
    this.addNumber("historyLimit", "historyLimitDescription", this.plugin.settings.maxHistory, 10, 500, (value) => {
      this.plugin.settings.maxHistory = value;
      this.plugin.settings.history = this.plugin.settings.history.slice(0, value);
    });
    containerEl.createEl("h3", { text: t("readingDisplay") });
    this.addSlider("bodyFontSize", "14\u201324 px", 14, 24, 1, this.plugin.settings.fontSize, (value) => {
      this.plugin.settings.fontSize = value;
    });
    this.addSlider("bodyLineHeight", "1.2\u20132.2", 1.2, 2.2, 0.1, this.plugin.settings.lineHeight, (value) => {
      this.plugin.settings.lineHeight = value;
    });
    this.addSlider("contentMaxWidth", "600\u20131200 px", 600, 1200, 50, this.plugin.settings.contentWidth, (value) => {
      this.plugin.settings.contentWidth = value;
    });
    this.addSlider("paragraphSpacing", "0.5\u20132.0 em", 0.5, 2, 0.1, this.plugin.settings.paragraphSpacing, (value) => {
      this.plugin.settings.paragraphSpacing = value;
    });
    containerEl.createEl("h3", { text: t("dataManagement") });
    new import_obsidian2.Setting(containerEl).setName(t("clearHistory")).setDesc(t("clearHistoryDescription", { count: this.plugin.settings.history.length })).addButton((button) => button.setWarning().setButtonText(t("clear")).onClick(async () => {
      await this.plugin.clearHistory();
      this.display();
    }));
    new import_obsidian2.Setting(containerEl).setName(t("clearQuizProgress")).setDesc(t("clearQuizProgressDescription")).addButton((button) => button.setWarning().setButtonText(t("clear")).onClick(async () => {
      this.plugin.settings.quizProgress = {};
      await this.plugin.saveSettings();
      this.display();
    }));
  }
  addToggle(name, description, value, assign) {
    new import_obsidian2.Setting(this.containerEl).setName(this.plugin.t(name)).setDesc(this.plugin.t(description)).addToggle((toggle) => toggle.setValue(value).onChange(async (next) => {
      assign(next);
      await this.plugin.saveSettings();
    }));
  }
  addNumber(name, description, value, min, max, assign) {
    new import_obsidian2.Setting(this.containerEl).setName(this.plugin.t(name)).setDesc(this.plugin.t(description)).addText((text) => text.setValue(String(value)).onChange(async (raw) => {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) return;
      assign(Math.min(max, Math.max(min, parsed)));
      await this.plugin.saveSettings();
    }));
  }
  addSlider(name, description, min, max, step, value, assign) {
    new import_obsidian2.Setting(this.containerEl).setName(this.plugin.t(name)).setDesc(description).addSlider((slider) => slider.setLimits(min, max, step).setValue(value).setDynamicTooltip().onChange(async (next) => {
      assign(next);
      await this.plugin.saveSettings();
    }));
  }
  syncDescription() {
    return this.plugin.t("lastSync", {
      date: this.plugin.settings.lastSyncAt ? this.plugin.formatDateTime(this.plugin.settings.lastSyncAt) : this.plugin.t("never"),
      summary: this.plugin.settings.lastSyncSummary || this.plugin.t("notSynced")
    });
  }
};

// src/quiz.ts
var import_obsidian3 = require("obsidian");
function registerQuizProcessors(plugin) {
  plugin.registerMarkdownCodeBlockProcessor("quiz", (source, el) => {
    el.addClass("ov-quiz-definition");
    try {
      const definition = unwrapQuiz((0, import_obsidian3.parseYaml)(source));
      el.setText((definition == null ? void 0 : definition.id) ? plugin.t("quizDefinitionWithId", { id: definition.id }) : plugin.t("quizDefinition"));
    } catch (e) {
      el.setText(plugin.t("quizDefinitionInvalid"));
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
      validateQuiz(quiz, (key, values) => this.plugin.t(key, values));
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
    throw new Error(id ? this.plugin.t("quizNotFound", { id }) : this.plugin.t("quizSourceRequired"));
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
    var _a;
    const key = `${this.context.sourcePath}:${quiz.id}`;
    const stored = this.plugin.getQuizProgress(key);
    const legacySubmitted = Boolean(stored.submitted) && !Array.isArray(stored.submittedQuestions);
    const state = {
      answers: { ...stored.answers },
      page: Number.isFinite(stored.page) ? stored.page : 0,
      submitted: Boolean(stored.submitted),
      submittedQuestions: legacySubmitted ? quiz.questions.map((question) => question.id) : [...(_a = stored.submittedQuestions) != null ? _a : []]
    };
    const questions = quiz.questions;
    state.page = Math.max(0, Math.min(state.page, questions.length - 1));
    const save = () => {
      if (quiz.persistAnswers !== false) this.plugin.setQuizProgress(key, state);
    };
    const draw = () => {
      var _a2;
      this.containerEl.empty();
      const card = this.containerEl.createDiv({ cls: "ov-quiz-card" });
      card.createEl("h3", { text: quiz.title || quiz.id });
      if (quiz.description) card.createDiv({ text: quiz.description, cls: "ov-quiz-description" });
      const submittedQuestions = new Set((_a2 = state.submittedQuestions) != null ? _a2 : []);
      const completed = questions.every((question) => submittedQuestions.has(question.id));
      state.submitted = completed;
      if (completed) this.renderTotal(card, quiz, state);
      const oneAtATime = quiz.mode !== "all-at-once";
      const visibleQuestions = oneAtATime ? [questions[state.page]] : questions;
      visibleQuestions.forEach((question) => this.renderQuestion(card, question, state, save, draw));
      if (oneAtATime) {
        const navigation = card.createDiv({ cls: "ov-quiz-nav" });
        const previous = navigation.createEl("button", { text: this.plugin.t("previousQuestion") });
        previous.disabled = state.page === 0;
        previous.addEventListener("click", () => {
          state.page = Math.max(0, state.page - 1);
          save();
          draw();
        });
        navigation.createSpan({
          text: this.plugin.t("quizProgress", {
            current: state.page + 1,
            total: questions.length,
            submitted: submittedQuestions.size
          })
        });
        const next = navigation.createEl("button", { text: this.plugin.t("nextQuestion") });
        next.disabled = state.page >= questions.length - 1 || !submittedQuestions.has(questions[state.page].id);
        next.addEventListener("click", () => {
          state.page = Math.min(questions.length - 1, state.page + 1);
          save();
          draw();
        });
      }
      const actions = card.createDiv({ cls: "ov-quiz-actions" });
      const retry = actions.createEl("button", { text: this.plugin.t("retryQuiz") });
      retry.addEventListener("click", () => {
        state.answers = {};
        state.submitted = false;
        state.submittedQuestions = [];
        state.page = 0;
        this.plugin.setQuizProgress(key, state);
        draw();
      });
    };
    draw();
  }
  renderQuestion(card, question, state, save, draw) {
    var _a, _b, _c, _d, _e;
    const section = card.createEl("section", { cls: "ov-quiz-question" });
    section.createEl("strong", { text: question.prompt });
    const answer = state.answers[question.id];
    const submittedQuestions = new Set((_a = state.submittedQuestions) != null ? _a : []);
    const disabled = submittedQuestions.has(question.id);
    if (question.type === "multiple-choice" || question.type === "true-false") {
      const options = question.type === "true-false" ? [{ id: "true", text: "True" }, { id: "false", text: "False" }] : (_b = question.options) != null ? _b : [];
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
      ((_c = question.options) != null ? _c : []).forEach((option) => {
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
      ((_d = question.prompts) != null ? _d : []).forEach((prompt) => {
        var _a2, _b2;
        const label = section.createEl("label", { cls: "ov-quiz-match" });
        label.createSpan({ text: prompt.text });
        const select = label.createEl("select");
        select.createEl("option", { text: "\u2014", value: "" });
        ((_a2 = question.choices) != null ? _a2 : []).forEach((choice) => select.createEl("option", { text: choice.text, value: choice.id }));
        select.value = (_b2 = matches[prompt.id]) != null ? _b2 : "";
        select.disabled = disabled;
        select.addEventListener("change", () => {
          const currentAnswer = state.answers[question.id];
          const currentMatches = isStringRecord(currentAnswer) ? currentAnswer : {};
          state.answers[question.id] = { ...currentMatches, [prompt.id]: select.value };
          save();
        });
      });
    } else if (question.type === "reorder") {
      const items = (_e = question.items) != null ? _e : [];
      const order = asStringArray(answer).length ? asStringArray(answer) : items.map((item) => item.id);
      const byId = new Map(items.map((item) => [item.id, item]));
      const orderBox = section.createDiv({ cls: "ov-quiz-order" });
      order.forEach((id, index) => {
        var _a2, _b2;
        const row = orderBox.createDiv({ cls: "ov-quiz-order-row" });
        row.createSpan({ text: `${index + 1}. ${(_b2 = (_a2 = byId.get(id)) == null ? void 0 : _a2.text) != null ? _b2 : id}` });
        const up = row.createEl("button", { text: "\u25B2", attr: { "aria-label": this.plugin.t("moveUp") } });
        up.disabled = disabled || index === 0;
        up.addEventListener("click", () => {
          [order[index - 1], order[index]] = [order[index], order[index - 1]];
          state.answers[question.id] = order;
          save();
          draw();
        });
        const down = row.createEl("button", { text: "\u25BC", attr: { "aria-label": this.plugin.t("moveDown") } });
        down.disabled = disabled || index === order.length - 1;
        down.addEventListener("click", () => {
          [order[index], order[index + 1]] = [order[index + 1], order[index]];
          state.answers[question.id] = order;
          save();
          draw();
        });
      });
    }
    if (!disabled) {
      const actions = section.createDiv({ cls: "ov-quiz-question-actions" });
      const submit = actions.createEl("button", { text: this.plugin.t("submitQuestion"), cls: "mod-cta" });
      submit.addEventListener("click", () => {
        submittedQuestions.add(question.id);
        state.submittedQuestions = [...submittedQuestions];
        state.submitted = false;
        save();
        draw();
      });
    } else {
      const result = scoreQuestion(question, state.answers[question.id]);
      const feedback = section.createDiv({
        cls: `ov-quiz-feedback ${result.ratio === 1 ? "is-correct" : "is-wrong"}`
      });
      feedback.createSpan({ text: this.plugin.t(result.ratio === 1 ? "correct" : "notFullyCorrect") });
      feedback.createDiv({
        text: this.plugin.t("correctAnswer", { answer: formatCorrectAnswer(question) }),
        cls: "ov-quiz-correct-answer"
      });
      if (question.explanation) feedback.createDiv({ text: question.explanation, cls: "ov-quiz-explanation" });
      const actions = section.createDiv({ cls: "ov-quiz-question-actions" });
      const retry = actions.createEl("button", { text: this.plugin.t("retryQuestion") });
      retry.addEventListener("click", () => {
        delete state.answers[question.id];
        submittedQuestions.delete(question.id);
        state.submittedQuestions = [...submittedQuestions];
        state.submitted = false;
        save();
        draw();
      });
    }
  }
  renderTotal(card, quiz, state) {
    const scores = quiz.questions.map((question) => scoreQuestion(question, state.answers[question.id]));
    const score = scores.reduce((sum, item) => sum + item.points, 0);
    const total = scores.reduce((sum, item) => sum + item.total, 0);
    const percent = total ? Math.round(score / total * 100) : 0;
    const result = card.createDiv({ cls: "ov-quiz-result" });
    let suffix = "";
    if (quiz.passingScore !== void 0) suffix = ` \xB7 ${this.plugin.t(percent >= quiz.passingScore ? "passed" : "failed")}`;
    result.setText(this.plugin.t("score", { score: score.toFixed(1), total, percent, suffix }));
  }
};
function formatCorrectAnswer(question) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const optionText = (id) => {
    var _a2, _b2, _c2;
    return (_c2 = (_b2 = (_a2 = question.options) == null ? void 0 : _a2.find((option) => option.id === id)) == null ? void 0 : _b2.text) != null ? _c2 : id;
  };
  if (question.type === "multiple-choice") return optionText(String((_a = question.correctAnswer) != null ? _a : ""));
  if (question.type === "true-false") return String(question.correctAnswer) === "true" ? "True" : "False";
  if (question.type === "multiple-select") return ((_b = question.correctAnswers) != null ? _b : []).map(optionText).join("\uFF1B");
  if (question.type === "short-text") return ((_c = question.acceptedAnswers) != null ? _c : []).join(" / ");
  if (question.type === "numeric") {
    const tolerance = Number((_d = question.tolerance) != null ? _d : 0);
    return `${String((_e = question.correctAnswer) != null ? _e : "")}${tolerance > 0 ? ` \xB1 ${tolerance}` : ""}`;
  }
  if (question.type === "matching") {
    const prompts = new Map(((_f = question.prompts) != null ? _f : []).map((prompt) => [prompt.id, prompt.text]));
    const choices = new Map(((_g = question.choices) != null ? _g : []).map((choice) => [choice.id, choice.text]));
    return Object.entries((_h = question.correctMatches) != null ? _h : {}).map(([prompt, choice]) => {
      var _a2, _b2;
      return `${(_a2 = prompts.get(prompt)) != null ? _a2 : prompt} \u2192 ${(_b2 = choices.get(choice)) != null ? _b2 : choice}`;
    }).join("\uFF1B");
  }
  if (question.type === "reorder") {
    const items = new Map(((_i = question.items) != null ? _i : []).map((item) => [item.id, item.text]));
    return ((_j = question.correctOrder) != null ? _j : []).map((id) => {
      var _a2;
      return (_a2 = items.get(id)) != null ? _a2 : id;
    }).join(" \u2192 ");
  }
  return "";
}
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
function validateQuiz(quiz, t) {
  if (!quiz || typeof quiz !== "object") throw new Error(t("quizMustBeObject"));
  if (!quiz.id || typeof quiz.id !== "string") throw new Error(t("quizNeedsId"));
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) throw new Error(t("quizNeedsQuestions"));
  const ids = /* @__PURE__ */ new Set();
  quiz.questions.forEach((question, index) => {
    if (!(question == null ? void 0 : question.id) || !question.type || !question.prompt) throw new Error(t("quizQuestionMissing", { index: index + 1 }));
    if (ids.has(question.id)) throw new Error(t("quizDuplicateId", { id: question.id }));
    ids.add(question.id);
    if (!["multiple-choice", "true-false", "multiple-select", "short-text", "numeric", "matching", "reorder"].includes(question.type)) {
      throw new Error(t("quizUnsupportedType", { type: String(question.type) }));
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
var GENERATED_CONFLICT_COPY = /(?:^|\/)[^/]+\.conflict-[a-z0-9_-]+-\d{8}T\d{6}Z(?:-\d+)?(?:\.[^/]+)?$/i;
var LEGACY_PLUGIN_IDS = /* @__PURE__ */ new Set(["gitsync-port", "obsidian-viewer"]);
var MAX_SYNC_ATTEMPTS = 5;
var MAX_REF_UPDATE_ATTEMPTS = 8;
var MASS_DELETION_MINIMUM = 20;
var MASS_DELETION_RATIO = 0.25;
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
  async sync(mode = "two-way") {
    if (this.running) throw new Error(this.plugin.t("syncAlreadyRunning"));
    this.running = true;
    try {
      const token = this.requireToken();
      this.update("connecting", this.plugin.t("statusConnecting"));
      const repository = await this.getRepository(token);
      const branch = this.plugin.settings.syncBranch.trim() || repository.default_branch;
      let latestRemoteChange = null;
      for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
        try {
          if (attempt > 1) {
            await sleep(600 * attempt);
            this.update("connecting", this.plugin.t("statusRemoteRetry", { attempt }));
          }
          return await this.syncAttempt(token, branch, mode);
        } catch (error) {
          if (isRemoteChangedDuringSync(error) && attempt < MAX_SYNC_ATTEMPTS) {
            latestRemoteChange = error;
            continue;
          }
          throw error;
        }
      }
      throw latestRemoteChange != null ? latestRemoteChange : new Error(this.plugin.t("syncRetryFailed"));
    } catch (error) {
      this.update("error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.running = false;
    }
  }
  async syncAttempt(token, branch, mode = "two-way") {
    var _a, _b, _c;
    const remote = await this.getHead(token, branch);
    const base = this.plugin.settings.lastSyncedCommit ? await this.tryGetSnapshot(token, this.plugin.settings.lastSyncedCommit) : null;
    this.update("scanning", this.plugin.t("statusHashing"));
    const local = await this.getLocalSnapshot();
    if (base) {
      if (mode !== "pull-only") this.assertNoMassDeletion("local", base.files, local);
      if (mode !== "push-only") this.assertNoMassDeletion("remote", base.files, remote.files);
    }
    if (mode === "pull-only") return this.pullOnly(token, branch, remote, (_a = base == null ? void 0 : base.files) != null ? _a : null, local);
    if (mode === "push-only") return this.pushOnly(token, branch, remote, (_b = base == null ? void 0 : base.files) != null ? _b : null, local);
    const plan = createReconcilePlan(local, remote.files, (_c = base == null ? void 0 : base.files) != null ? _c : null);
    this.update("reconciling", this.plugin.t("statusReconciling"));
    let pulled = 0;
    let deleted = 0;
    let conflicts = 0;
    const upload = new Map(plan.upload);
    const protectedConflicts = /* @__PURE__ */ new Set();
    const localWins = /* @__PURE__ */ new Set();
    const conflictDecisions = await mapWithConcurrency(plan.conflicts, 6, async (conflict) => ({
      conflict,
      remoteModifiedAt: await this.getRemoteModifiedAt(token, branch, conflict.path)
    }));
    for (const { conflict, remoteModifiedAt } of conflictDecisions) {
      if (!conflict.remote && this.isSelfCoreFile(conflict.path)) {
        upload.set(conflict.path, conflict.local);
        protectedConflicts.add(conflict.path);
        continue;
      }
      if (conflict.local.mtime >= remoteModifiedAt) {
        upload.set(conflict.path, conflict.local);
        localWins.add(conflict.path);
        if (conflict.remote) {
          await this.createRemoteConflictCopy(token, conflict.remote);
        }
      } else {
        await this.createConflictCopy(conflict.local);
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
      this.update("pulling", this.plugin.t("statusPulling", { path: operation.path }), index + 1, pullOperations.length);
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
        this.update("pushing", this.plugin.t("statusPushing", { path }), index, upload.size);
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
      mode,
      branch,
      commitSha,
      pulled,
      pushed,
      deleted,
      conflicts,
      changed: pulled + pushed + deleted + conflicts > 0
    };
    this.update("complete", this.plugin.t(result.changed ? "statusComplete" : "alreadyInSync"));
    return result;
  }
  async pullOnly(token, branch, remote, base, local) {
    const plan = createPullOnlyPlan(local, remote.files, base);
    this.update("reconciling", this.plugin.t("statusReconcilingPull"));
    const protectedPaths = /* @__PURE__ */ new Set();
    for (const conflict of plan.conflicts) {
      if (!conflict.remote && this.isSelfCoreFile(conflict.path)) {
        protectedPaths.add(conflict.path);
        continue;
      }
      await this.createConflictCopy(conflict.local);
    }
    const operations = [
      ...plan.conflicts.filter(({ path }) => !protectedPaths.has(path)).map(({ path, remote: remoteFile }) => ({ path, remote: remoteFile })),
      ...plan.pull.filter(({ path, remote: remoteFile }) => remoteFile || !this.isSelfCoreFile(path))
    ];
    let pulled = 0;
    let deleted = 0;
    for (let index = 0; index < operations.length; index++) {
      const operation = operations[index];
      this.update("pulling", this.plugin.t("statusPulling", { path: operation.path }), index + 1, operations.length);
      if (operation.remote) {
        await this.writeRemoteFile(token, operation.remote);
        pulled++;
      } else if (await this.deleteLocalPath(operation.path)) {
        deleted++;
      }
    }
    await this.ensureSelfEnabled();
    const conflicts = plan.conflicts.length - protectedPaths.size;
    const result = {
      mode: "pull-only",
      branch,
      commitSha: remote.commitSha,
      pulled,
      pushed: 0,
      deleted,
      conflicts,
      changed: pulled + deleted + conflicts > 0
    };
    this.update("complete", this.plugin.t(result.changed ? "statusCompletePull" : "alreadyInSync"));
    return result;
  }
  async pushOnly(token, branch, remote, base, local) {
    const plan = createPushOnlyPlan(local, remote.files, base);
    this.update("reconciling", this.plugin.t("statusReconcilingPush"));
    const upload = new Map(plan.upload);
    for (const conflict of plan.conflicts) {
      if (!conflict.local && this.isSelfCoreFile(conflict.path)) continue;
      upload.set(conflict.path, conflict.local);
      if (conflict.remote) {
        await this.createRemoteConflictCopy(token, conflict.remote);
      }
    }
    const enabledList = await this.ensureSelfEnabled();
    if (enabledList) upload.set(enabledList.path, enabledList);
    const entries = [];
    let pushed = 0;
    let deleted = 0;
    let index = 0;
    for (const [path, localFile] of upload) {
      index++;
      this.update("pushing", this.plugin.t("statusPushing", { path }), index, upload.size);
      if (!localFile) {
        entries.push({ path, mode: "100644", type: "blob", sha: null });
        deleted++;
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
    const commitSha = entries.length ? await this.pushEntriesWithRemoteRetry(token, branch, remote, entries) : remote.commitSha;
    const conflicts = plan.conflicts.length;
    const result = {
      mode: "push-only",
      branch,
      commitSha,
      pulled: 0,
      pushed,
      deleted,
      conflicts,
      changed: pushed + deleted + conflicts > 0
    };
    this.update("complete", this.plugin.t(result.changed ? "statusCompletePush" : "alreadyInSync"));
    return result;
  }
  async deleteLocalPath(path) {
    const existing = this.plugin.app.vault.getFileByPath(path);
    if (existing) {
      await this.plugin.app.vault.trash(existing, false);
      return true;
    }
    if (await this.plugin.app.vault.adapter.exists(path)) {
      await this.plugin.app.vault.adapter.trashLocal(path);
      return true;
    }
    return false;
  }
  async pushEntriesWithRemoteRetry(token, branch, plannedRemote, entries) {
    let remote = plannedRemote;
    let latestRemoteChange = null;
    for (let attempt = 1; attempt <= MAX_REF_UPDATE_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await sleep(Math.min(5e3, 350 * attempt));
        this.update("pushing", this.plugin.t("statusCommitRetry", { attempt }));
        remote = await this.getHead(token, branch);
        if (this.entriesTouchChangedRemotePaths(entries, plannedRemote, remote)) {
          throw new RemoteChangedDuringSyncError(this.plugin.t("remoteSamePathChanged"));
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
    throw latestRemoteChange != null ? latestRemoteChange : new Error(this.plugin.t("remoteContinuouslyChanged"));
  }
  entriesTouchChangedRemotePaths(entries, plannedRemote, latestRemote) {
    return entries.some((entry) => {
      var _a, _b;
      return ((_a = plannedRemote.files.get(entry.path)) == null ? void 0 : _a.sha) !== ((_b = latestRemote.files.get(entry.path)) == null ? void 0 : _b.sha);
    });
  }
  requireToken() {
    const token = this.plugin.getGitHubToken();
    if (!token) throw new Error(this.plugin.t("tokenRequired"));
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
    if (tree.truncated) throw new Error(this.plugin.t("remoteTreeTooLarge"));
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
      this.update("scanning", this.plugin.t("statusScanning", { path }), index + 1, files.length);
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
    if (blob.encoding !== "base64") throw new Error(this.plugin.t("unsupportedEncoding", { path: remote.path }));
    const data = (0, import_obsidian4.base64ToArrayBuffer)(blob.content.replace(/\s/g, ""));
    this.ensureFileSize(remote.path, data.byteLength);
    await this.ensureParentFolders(remote.path);
    try {
      const existing = this.plugin.app.vault.getAbstractFileByPath(remote.path);
      if (existing instanceof import_obsidian4.TFile) {
        await this.plugin.app.vault.modifyBinary(existing, data);
      } else if (existing) {
        throw new Error(this.plugin.t("remoteFileFolderConflict", { path: remote.path }));
      } else if (await this.plugin.app.vault.adapter.exists(remote.path)) {
        await this.plugin.app.vault.adapter.writeBinary(remote.path, data);
      } else {
        await this.plugin.app.vault.createBinary(remote.path, data);
      }
    } catch (error) {
      throw new Error(this.plugin.t("remoteWriteFailed", { path: remote.path, error: error instanceof Error ? error.message : String(error) }));
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
    if (blob.encoding !== "base64") throw new Error(this.plugin.t("unsupportedEncoding", { path: remote.path }));
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
  async availableConflictPath(path, occupiedPaths) {
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
    while ((occupiedPaths == null ? void 0 : occupiedPaths.has(candidate)) || await this.plugin.app.vault.adapter.exists(candidate)) {
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
      if (existing instanceof import_obsidian4.TFile) throw new Error(this.plugin.t("folderFileConflict", { path: current }));
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
      throw new Error(this.plugin.t("enabledListReadFailed", { path, error: error instanceof Error ? error.message : String(error) }));
    }
    if (!Array.isArray(enabled) || !enabled.every((id) => typeof id === "string")) {
      throw new Error(this.plugin.t("enabledListInvalid", { path }));
    }
    const updated = enabled.filter((id) => !LEGACY_PLUGIN_IDS.has(id));
    if (!updated.includes(this.plugin.manifest.id)) updated.push(this.plugin.manifest.id);
    if (updated.length === enabled.length && updated.every((id, index) => id === enabled[index])) return null;
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
    const localSyncState = (0, import_obsidian4.normalizePath)(`${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/local-sync-state.json`);
    if (normalized === localSyncState) return true;
    if (GENERATED_CONFLICT_COPY.test(normalized)) return true;
    return parseIgnorePatterns(this.plugin.settings.syncIgnorePatterns).some((pattern) => matchesPattern(normalized, pattern));
  }
  ensureFileSize(path, bytes) {
    const maximum = Math.max(1, this.plugin.settings.syncMaxFileSizeMb) * 1024 * 1024;
    if (bytes > maximum) {
      throw new Error(this.plugin.t("fileTooLarge", { limit: this.plugin.settings.syncMaxFileSizeMb, path }));
    }
  }
  assertNoMassDeletion(side, base, current) {
    const detected = detectMassDeletion(base, current);
    if (!detected) return;
    throw new Error(this.plugin.t("massDeletionBlocked", {
      side: this.plugin.t(side === "local" ? "localSide" : "remoteSide"),
      missing: detected.missing,
      total: detected.total
    }));
  }
  commitMessage() {
    const device = this.plugin.settings.syncDeviceName.trim() || "Obsidian";
    return `Vault sync from ${device} at ${(/* @__PURE__ */ new Date()).toISOString()}`;
  }
  async api(token, method, endpoint, body) {
    const { owner, repository } = parseRepository(this.plugin.settings.syncRepository, this.plugin.t("repositoryFormat"));
    const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${endpoint}`;
    const response = await (0, import_obsidian4.requestUrl)({
      url,
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "gitsync-portal"
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
    if (response.status === 401) throw new Error(this.plugin.t("tokenInvalid"));
    if (response.status === 403) throw new Error(this.plugin.t("tokenForbidden"));
    if (response.status === 404) throw new Error(this.plugin.t("repositoryNotFound"));
    if (response.status === 409 || response.status === 422) throw new RemoteChangedDuringSyncError(this.plugin.t("remoteChanged", { detail }));
    throw new Error(this.plugin.t("apiFailed", { status: response.status, detail }));
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
function createPullOnlyPlan(local, remote, base) {
  var _a;
  const pull = [];
  const conflicts = [];
  const paths = /* @__PURE__ */ new Set([...remote.keys(), ...(_a = base == null ? void 0 : base.keys()) != null ? _a : []]);
  for (const path of [...paths].sort()) {
    const localFile = local.get(path);
    const remoteFile = remote.get(path);
    const baseFile = base == null ? void 0 : base.get(path);
    if (remoteFile && !localFile) {
      pull.push({ path, remote: remoteFile });
      continue;
    }
    const remoteChanged = base ? (remoteFile == null ? void 0 : remoteFile.sha) !== (baseFile == null ? void 0 : baseFile.sha) : Boolean(remoteFile);
    if (!remoteChanged || (localFile == null ? void 0 : localFile.sha) === (remoteFile == null ? void 0 : remoteFile.sha)) continue;
    const localChanged = base ? (localFile == null ? void 0 : localFile.sha) !== (baseFile == null ? void 0 : baseFile.sha) : Boolean(localFile);
    if (localChanged && localFile) conflicts.push({ path, local: localFile, remote: remoteFile != null ? remoteFile : null });
    else pull.push({ path, remote: remoteFile != null ? remoteFile : null });
  }
  return { pull, conflicts };
}
function createPushOnlyPlan(local, remote, base) {
  var _a;
  const upload = /* @__PURE__ */ new Map();
  const conflicts = [];
  const paths = /* @__PURE__ */ new Set([...local.keys(), ...(_a = base == null ? void 0 : base.keys()) != null ? _a : []]);
  for (const path of [...paths].sort()) {
    const localFile = local.get(path);
    const remoteFile = remote.get(path);
    const baseFile = base == null ? void 0 : base.get(path);
    const localChanged = base ? (localFile == null ? void 0 : localFile.sha) !== (baseFile == null ? void 0 : baseFile.sha) : Boolean(localFile);
    if (!localChanged || (localFile == null ? void 0 : localFile.sha) === (remoteFile == null ? void 0 : remoteFile.sha)) continue;
    const remoteChanged = base ? (remoteFile == null ? void 0 : remoteFile.sha) !== (baseFile == null ? void 0 : baseFile.sha) : Boolean(remoteFile);
    if (remoteChanged) conflicts.push({ path, local: localFile != null ? localFile : null, remote: remoteFile != null ? remoteFile : null });
    else upload.set(path, localFile != null ? localFile : null);
  }
  return { upload, conflicts };
}
function detectMassDeletion(base, current) {
  const total = base.size;
  if (total < MASS_DELETION_MINIMUM) return null;
  let missing = 0;
  for (const path of base.keys()) {
    if (!current.has(path)) missing++;
  }
  return missing >= MASS_DELETION_MINIMUM && missing / total >= MASS_DELETION_RATIO ? { missing, total } : null;
}
async function gitBlobSha(data) {
  const header = new TextEncoder().encode(`blob ${data.byteLength}\0`);
  const payload = new Uint8Array(header.byteLength + data.byteLength);
  payload.set(header, 0);
  payload.set(new Uint8Array(data), header.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", payload);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function parseRepository(value, invalidMessage = "Repository must use the owner/repository format.") {
  const match = value.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (!match) throw new Error(invalidMessage);
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
async function mapWithConcurrency(items, limit, mapper) {
  const output = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      output[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return output;
}
function isRemoteChangedDuringSync(error) {
  return error instanceof RemoteChangedDuringSyncError || error instanceof Error && error.name === "RemoteChangedDuringSyncError";
}

// src/i18n.ts
var LANGUAGE_OPTIONS = {
  auto: "System default",
  en: "English",
  "en-GB": "English (UK)",
  zh: "\u7B80\u4F53\u4E2D\u6587",
  "zh-TW": "\u7E41\u9AD4\u4E2D\u6587",
  ja: "\u65E5\u672C\u8A9E",
  ko: "\uD55C\uAD6D\uC5B4",
  es: "Espa\xF1ol",
  de: "Deutsch",
  it: "Italiano",
  fr: "Fran\xE7ais",
  ar: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
  bn: "\u09AC\u09BE\u0982\u09B2\u09BE",
  nl: "Nederlands",
  pl: "Polski",
  pt: "Portugu\xEAs",
  "pt-BR": "Portugu\xEAs do Brasil",
  ro: "Rom\xE2n\u0103",
  ru: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439",
  sv: "Svenska",
  tr: "T\xFCrk\xE7e",
  uk: "\u0423\u043A\u0440\u0430\u0457\u043D\u0441\u044C\u043A\u0430",
  vi: "Ti\u1EBFng Vi\u1EC7t"
};
var EN = {
  appName: "GitSync Portal",
  settingsIntro: "The dashboard, search, favorites, history, and interactive quizzes are stored in this vault's plugin data.",
  language: "Language",
  languageDescription: "Choose the language used by GitSync Portal. System default follows the language selected in Obsidian.",
  syncSection: "Cross-platform GitHub sync",
  syncDescription: "Two-way sync through the GitHub REST API without system Git, so it works on Android, iOS, Windows, macOS, and Linux. The first sync keeps files unique to either side. If the same path conflicts, the newer version wins and the older version is preserved as a conflict copy.",
  githubToken: "GitHub token",
  githubTokenDescription: "Use a fine-grained token limited to this repository with Contents: Read and write. Obsidian SecretStorage keeps the token out of plugin data.json.",
  tokenSavedPlaceholder: "Saved securely; enter a new token to replace it",
  clearToken: "Clear token",
  repository: "Repository",
  repositoryDescription: "Format: owner/repository",
  branch: "Branch",
  branchDescription: "Leave blank to use the repository's default branch.",
  autoDevice: "Detect device automatically",
  autoDeviceDescription: "Current device: {device}. When enabled, each platform uses the correct system name.",
  deviceName: "Device name",
  deviceNameAutoDescription: "Filled from the current platform. Turn off automatic detection to customize it.",
  deviceNameManualDescription: "Used in commit messages and conflict-copy filenames.",
  testAndSync: "Test and sync",
  testConnection: "Test connection",
  testing: "Testing\u2026",
  connectionSuccess: "GitHub connection successful: {details}",
  connectionFailed: "Connection failed",
  syncNow: "Sync now",
  syncNowLong: "Run two-way sync now",
  pullOnly: "Pull only",
  pullOnlyLong: "Pull remote changes only",
  pullOnlyHint: "Apply remote changes locally without uploading. Local conflicts are kept as conflict copies.",
  pushOnly: "Push only",
  pushOnlyLong: "Push local changes only",
  pushOnlyHint: "Upload local changes without applying remote changes. Remote conflicts are kept as conflict copies.",
  syncing: "Syncing\u2026",
  syncOnStartup: "Sync on startup",
  syncOnStartupDescription: "Sync once after Obsidian opens this vault.",
  syncOnSave: "Sync after saving",
  syncOnSaveDescription: "Sync 30 seconds after file changes stop. Continuous edits trigger only one sync.",
  periodicSync: "Periodic sync",
  periodicSyncDescription: "Runs only while Obsidian is active. Mobile operating systems do not wake a suspended app in the background.",
  syncInterval: "Sync interval (minutes)",
  syncIntervalDescription: "Minimum 5 minutes.",
  maxFileSize: "Per-file limit (MB)",
  maxFileSizeDescription: "Default 50 MB. Sync stops instead of silently skipping oversized files. Regular GitHub blobs are not intended for very large files.",
  ignoredPaths: "Ignored paths",
  ignoredPathsDescription: "One vault-relative path or glob per line. Notes, themes, CSS, plugins, enabled-plugin lists, and plugin settings sync normally. Workspace layouts, trash, Git internals, and local sync state stay device-specific.",
  obsidianGitWarning: "This vault also has Obsidian Git enabled. Before enabling automatic sync, turn off Obsidian Git automatic pull and backup so two sync engines do not update the same branch.",
  homeNote: "Home note",
  homeNoteDescription: "Enter the full Markdown path inside the vault, or use the command that sets the current note as home.",
  homeNotePlaceholder: "Example: Notes/Home.md",
  useCurrentNote: "Use current note",
  useCurrentNoteDescription: "Set the currently open Markdown note as home.",
  setAsHome: "Set as home",
  openDashboardOnStartup: "Open dashboard on startup",
  openDashboardOnStartupDescription: "Open GitSync Portal in the left sidebar after Obsidian finishes loading the layout.",
  historyLimit: "Reading history limit",
  historyLimitDescription: "Keep the 10\u2013500 most recent notes.",
  readingDisplay: "Reading display",
  bodyFontSize: "Body font size",
  bodyLineHeight: "Body line height",
  contentMaxWidth: "Maximum content width",
  paragraphSpacing: "Paragraph spacing",
  dataManagement: "Data management",
  clearHistory: "Clear reading history",
  clearHistoryDescription: "{count} entries are stored. No notes will be deleted.",
  clear: "Clear",
  clearQuizProgress: "Clear quiz progress",
  clearQuizProgressDescription: "Remove all Quizzable answers and scores without changing quiz definitions.",
  lastSync: "Last sync: {date}; {summary}",
  never: "Never",
  notSynced: "Not synced yet",
  notesCount: "{count} notes",
  refresh: "Refresh",
  tabHome: "Home",
  tabFiles: "Files",
  tabFavorites: "Favorites",
  tabHistory: "History",
  currentNote: "Current note",
  favorite: "Favorite",
  unfavorite: "Remove favorite",
  homeNoteCard: "Home note",
  notSet: "Not set",
  homeNoteHint: "Open a note, then use the home button on the current-note card.",
  openHome: "Open home",
  noFavorites: "No favorites yet.",
  noFavoriteNotes: "No favorite notes yet.",
  recentReading: "Recent reading",
  recentReadingEmpty: "Notes you open will appear here.",
  githubSync: "Cross-platform GitHub sync",
  defaultBranch: "Default branch",
  tokenMissing: "No GitHub token is saved. Open GitSync Portal settings first.",
  searchPlaceholder: "Search filenames and note contents\u2026",
  searching: "Searching\u2026",
  searchResults: "Search results ({count})",
  noMatches: "No matching notes.",
  back: "Back",
  forward: "Forward",
  parentFolder: "Parent folder",
  vaultRoot: "Vault root",
  rootFolder: "Root",
  itemCount: "{count} items",
  folderTitle: "{name} ({count})",
  emptyFolder: "This folder is empty.",
  readingHistory: "Reading history ({count})",
  noHistory: "No reading history yet.",
  showMoreHistory: "Show {count} more",
  pageOutline: "On this page",
  noHeadings: "The current note has no headings.",
  openDashboard: "Open GitSync Portal",
  openReadingDashboard: "Open reading dashboard",
  syncGitHubNow: "Sync with GitHub now",
  openHomeNote: "Open home note",
  toggleFavorite: "Favorite or unfavorite current note",
  setCurrentHome: "Set current note as home",
  toggleFocus: "Toggle focus reading mode",
  focusEnabled: "Focus reading mode enabled",
  focusDisabled: "Focus reading mode disabled",
  syncAlreadyRunning: "A sync is already in progress.",
  syncSummary: "Pulled {pulled}, uploaded {pushed}, deleted {deleted}, conflicts {conflicts}",
  syncSummaryPull: "Pull only: updated {pulled}, deleted {deleted}, conflicts preserved {conflicts}",
  syncSummaryPush: "Push only: uploaded {pushed}, deleted {deleted}, conflicts preserved {conflicts}",
  alreadyInSync: "Local and remote are already in sync",
  syncCompleteNotice: "GitHub sync complete: {summary}",
  missingHomeNote: "No valid home note is configured. Run \u201CSet current note as home\u201D from an open note.",
  rootName: "Root",
  removedFavorite: "Removed favorite: {name}",
  addedFavorite: "Added favorite: {name}",
  homeSet: "Home note set to: {name}",
  sharedStateReadFailed: "GitSync Portal could not read the shared favorites/history file: {error}",
  sharedStateWriteFailed: "GitSync Portal could not save the shared favorites/history file: {error}",
  statusConnecting: "Connecting to GitHub\u2026",
  statusRemoteRetry: "The remote just changed. Retrying sync (attempt {attempt})\u2026",
  syncRetryFailed: "Sync retries failed.",
  statusHashing: "Calculating local file fingerprints\u2026",
  statusReconciling: "Reconciling local and remote changes\u2026",
  statusReconcilingPull: "Preparing remote changes for a pull-only sync\u2026",
  statusReconcilingPush: "Preparing local changes for a push-only sync\u2026",
  statusPulling: "Applying remote change: {path}",
  statusPushing: "Uploading local change: {path}",
  statusComplete: "Sync complete",
  statusCompletePull: "Pull-only sync complete",
  statusCompletePush: "Push-only sync complete",
  statusCommitRetry: "The remote just changed. Committing against the latest version (attempt {attempt})\u2026",
  remoteSamePathChanged: "The remote changed the same path during sync. Reconciling again.",
  remoteContinuouslyChanged: "The remote kept changing, so the sync commit failed.",
  localSide: "local vault",
  remoteSide: "GitHub repository",
  massDeletionBlocked: "Safety stop: {side} is missing {missing} of {total} previously synchronized files. Sync was stopped to prevent a large accidental deletion. Restore or review the missing files before syncing again.",
  tokenRequired: "Save a GitHub token in GitSync Portal settings first.",
  remoteTreeTooLarge: "The remote repository tree exceeds GitHub's recursive read limit. Sync stopped to avoid missing files.",
  statusScanning: "Scanning: {path}",
  unsupportedEncoding: "GitHub returned an unsupported encoding for {path}.",
  remoteFileFolderConflict: "A remote file has the same path as a local folder: {path}",
  remoteWriteFailed: "Failed to write remote file {path}: {error}",
  folderFileConflict: "Cannot create folder because a file already exists at {path}.",
  enabledListReadFailed: "Could not read the enabled-plugin list {path}: {error}",
  enabledListInvalid: "The enabled-plugin list is invalid: {path}",
  fileTooLarge: "File exceeds the {limit} MB sync limit: {path}",
  tokenInvalid: "The GitHub token is invalid or expired.",
  tokenForbidden: "The GitHub token lacks repository Contents read/write permission, or the request was rate-limited.",
  repositoryNotFound: "Repository, branch, or commit not found. Check the token scope and sync settings.",
  remoteChanged: "The remote changed during sync, so GitSync Portal restarted automatically{detail}",
  apiFailed: "GitHub API request failed (HTTP {status}){detail}",
  repositoryFormat: "Repository must use the owner/repository format.",
  quizDefinition: "Quiz definition",
  quizDefinitionWithId: "Quiz definition: {id}",
  quizDefinitionInvalid: "Invalid quiz definition",
  quizNotFound: "Quiz definition not found: {id}",
  quizSourceRequired: "Provide a complete quiz, a quiz ID, or source: current.",
  previousQuestion: "Previous",
  nextQuestion: "Next",
  quizProgress: "Question {current}/{total} \xB7 submitted {submitted}/{total}",
  submitQuestion: "Submit answer",
  retryQuestion: "Answer again",
  correctAnswer: "Correct answer: {answer}",
  rescore: "Score again",
  submit: "Submit",
  retryQuiz: "Try again",
  moveUp: "Move up",
  moveDown: "Move down",
  correct: "Correct",
  notFullyCorrect: "Not fully correct",
  passed: "Passed",
  failed: "Not passed",
  score: "Score {score}/{total} ({percent}%){suffix}",
  quizMustBeObject: "The quiz must be a YAML object.",
  quizNeedsId: "The quiz needs an ID.",
  quizNeedsQuestions: "The quiz needs a non-empty questions array.",
  quizQuestionMissing: "Question {index} is missing id, type, or prompt.",
  quizDuplicateId: "Duplicate question ID: {id}",
  quizUnsupportedType: "Unsupported question type: {type}"
};
var ZH = {
  settingsIntro: "\u9605\u8BFB\u5DE5\u4F5C\u53F0\u3001\u641C\u7D22\u3001\u6536\u85CF\u3001\u5386\u53F2\u548C\u4E92\u52A8\u6D4B\u9A8C\u5747\u4FDD\u5B58\u5728\u5F53\u524D Vault \u7684\u63D2\u4EF6\u6570\u636E\u4E2D\u3002",
  language: "\u8BED\u8A00",
  languageDescription: "\u9009\u62E9 GitSync Portal \u4F7F\u7528\u7684\u8BED\u8A00\uFF1B\u201C\u8DDF\u968F\u7CFB\u7EDF\u201D\u4F1A\u91C7\u7528 Obsidian \u5F53\u524D\u9009\u62E9\u7684\u8BED\u8A00\u3002",
  syncSection: "GitHub \u8DE8\u5E73\u53F0\u540C\u6B65",
  syncDescription: "\u901A\u8FC7 GitHub REST API \u53CC\u5411\u540C\u6B65\uFF0C\u4E0D\u8C03\u7528\u7CFB\u7EDF Git\uFF0C\u56E0\u6B64\u53EF\u5728 Android\u3001iOS\u3001Windows\u3001macOS \u548C Linux \u4F7F\u7528\u3002\u9996\u6B21\u540C\u6B65\u4F1A\u4FDD\u7559\u4E24\u7AEF\u72EC\u6709\u6587\u4EF6\uFF1B\u540C\u4E00\u8DEF\u5F84\u51B2\u7A81\u65F6\uFF0C\u8F83\u65B0\u7684\u7248\u672C\u4F5C\u4E3A\u4E3B\u6587\u4EF6\uFF0C\u8F83\u65E7\u7248\u672C\u4FDD\u5B58\u4E3A conflict \u526F\u672C\u3002",
  githubTokenDescription: "\u5EFA\u8BAE\u4F7F\u7528\u53EA\u6388\u6743\u6B64\u4ED3\u5E93\u3001Contents: Read and write \u7684 fine-grained token\u3002Token \u7531 Obsidian SecretStorage \u4FDD\u5B58\uFF0C\u4E0D\u5199\u5165\u63D2\u4EF6 data.json\u3002",
  tokenSavedPlaceholder: "\u5DF2\u5B89\u5168\u4FDD\u5B58\uFF1B\u8F93\u5165\u65B0 token \u53EF\u66FF\u6362",
  clearToken: "\u6E05\u9664 token",
  repository: "\u4ED3\u5E93",
  repositoryDescription: "\u683C\u5F0F\uFF1Aowner/repository",
  branch: "\u5206\u652F",
  branchDescription: "\u7559\u7A7A\u65F6\u4F7F\u7528\u4ED3\u5E93\u9ED8\u8BA4\u5206\u652F\u3002",
  autoDevice: "\u81EA\u52A8\u8BC6\u522B\u8BBE\u5907",
  autoDeviceDescription: "\u5F53\u524D\u8BBE\u5907\uFF1A{device}\u3002\u5F00\u542F\u540E\u4F1A\u5728\u6BCF\u4E2A\u5E73\u53F0\u81EA\u52A8\u4F7F\u7528\u6B63\u786E\u7684\u7CFB\u7EDF\u540D\u79F0\u3002",
  deviceName: "\u8BBE\u5907\u540D\u79F0",
  deviceNameAutoDescription: "\u5DF2\u7531\u5F53\u524D\u5E73\u53F0\u81EA\u52A8\u586B\u5199\uFF1B\u5173\u95ED\u81EA\u52A8\u8BC6\u522B\u540E\u53EF\u81EA\u5B9A\u4E49\u3002",
  deviceNameManualDescription: "\u7528\u4E8E commit message \u548C\u51B2\u7A81\u526F\u672C\u6587\u4EF6\u540D\u3002",
  testAndSync: "\u6D4B\u8BD5\u4E0E\u540C\u6B65",
  testConnection: "\u6D4B\u8BD5\u8FDE\u63A5",
  testing: "\u6D4B\u8BD5\u4E2D\u2026",
  connectionSuccess: "GitHub \u8FDE\u63A5\u6210\u529F\uFF1A{details}",
  connectionFailed: "\u8FDE\u63A5\u5931\u8D25",
  syncNow: "\u7ACB\u5373\u540C\u6B65",
  syncNowLong: "\u7ACB\u5373\u53CC\u5411\u540C\u6B65",
  pullOnly: "\u4EC5\u62C9\u53D6",
  pullOnlyLong: "\u4EC5\u62C9\u53D6\u8FDC\u7AEF\u66F4\u6539",
  pullOnlyHint: "\u53EA\u628A\u8FDC\u7AEF\u66F4\u6539\u5E94\u7528\u5230\u672C\u5730\uFF0C\u4E0D\u4E0A\u4F20\uFF1B\u53D1\u751F\u51B2\u7A81\u65F6\u4F1A\u4FDD\u7559\u672C\u5730 conflict \u526F\u672C\u3002",
  pushOnly: "\u4EC5\u4E0A\u4F20",
  pushOnlyLong: "\u4EC5\u4E0A\u4F20\u672C\u5730\u66F4\u6539",
  pushOnlyHint: "\u53EA\u628A\u672C\u5730\u66F4\u6539\u4E0A\u4F20\u5230\u8FDC\u7AEF\uFF0C\u4E0D\u62C9\u53D6\uFF1B\u53D1\u751F\u51B2\u7A81\u65F6\u4F1A\u4FDD\u7559\u8FDC\u7AEF conflict \u526F\u672C\u3002",
  syncing: "\u540C\u6B65\u4E2D\u2026",
  syncOnStartup: "\u542F\u52A8\u65F6\u540C\u6B65",
  syncOnStartupDescription: "Obsidian \u6253\u5F00\u5F53\u524D Vault \u540E\u81EA\u52A8\u540C\u6B65\u4E00\u6B21\u3002",
  syncOnSave: "\u4FDD\u5B58\u540E\u540C\u6B65",
  syncOnSaveDescription: "\u6587\u4EF6\u53D8\u5316\u505C\u6B62 30 \u79D2\u540E\u81EA\u52A8\u540C\u6B65\uFF1B\u8FDE\u7EED\u7F16\u8F91\u53EA\u89E6\u53D1\u4E00\u6B21\u3002",
  periodicSync: "\u5B9A\u65F6\u540C\u6B65",
  periodicSyncDescription: "\u4EC5\u5728 Obsidian \u6B63\u5728\u8FD0\u884C\u65F6\u751F\u6548\uFF0C\u79FB\u52A8\u7AEF\u88AB\u7CFB\u7EDF\u6302\u8D77\u65F6\u4E0D\u4F1A\u540E\u53F0\u5524\u9192\u3002",
  syncInterval: "\u540C\u6B65\u95F4\u9694\uFF08\u5206\u949F\uFF09",
  syncIntervalDescription: "\u6700\u77ED 5 \u5206\u949F\u3002",
  maxFileSize: "\u5355\u6587\u4EF6\u4E0A\u9650\uFF08MB\uFF09",
  maxFileSizeDescription: "\u9ED8\u8BA4 50 MB\uFF1B\u8D85\u8FC7\u4E0A\u9650\u4F1A\u505C\u6B62\u540C\u6B65\u800C\u4E0D\u662F\u9759\u9ED8\u9057\u6F0F\u3002GitHub \u666E\u901A Git blob \u4E0D\u9002\u5408\u8D85\u5927\u6587\u4EF6\u3002",
  ignoredPaths: "\u5FFD\u7565\u8DEF\u5F84",
  ignoredPathsDescription: "\u6BCF\u884C\u4E00\u4E2A Vault \u76F8\u5BF9\u8DEF\u5F84\u6216 glob\u3002\u7B14\u8BB0\u3001\u4E3B\u9898\u3001CSS\u3001\u63D2\u4EF6\u672C\u4F53\u3001\u63D2\u4EF6\u542F\u7528\u5217\u8868\u548C\u63D2\u4EF6\u8BBE\u7F6E\u4F1A\u6B63\u5E38\u540C\u6B65\uFF1B\u5DE5\u4F5C\u533A\u5E03\u5C40\u3001\u56DE\u6536\u7AD9\u3001Git \u5185\u90E8\u5E93\u548C\u540C\u6B65\u5668\u8FD0\u884C\u72B6\u6001\u6309\u8BBE\u5907\u4FDD\u7559\u3002",
  obsidianGitWarning: "\u5F53\u524D Vault \u540C\u65F6\u542F\u7528\u4E86 Obsidian Git\u3002\u542F\u7528\u81EA\u52A8\u540C\u6B65\u524D\uFF0C\u8BF7\u5173\u95ED Obsidian Git \u7684\u81EA\u52A8 pull/backup\uFF0C\u907F\u514D\u4E24\u4E2A\u540C\u6B65\u5668\u540C\u65F6\u66F4\u65B0\u8FDC\u7AEF\u5206\u652F\u3002",
  homeNote: "\u9996\u9875\u7B14\u8BB0",
  homeNoteDescription: "\u8F93\u5165 Vault \u5185\u7684\u5B8C\u6574 Markdown \u8DEF\u5F84\uFF0C\u4E5F\u53EF\u901A\u8FC7\u547D\u4EE4\u628A\u5F53\u524D\u7B14\u8BB0\u8BBE\u4E3A\u9996\u9875\u3002",
  homeNotePlaceholder: "\u4F8B\u5982\uFF1ANotes/\u9996\u9875.md",
  useCurrentNote: "\u4F7F\u7528\u5F53\u524D\u7B14\u8BB0",
  useCurrentNoteDescription: "\u628A\u5F53\u524D\u6253\u5F00\u7684 Markdown \u7B14\u8BB0\u8BBE\u4E3A\u9996\u9875\u3002",
  setAsHome: "\u8BBE\u4E3A\u9996\u9875",
  openDashboardOnStartup: "\u542F\u52A8\u65F6\u6253\u5F00\u5DE5\u4F5C\u53F0",
  openDashboardOnStartupDescription: "Obsidian \u5B8C\u6210\u5E03\u5C40\u52A0\u8F7D\u540E\u5728\u5DE6\u4FA7\u6253\u5F00 GitSync Portal\u3002",
  historyLimit: "\u9605\u8BFB\u5386\u53F2\u4E0A\u9650",
  historyLimitDescription: "\u4FDD\u7559\u6700\u8FD1 10\u2013500 \u7BC7\u7B14\u8BB0\u3002",
  readingDisplay: "\u9605\u8BFB\u663E\u793A",
  bodyFontSize: "\u6B63\u6587\u5B57\u53F7",
  bodyLineHeight: "\u6B63\u6587\u884C\u8DDD",
  contentMaxWidth: "\u5185\u5BB9\u6700\u5927\u5BBD\u5EA6",
  paragraphSpacing: "\u6BB5\u843D\u95F4\u8DDD",
  dataManagement: "\u6570\u636E\u7BA1\u7406",
  clearHistory: "\u6E05\u7A7A\u9605\u8BFB\u5386\u53F2",
  clearHistoryDescription: "\u5F53\u524D\u4FDD\u5B58 {count} \u6761\u8BB0\u5F55\uFF0C\u4E0D\u4F1A\u5220\u9664\u4EFB\u4F55\u7B14\u8BB0\u3002",
  clear: "\u6E05\u7A7A",
  clearQuizProgress: "\u6E05\u7A7A\u7B54\u9898\u8FDB\u5EA6",
  clearQuizProgressDescription: "\u6E05\u9664\u6240\u6709 Quizzable \u4F5C\u7B54\u548C\u8BC4\u5206\u8BB0\u5F55\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u9898\u76EE\u3002",
  lastSync: "\u4E0A\u6B21\u540C\u6B65\uFF1A{date}\uFF1B{summary}",
  never: "\u4ECE\u672A",
  notSynced: "\u5C1A\u672A\u540C\u6B65",
  notesCount: "{count} \u7BC7\u7B14\u8BB0",
  refresh: "\u5237\u65B0",
  tabHome: "\u9996\u9875",
  tabFiles: "\u6587\u4EF6",
  tabFavorites: "\u6536\u85CF",
  tabHistory: "\u5386\u53F2",
  currentNote: "\u5F53\u524D\u7B14\u8BB0",
  favorite: "\u6536\u85CF",
  unfavorite: "\u53D6\u6D88\u6536\u85CF",
  homeNoteCard: "\u9996\u9875\u7B14\u8BB0",
  notSet: "\u5C1A\u672A\u8BBE\u7F6E",
  homeNoteHint: "\u6253\u5F00\u4E00\u7BC7\u7B14\u8BB0\u540E\uFF0C\u4F7F\u7528\u5F53\u524D\u7B14\u8BB0\u5361\u7247\u4E0A\u7684\u9996\u9875\u6309\u94AE\u3002",
  openHome: "\u6253\u5F00\u9996\u9875",
  noFavorites: "\u8FD8\u6CA1\u6709\u6536\u85CF\u3002",
  noFavoriteNotes: "\u8FD8\u6CA1\u6709\u6536\u85CF\u7B14\u8BB0\u3002",
  recentReading: "\u6700\u8FD1\u9605\u8BFB",
  recentReadingEmpty: "\u6253\u5F00\u8FC7\u7684\u7B14\u8BB0\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002",
  githubSync: "GitHub \u8DE8\u5E73\u53F0\u540C\u6B65",
  defaultBranch: "\u9ED8\u8BA4\u5206\u652F",
  tokenMissing: "\u5C1A\u672A\u4FDD\u5B58 GitHub token\uFF0C\u8BF7\u5148\u524D\u5F80 GitSync Portal \u8BBE\u7F6E\u3002",
  searchPlaceholder: "\u641C\u7D22\u6587\u4EF6\u540D\u548C\u6B63\u6587\u2026",
  searching: "\u6B63\u5728\u641C\u7D22\u2026",
  searchResults: "\u641C\u7D22\u7ED3\u679C\uFF08{count}\uFF09",
  noMatches: "\u6CA1\u6709\u5339\u914D\u7684\u7B14\u8BB0\u3002",
  back: "\u540E\u9000",
  forward: "\u524D\u8FDB",
  parentFolder: "\u4E0A\u4E00\u7EA7",
  vaultRoot: "Vault \u6839\u76EE\u5F55",
  rootFolder: "\u6839\u76EE\u5F55",
  itemCount: "{count} \u9879",
  folderTitle: "{name}\uFF08{count}\uFF09",
  emptyFolder: "\u5F53\u524D\u76EE\u5F55\u4E3A\u7A7A\u3002",
  readingHistory: "\u9605\u8BFB\u5386\u53F2\uFF08{count}\uFF09",
  noHistory: "\u6682\u65E0\u9605\u8BFB\u5386\u53F2\u3002",
  showMoreHistory: "\u518D\u663E\u793A {count} \u6761",
  pageOutline: "\u672C\u9875\u76EE\u5F55",
  noHeadings: "\u5F53\u524D\u7B14\u8BB0\u6CA1\u6709\u6807\u9898\u3002",
  openDashboard: "\u6253\u5F00 GitSync Portal",
  openReadingDashboard: "\u6253\u5F00\u9605\u8BFB\u5DE5\u4F5C\u53F0",
  syncGitHubNow: "\u7ACB\u5373\u4E0E GitHub \u53CC\u5411\u540C\u6B65",
  openHomeNote: "\u6253\u5F00\u9996\u9875\u7B14\u8BB0",
  toggleFavorite: "\u6536\u85CF\u6216\u53D6\u6D88\u6536\u85CF\u5F53\u524D\u7B14\u8BB0",
  setCurrentHome: "\u5C06\u5F53\u524D\u7B14\u8BB0\u8BBE\u4E3A\u9996\u9875",
  toggleFocus: "\u5207\u6362\u4E13\u6CE8\u9605\u8BFB\u6A21\u5F0F",
  focusEnabled: "\u5DF2\u8FDB\u5165\u4E13\u6CE8\u9605\u8BFB\u6A21\u5F0F",
  focusDisabled: "\u5DF2\u9000\u51FA\u4E13\u6CE8\u9605\u8BFB\u6A21\u5F0F",
  syncAlreadyRunning: "\u540C\u6B65\u5DF2\u7ECF\u5728\u8FDB\u884C\u4E2D\u3002",
  syncSummary: "\u62C9\u53D6 {pulled}\u3001\u4E0A\u4F20 {pushed}\u3001\u5220\u9664 {deleted}\u3001\u51B2\u7A81 {conflicts}",
  syncSummaryPull: "\u4EC5\u62C9\u53D6\uFF1A\u66F4\u65B0 {pulled}\u3001\u5220\u9664 {deleted}\u3001\u4FDD\u7559\u51B2\u7A81 {conflicts}",
  syncSummaryPush: "\u4EC5\u4E0A\u4F20\uFF1A\u4E0A\u4F20 {pushed}\u3001\u5220\u9664 {deleted}\u3001\u4FDD\u7559\u51B2\u7A81 {conflicts}",
  alreadyInSync: "\u672C\u5730\u4E0E\u8FDC\u7AEF\u5DF2\u7ECF\u4E00\u81F4",
  syncCompleteNotice: "GitHub \u540C\u6B65\u5B8C\u6210\uFF1A{summary}",
  missingHomeNote: "\u5C1A\u672A\u8BBE\u7F6E\u6709\u6548\u7684\u9996\u9875\u7B14\u8BB0\u3002\u53EF\u5728\u5F53\u524D\u7B14\u8BB0\u4E2D\u8FD0\u884C\u201C\u5C06\u5F53\u524D\u7B14\u8BB0\u8BBE\u4E3A\u9996\u9875\u201D\u3002",
  rootName: "\u6839\u76EE\u5F55",
  removedFavorite: "\u5DF2\u53D6\u6D88\u6536\u85CF\uFF1A{name}",
  addedFavorite: "\u5DF2\u6536\u85CF\uFF1A{name}",
  homeSet: "\u9996\u9875\u5DF2\u8BBE\u4E3A\uFF1A{name}",
  sharedStateReadFailed: "GitSync Portal \u5171\u4EAB\u6536\u85CF/\u5386\u53F2\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25\uFF1A{error}",
  sharedStateWriteFailed: "GitSync Portal \u5171\u4EAB\u6536\u85CF/\u5386\u53F2\u6587\u4EF6\u4FDD\u5B58\u5931\u8D25\uFF1A{error}",
  statusConnecting: "\u6B63\u5728\u8FDE\u63A5 GitHub\u2026",
  statusRemoteRetry: "\u8FDC\u7AEF\u521A\u521A\u66F4\u65B0\uFF0C\u6B63\u5728\u91CD\u65B0\u540C\u6B65\uFF08\u7B2C {attempt} \u6B21\uFF09\u2026",
  syncRetryFailed: "\u540C\u6B65\u91CD\u8BD5\u5931\u8D25\u3002",
  statusHashing: "\u6B63\u5728\u8BA1\u7B97\u672C\u5730\u6587\u4EF6\u6307\u7EB9\u2026",
  statusReconciling: "\u6B63\u5728\u5408\u5E76\u672C\u5730\u4E0E\u8FDC\u7AEF\u53D8\u66F4\u2026",
  statusReconcilingPull: "\u6B63\u5728\u51C6\u5907\u4EC5\u62C9\u53D6\u7684\u8FDC\u7AEF\u66F4\u6539\u2026",
  statusReconcilingPush: "\u6B63\u5728\u51C6\u5907\u4EC5\u4E0A\u4F20\u7684\u672C\u5730\u66F4\u6539\u2026",
  statusPulling: "\u6B63\u5728\u5E94\u7528\u8FDC\u7AEF\u53D8\u66F4\uFF1A{path}",
  statusPushing: "\u6B63\u5728\u4E0A\u4F20\u672C\u5730\u53D8\u66F4\uFF1A{path}",
  statusComplete: "\u540C\u6B65\u5B8C\u6210",
  statusCompletePull: "\u4EC5\u62C9\u53D6\u5B8C\u6210",
  statusCompletePush: "\u4EC5\u4E0A\u4F20\u5B8C\u6210",
  statusCommitRetry: "\u8FDC\u7AEF\u521A\u521A\u66F4\u65B0\uFF0C\u6B63\u5728\u57FA\u4E8E\u6700\u65B0\u7248\u672C\u63D0\u4EA4\uFF08\u7B2C {attempt} \u6B21\uFF09\u2026",
  remoteSamePathChanged: "\u8FDC\u7AEF\u5728\u540C\u6B65\u671F\u95F4\u4FEE\u6539\u4E86\u540C\u4E00\u8DEF\u5F84\uFF0C\u6B63\u5728\u91CD\u65B0\u5408\u5E76\u3002",
  remoteContinuouslyChanged: "\u8FDC\u7AEF\u6301\u7EED\u53D8\u5316\uFF0C\u540C\u6B65\u63D0\u4EA4\u5931\u8D25\u3002",
  localSide: "\u672C\u5730\u77E5\u8BC6\u5E93",
  remoteSide: "GitHub \u4ED3\u5E93",
  massDeletionBlocked: "\u5B89\u5168\u7194\u65AD\uFF1A{side} \u7F3A\u5C11\u4E0A\u6B21\u5DF2\u540C\u6B65\u7684 {total} \u4E2A\u6587\u4EF6\u4E2D\u7684 {missing} \u4E2A\u3002\u4E3A\u9632\u6B62\u5927\u89C4\u6A21\u8BEF\u5220\uFF0C\u5DF2\u505C\u6B62\u540C\u6B65\uFF1B\u8BF7\u5148\u6062\u590D\u6216\u6838\u5BF9\u7F3A\u5931\u6587\u4EF6\u3002",
  tokenRequired: "\u8BF7\u5148\u5728 GitSync Portal \u8BBE\u7F6E\u4E2D\u4FDD\u5B58 GitHub token\u3002",
  remoteTreeTooLarge: "\u8FDC\u7AEF\u4ED3\u5E93\u6587\u4EF6\u6811\u8D85\u8FC7 GitHub \u5355\u6B21\u9012\u5F52\u8BFB\u53D6\u4E0A\u9650\uFF0C\u5DF2\u505C\u6B62\u540C\u6B65\u4EE5\u907F\u514D\u9057\u6F0F\u6587\u4EF6\u3002",
  statusScanning: "\u6B63\u5728\u626B\u63CF\uFF1A{path}",
  unsupportedEncoding: "GitHub \u8FD4\u56DE\u4E86\u4E0D\u652F\u6301\u7684\u7F16\u7801\uFF1A{path}",
  remoteFileFolderConflict: "\u8FDC\u7AEF\u6587\u4EF6\u4E0E\u672C\u5730\u6587\u4EF6\u5939\u540C\u540D\uFF1A{path}",
  remoteWriteFailed: "\u5199\u5165\u8FDC\u7AEF\u6587\u4EF6\u5931\u8D25\uFF1A{path}\uFF1A{error}",
  folderFileConflict: "\u65E0\u6CD5\u521B\u5EFA\u6587\u4EF6\u5939\uFF0C\u5DF2\u6709\u540C\u540D\u6587\u4EF6\uFF1A{path}",
  enabledListReadFailed: "\u65E0\u6CD5\u8BFB\u53D6\u63D2\u4EF6\u542F\u7528\u5217\u8868 {path}\uFF1A{error}",
  enabledListInvalid: "\u63D2\u4EF6\u542F\u7528\u5217\u8868\u683C\u5F0F\u65E0\u6548\uFF1A{path}",
  fileTooLarge: "\u6587\u4EF6\u8D85\u8FC7 {limit} MB \u540C\u6B65\u4E0A\u9650\uFF1A{path}",
  tokenInvalid: "GitHub token \u65E0\u6548\u6216\u5DF2\u7ECF\u8FC7\u671F\u3002",
  tokenForbidden: "GitHub token \u7F3A\u5C11\u4ED3\u5E93 Contents \u8BFB\u5199\u6743\u9650\uFF0C\u6216\u8BF7\u6C42\u53D7\u5230\u901F\u7387\u9650\u5236\u3002",
  repositoryNotFound: "\u627E\u4E0D\u5230\u4ED3\u5E93\u3001\u5206\u652F\u6216 commit\uFF1B\u8BF7\u68C0\u67E5 token \u6388\u6743\u8303\u56F4\u548C\u540C\u6B65\u8BBE\u7F6E\u3002",
  remoteChanged: "\u8FDC\u7AEF\u5728\u540C\u6B65\u671F\u95F4\u53D1\u751F\u53D8\u5316\uFF0C\u5DF2\u81EA\u52A8\u91CD\u65B0\u540C\u6B65{detail}",
  apiFailed: "GitHub API \u8BF7\u6C42\u5931\u8D25\uFF08HTTP {status}\uFF09{detail}",
  repositoryFormat: "\u4ED3\u5E93\u683C\u5F0F\u5FC5\u987B\u662F owner/repository\u3002",
  quizDefinition: "\u9898\u5E93\u5B9A\u4E49",
  quizDefinitionWithId: "\u9898\u5E93\u5B9A\u4E49\uFF1A{id}",
  quizDefinitionInvalid: "\u9898\u5E93\u5B9A\u4E49\u683C\u5F0F\u9519\u8BEF",
  quizNotFound: "\u627E\u4E0D\u5230\u9898\u5E93\u5B9A\u4E49\uFF1A{id}",
  quizSourceRequired: "\u9700\u8981\u5B8C\u6574 quiz\u3001\u9898\u5E93 id\uFF0C\u6216 source: current\u3002",
  previousQuestion: "\u4E0A\u4E00\u9898",
  nextQuestion: "\u4E0B\u4E00\u9898",
  quizProgress: "\u7B2C {current}/{total} \u9898 \xB7 \u5DF2\u63D0\u4EA4 {submitted}/{total}",
  submitQuestion: "\u63D0\u4EA4\u672C\u9898",
  retryQuestion: "\u91CD\u65B0\u4F5C\u7B54\u672C\u9898",
  correctAnswer: "\u6B63\u786E\u7B54\u6848\uFF1A{answer}",
  rescore: "\u91CD\u65B0\u8BC4\u5206",
  submit: "\u63D0\u4EA4",
  retryQuiz: "\u91CD\u65B0\u4F5C\u7B54",
  moveUp: "\u4E0A\u79FB",
  moveDown: "\u4E0B\u79FB",
  correct: "\u6B63\u786E",
  notFullyCorrect: "\u672A\u5B8C\u5168\u6B63\u786E",
  passed: "\u901A\u8FC7",
  failed: "\u672A\u901A\u8FC7",
  score: "\u5F97\u5206 {score}/{total}\uFF08{percent}%\uFF09{suffix}",
  quizMustBeObject: "\u9898\u76EE\u5FC5\u987B\u662F YAML \u5BF9\u8C61\u3002",
  quizNeedsId: "\u9898\u76EE\u9700\u8981 id\u3002",
  quizNeedsQuestions: "\u9898\u76EE\u9700\u8981\u975E\u7A7A questions\u3002",
  quizQuestionMissing: "\u7B2C {index} \u9898\u7F3A\u5C11 id\u3001type \u6216 prompt\u3002",
  quizDuplicateId: "\u9898\u76EE id \u91CD\u590D\uFF1A{id}",
  quizUnsupportedType: "\u4E0D\u652F\u6301\u7684\u9898\u578B\uFF1A{type}"
};
var ZH_TW = {
  ...ZH,
  language: "\u8A9E\u8A00",
  languageDescription: "\u9078\u64C7 GitSync Portal \u4F7F\u7528\u7684\u8A9E\u8A00\uFF1B\u300C\u8DDF\u96A8\u7CFB\u7D71\u300D\u6703\u63A1\u7528 Obsidian \u76EE\u524D\u9078\u64C7\u7684\u8A9E\u8A00\u3002",
  settingsIntro: "\u95B1\u8B80\u5DE5\u4F5C\u53F0\u3001\u641C\u5C0B\u3001\u6536\u85CF\u3001\u6B77\u53F2\u548C\u4E92\u52D5\u6E2C\u9A57\u5747\u5132\u5B58\u5728\u76EE\u524D Vault \u7684\u5916\u639B\u8CC7\u6599\u4E2D\u3002",
  syncDescription: "\u900F\u904E GitHub REST API \u96D9\u5411\u540C\u6B65\uFF0C\u4E0D\u547C\u53EB\u7CFB\u7D71 Git\uFF0C\u56E0\u6B64\u53EF\u5728 Android\u3001iOS\u3001Windows\u3001macOS \u548C Linux \u4F7F\u7528\u3002\u9996\u6B21\u540C\u6B65\u6703\u4FDD\u7559\u5169\u7AEF\u7368\u6709\u6A94\u6848\uFF1B\u540C\u4E00\u8DEF\u5F91\u885D\u7A81\u6642\uFF0C\u8F03\u65B0\u7684\u7248\u672C\u4F5C\u70BA\u4E3B\u6A94\u6848\uFF0C\u8F03\u820A\u7248\u672C\u5132\u5B58\u70BA conflict \u526F\u672C\u3002",
  repository: "\u5132\u5B58\u5EAB",
  branch: "\u5206\u652F",
  autoDevice: "\u81EA\u52D5\u8B58\u5225\u88DD\u7F6E",
  deviceName: "\u88DD\u7F6E\u540D\u7A31",
  testAndSync: "\u6E2C\u8A66\u8207\u540C\u6B65",
  testConnection: "\u6E2C\u8A66\u9023\u7DDA",
  testing: "\u6E2C\u8A66\u4E2D\u2026",
  connectionFailed: "\u9023\u7DDA\u5931\u6557",
  syncNow: "\u7ACB\u5373\u540C\u6B65",
  syncing: "\u540C\u6B65\u4E2D\u2026",
  ignoredPaths: "\u5FFD\u7565\u8DEF\u5F91",
  homeNote: "\u9996\u9801\u7B46\u8A18",
  readingDisplay: "\u95B1\u8B80\u986F\u793A",
  dataManagement: "\u8CC7\u6599\u7BA1\u7406",
  clearHistory: "\u6E05\u9664\u95B1\u8B80\u6B77\u53F2",
  clear: "\u6E05\u9664",
  tabHome: "\u9996\u9801",
  tabFiles: "\u6A94\u6848",
  tabFavorites: "\u6536\u85CF",
  tabHistory: "\u6B77\u53F2",
  currentNote: "\u76EE\u524D\u7B46\u8A18",
  searchPlaceholder: "\u641C\u5C0B\u6A94\u540D\u548C\u7B46\u8A18\u5167\u5BB9\u2026",
  searching: "\u6B63\u5728\u641C\u5C0B\u2026",
  noMatches: "\u6C92\u6709\u7B26\u5408\u7684\u7B46\u8A18\u3002",
  back: "\u8FD4\u56DE",
  forward: "\u524D\u9032",
  parentFolder: "\u4E0A\u4E00\u5C64",
  rootFolder: "\u6839\u76EE\u9304",
  emptyFolder: "\u76EE\u524D\u8CC7\u6599\u593E\u662F\u7A7A\u7684\u3002",
  pageOutline: "\u672C\u9801\u76EE\u9304",
  noHeadings: "\u76EE\u524D\u7B46\u8A18\u6C92\u6709\u6A19\u984C\u3002"
};
var JA = {
  settingsIntro: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3001\u691C\u7D22\u3001\u304A\u6C17\u306B\u5165\u308A\u3001\u5C65\u6B74\u3001\u30A4\u30F3\u30BF\u30E9\u30AF\u30C6\u30A3\u30D6\u30AF\u30A4\u30BA\u306F\u3001\u3053\u306E Vault \u306E\u30D7\u30E9\u30B0\u30A4\u30F3\u30C7\u30FC\u30BF\u306B\u4FDD\u5B58\u3055\u308C\u307E\u3059\u3002",
  language: "\u8A00\u8A9E",
  languageDescription: "GitSync Portal \u3067\u4F7F\u7528\u3059\u308B\u8A00\u8A9E\u3092\u9078\u629E\u3057\u307E\u3059\u3002\u300C\u30B7\u30B9\u30C6\u30E0\u8A2D\u5B9A\u300D\u306F Obsidian \u3067\u9078\u629E\u4E2D\u306E\u8A00\u8A9E\u306B\u5F93\u3044\u307E\u3059\u3002",
  syncSection: "GitHub \u30AF\u30ED\u30B9\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0\u540C\u671F",
  githubTokenDescription: "\u3053\u306E\u30EA\u30DD\u30B8\u30C8\u30EA\u3060\u3051\u306B Contents: Read and write \u3092\u8A31\u53EF\u3057\u305F fine-grained token \u3092\u63A8\u5968\u3057\u307E\u3059\u3002Token \u306F Obsidian SecretStorage \u306B\u4FDD\u5B58\u3055\u308C\u307E\u3059\u3002",
  clearToken: "Token \u3092\u524A\u9664",
  repository: "\u30EA\u30DD\u30B8\u30C8\u30EA",
  branch: "\u30D6\u30E9\u30F3\u30C1",
  autoDevice: "\u7AEF\u672B\u3092\u81EA\u52D5\u691C\u51FA",
  autoDeviceDescription: "\u73FE\u5728\u306E\u7AEF\u672B: {device}\u3002\u6709\u52B9\u306B\u3059\u308B\u3068\u5404\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0\u306E\u30B7\u30B9\u30C6\u30E0\u540D\u3092\u4F7F\u7528\u3057\u307E\u3059\u3002",
  deviceName: "\u7AEF\u672B\u540D",
  testAndSync: "\u63A5\u7D9A\u30C6\u30B9\u30C8\u3068\u540C\u671F",
  testConnection: "\u63A5\u7D9A\u3092\u30C6\u30B9\u30C8",
  testing: "\u30C6\u30B9\u30C8\u4E2D\u2026",
  connectionSuccess: "GitHub \u63A5\u7D9A\u6210\u529F: {details}",
  connectionFailed: "\u63A5\u7D9A\u306B\u5931\u6557\u3057\u307E\u3057\u305F",
  syncNow: "\u4ECA\u3059\u3050\u540C\u671F",
  syncNowLong: "\u4ECA\u3059\u3050\u53CC\u65B9\u5411\u540C\u671F",
  syncing: "\u540C\u671F\u4E2D\u2026",
  syncOnStartup: "\u8D77\u52D5\u6642\u306B\u540C\u671F",
  syncOnSave: "\u4FDD\u5B58\u5F8C\u306B\u540C\u671F",
  periodicSync: "\u5B9A\u671F\u540C\u671F",
  syncInterval: "\u540C\u671F\u9593\u9694\uFF08\u5206\uFF09",
  maxFileSize: "\u30D5\u30A1\u30A4\u30EB\u4E0A\u9650\uFF08MB\uFF09",
  ignoredPaths: "\u9664\u5916\u30D1\u30B9",
  homeNote: "\u30DB\u30FC\u30E0\u30CE\u30FC\u30C8",
  useCurrentNote: "\u73FE\u5728\u306E\u30CE\u30FC\u30C8\u3092\u4F7F\u7528",
  setAsHome: "\u30DB\u30FC\u30E0\u306B\u8A2D\u5B9A",
  openDashboardOnStartup: "\u8D77\u52D5\u6642\u306B\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3092\u958B\u304F",
  historyLimit: "\u95B2\u89A7\u5C65\u6B74\u306E\u4E0A\u9650",
  readingDisplay: "\u8868\u793A\u8A2D\u5B9A",
  bodyFontSize: "\u672C\u6587\u306E\u6587\u5B57\u30B5\u30A4\u30BA",
  bodyLineHeight: "\u672C\u6587\u306E\u884C\u9593",
  contentMaxWidth: "\u30B3\u30F3\u30C6\u30F3\u30C4\u306E\u6700\u5927\u5E45",
  paragraphSpacing: "\u6BB5\u843D\u9593\u9694",
  dataManagement: "\u30C7\u30FC\u30BF\u7BA1\u7406",
  clearHistory: "\u95B2\u89A7\u5C65\u6B74\u3092\u6D88\u53BB",
  clear: "\u6D88\u53BB",
  clearQuizProgress: "\u30AF\u30A4\u30BA\u9032\u6357\u3092\u6D88\u53BB",
  never: "\u306A\u3057",
  notSynced: "\u672A\u540C\u671F",
  notesCount: "{count} \u4EF6\u306E\u30CE\u30FC\u30C8",
  refresh: "\u66F4\u65B0",
  tabHome: "\u30DB\u30FC\u30E0",
  tabFiles: "\u30D5\u30A1\u30A4\u30EB",
  tabFavorites: "\u304A\u6C17\u306B\u5165\u308A",
  tabHistory: "\u5C65\u6B74",
  currentNote: "\u73FE\u5728\u306E\u30CE\u30FC\u30C8",
  favorite: "\u304A\u6C17\u306B\u5165\u308A",
  unfavorite: "\u304A\u6C17\u306B\u5165\u308A\u3092\u89E3\u9664",
  notSet: "\u672A\u8A2D\u5B9A",
  openHome: "\u30DB\u30FC\u30E0\u3092\u958B\u304F",
  noFavorites: "\u304A\u6C17\u306B\u5165\u308A\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002",
  recentReading: "\u6700\u8FD1\u8AAD\u3093\u3060\u30CE\u30FC\u30C8",
  githubSync: "GitHub \u30AF\u30ED\u30B9\u30D7\u30E9\u30C3\u30C8\u30D5\u30A9\u30FC\u30E0\u540C\u671F",
  defaultBranch: "\u65E2\u5B9A\u306E\u30D6\u30E9\u30F3\u30C1",
  searchPlaceholder: "\u30D5\u30A1\u30A4\u30EB\u540D\u3068\u30CE\u30FC\u30C8\u672C\u6587\u3092\u691C\u7D22\u2026",
  searching: "\u691C\u7D22\u4E2D\u2026",
  searchResults: "\u691C\u7D22\u7D50\u679C\uFF08{count}\uFF09",
  noMatches: "\u4E00\u81F4\u3059\u308B\u30CE\u30FC\u30C8\u306F\u3042\u308A\u307E\u305B\u3093\u3002",
  back: "\u623B\u308B",
  forward: "\u9032\u3080",
  parentFolder: "\u89AA\u30D5\u30A9\u30EB\u30C0",
  vaultRoot: "Vault \u30EB\u30FC\u30C8",
  rootFolder: "\u30EB\u30FC\u30C8",
  itemCount: "{count} \u9805\u76EE",
  emptyFolder: "\u3053\u306E\u30D5\u30A9\u30EB\u30C0\u306F\u7A7A\u3067\u3059\u3002",
  readingHistory: "\u95B2\u89A7\u5C65\u6B74\uFF08{count}\uFF09",
  noHistory: "\u95B2\u89A7\u5C65\u6B74\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002",
  pageOutline: "\u3053\u306E\u30DA\u30FC\u30B8",
  noHeadings: "\u73FE\u5728\u306E\u30CE\u30FC\u30C8\u306B\u306F\u898B\u51FA\u3057\u304C\u3042\u308A\u307E\u305B\u3093\u3002",
  focusEnabled: "\u96C6\u4E2D\u95B2\u89A7\u30E2\u30FC\u30C9\u3092\u6709\u52B9\u306B\u3057\u307E\u3057\u305F",
  focusDisabled: "\u96C6\u4E2D\u95B2\u89A7\u30E2\u30FC\u30C9\u3092\u7D42\u4E86\u3057\u307E\u3057\u305F",
  syncAlreadyRunning: "\u540C\u671F\u306F\u3059\u3067\u306B\u5B9F\u884C\u4E2D\u3067\u3059\u3002",
  alreadyInSync: "\u30ED\u30FC\u30AB\u30EB\u3068\u30EA\u30E2\u30FC\u30C8\u306F\u540C\u671F\u6E08\u307F\u3067\u3059",
  statusConnecting: "GitHub \u306B\u63A5\u7D9A\u4E2D\u2026",
  statusHashing: "\u30ED\u30FC\u30AB\u30EB\u30D5\u30A1\u30A4\u30EB\u3092\u78BA\u8A8D\u4E2D\u2026",
  statusReconciling: "\u30ED\u30FC\u30AB\u30EB\u3068\u30EA\u30E2\u30FC\u30C8\u306E\u5909\u66F4\u3092\u7D71\u5408\u4E2D\u2026",
  statusComplete: "\u540C\u671F\u5B8C\u4E86",
  quizDefinition: "\u30AF\u30A4\u30BA\u5B9A\u7FA9",
  quizDefinitionInvalid: "\u30AF\u30A4\u30BA\u5B9A\u7FA9\u304C\u7121\u52B9\u3067\u3059",
  previousQuestion: "\u524D\u3078",
  nextQuestion: "\u6B21\u3078",
  rescore: "\u518D\u63A1\u70B9",
  submit: "\u9001\u4FE1",
  retryQuiz: "\u3082\u3046\u4E00\u5EA6",
  moveUp: "\u4E0A\u3078",
  moveDown: "\u4E0B\u3078",
  correct: "\u6B63\u89E3",
  notFullyCorrect: "\u5B8C\u5168\u306A\u6B63\u89E3\u3067\u306F\u3042\u308A\u307E\u305B\u3093",
  passed: "\u5408\u683C",
  failed: "\u4E0D\u5408\u683C"
};
var KO = {
  settingsIntro: "\uB300\uC2DC\uBCF4\uB4DC, \uAC80\uC0C9, \uC990\uACA8\uCC3E\uAE30, \uAE30\uB85D \uBC0F \uB300\uD654\uD615 \uD034\uC988\uB294 \uD604\uC7AC Vault\uC758 \uD50C\uB7EC\uADF8\uC778 \uB370\uC774\uD130\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4.",
  language: "\uC5B8\uC5B4",
  languageDescription: "GitSync Portal\uC5D0\uC11C \uC0AC\uC6A9\uD560 \uC5B8\uC5B4\uB97C \uC120\uD0DD\uD569\uB2C8\uB2E4. \uC2DC\uC2A4\uD15C \uAE30\uBCF8\uAC12\uC740 Obsidian\uC5D0\uC11C \uC120\uD0DD\uD55C \uC5B8\uC5B4\uB97C \uB530\uB985\uB2C8\uB2E4.",
  syncSection: "GitHub \uD06C\uB85C\uC2A4 \uD50C\uB7AB\uD3FC \uB3D9\uAE30\uD654",
  githubTokenDescription: "\uC774 \uC800\uC7A5\uC18C\uC5D0\uB9CC Contents: Read and write \uAD8C\uD55C\uC744 \uBD80\uC5EC\uD55C fine-grained token\uC744 \uAD8C\uC7A5\uD569\uB2C8\uB2E4. Token\uC740 Obsidian SecretStorage\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4.",
  clearToken: "Token \uC9C0\uC6B0\uAE30",
  repository: "\uC800\uC7A5\uC18C",
  branch: "\uBE0C\uB79C\uCE58",
  autoDevice: "\uAE30\uAE30 \uC790\uB3D9 \uAC10\uC9C0",
  autoDeviceDescription: "\uD604\uC7AC \uAE30\uAE30: {device}. \uD65C\uC131\uD654\uD558\uBA74 \uAC01 \uD50C\uB7AB\uD3FC\uC758 \uC62C\uBC14\uB978 \uC2DC\uC2A4\uD15C \uC774\uB984\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
  deviceName: "\uAE30\uAE30 \uC774\uB984",
  testAndSync: "\uC5F0\uACB0 \uD14C\uC2A4\uD2B8 \uBC0F \uB3D9\uAE30\uD654",
  testConnection: "\uC5F0\uACB0 \uD14C\uC2A4\uD2B8",
  testing: "\uD14C\uC2A4\uD2B8 \uC911\u2026",
  connectionSuccess: "GitHub \uC5F0\uACB0 \uC131\uACF5: {details}",
  connectionFailed: "\uC5F0\uACB0 \uC2E4\uD328",
  syncNow: "\uC9C0\uAE08 \uB3D9\uAE30\uD654",
  syncNowLong: "\uC9C0\uAE08 \uC591\uBC29\uD5A5 \uB3D9\uAE30\uD654",
  syncing: "\uB3D9\uAE30\uD654 \uC911\u2026",
  syncOnStartup: "\uC2DC\uC791\uD560 \uB54C \uB3D9\uAE30\uD654",
  syncOnSave: "\uC800\uC7A5 \uD6C4 \uB3D9\uAE30\uD654",
  periodicSync: "\uC8FC\uAE30\uC801 \uB3D9\uAE30\uD654",
  syncInterval: "\uB3D9\uAE30\uD654 \uAC04\uACA9(\uBD84)",
  maxFileSize: "\uD30C\uC77C\uB2F9 \uC81C\uD55C(MB)",
  ignoredPaths: "\uC81C\uC678 \uACBD\uB85C",
  homeNote: "\uD648 \uB178\uD2B8",
  useCurrentNote: "\uD604\uC7AC \uB178\uD2B8 \uC0AC\uC6A9",
  setAsHome: "\uD648\uC73C\uB85C \uC124\uC815",
  openDashboardOnStartup: "\uC2DC\uC791\uD560 \uB54C \uB300\uC2DC\uBCF4\uB4DC \uC5F4\uAE30",
  historyLimit: "\uC77D\uAE30 \uAE30\uB85D \uC81C\uD55C",
  readingDisplay: "\uC77D\uAE30 \uD45C\uC2DC",
  bodyFontSize: "\uBCF8\uBB38 \uAE00\uAF34 \uD06C\uAE30",
  bodyLineHeight: "\uBCF8\uBB38 \uC904 \uAC04\uACA9",
  contentMaxWidth: "\uCD5C\uB300 \uCF58\uD150\uCE20 \uB108\uBE44",
  paragraphSpacing: "\uBB38\uB2E8 \uAC04\uACA9",
  dataManagement: "\uB370\uC774\uD130 \uAD00\uB9AC",
  clearHistory: "\uC77D\uAE30 \uAE30\uB85D \uC9C0\uC6B0\uAE30",
  clear: "\uC9C0\uC6B0\uAE30",
  clearQuizProgress: "\uD034\uC988 \uC9C4\uD589 \uC0C1\uD669 \uC9C0\uC6B0\uAE30",
  never: "\uC5C6\uC74C",
  notSynced: "\uC544\uC9C1 \uB3D9\uAE30\uD654\uB418\uC9C0 \uC54A\uC74C",
  notesCount: "\uB178\uD2B8 {count}\uAC1C",
  refresh: "\uC0C8\uB85C \uACE0\uCE68",
  tabHome: "\uD648",
  tabFiles: "\uD30C\uC77C",
  tabFavorites: "\uC990\uACA8\uCC3E\uAE30",
  tabHistory: "\uAE30\uB85D",
  currentNote: "\uD604\uC7AC \uB178\uD2B8",
  favorite: "\uC990\uACA8\uCC3E\uAE30",
  unfavorite: "\uC990\uACA8\uCC3E\uAE30 \uD574\uC81C",
  notSet: "\uC124\uC815\uB418\uC9C0 \uC54A\uC74C",
  openHome: "\uD648 \uC5F4\uAE30",
  noFavorites: "\uC990\uACA8\uCC3E\uAE30\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  recentReading: "\uCD5C\uADFC \uC77D\uC740 \uB178\uD2B8",
  githubSync: "GitHub \uD06C\uB85C\uC2A4 \uD50C\uB7AB\uD3FC \uB3D9\uAE30\uD654",
  defaultBranch: "\uAE30\uBCF8 \uBE0C\uB79C\uCE58",
  searchPlaceholder: "\uD30C\uC77C \uC774\uB984\uACFC \uB178\uD2B8 \uB0B4\uC6A9 \uAC80\uC0C9\u2026",
  searching: "\uAC80\uC0C9 \uC911\u2026",
  searchResults: "\uAC80\uC0C9 \uACB0\uACFC({count})",
  noMatches: "\uC77C\uCE58\uD558\uB294 \uB178\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  back: "\uB4A4\uB85C",
  forward: "\uC55E\uC73C\uB85C",
  parentFolder: "\uC0C1\uC704 \uD3F4\uB354",
  vaultRoot: "Vault \uB8E8\uD2B8",
  rootFolder: "\uB8E8\uD2B8",
  itemCount: "{count}\uAC1C \uD56D\uBAA9",
  emptyFolder: "\uC774 \uD3F4\uB354\uB294 \uBE44\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.",
  readingHistory: "\uC77D\uAE30 \uAE30\uB85D({count})",
  noHistory: "\uC77D\uAE30 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  pageOutline: "\uC774 \uD398\uC774\uC9C0",
  noHeadings: "\uD604\uC7AC \uB178\uD2B8\uC5D0 \uC81C\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  focusEnabled: "\uC9D1\uC911 \uC77D\uAE30 \uBAA8\uB4DC\uAC00 \uD65C\uC131\uD654\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
  focusDisabled: "\uC9D1\uC911 \uC77D\uAE30 \uBAA8\uB4DC\uAC00 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
  syncAlreadyRunning: "\uB3D9\uAE30\uD654\uAC00 \uC774\uBBF8 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4.",
  alreadyInSync: "\uB85C\uCEEC\uACFC \uC6D0\uACA9\uC774 \uC774\uBBF8 \uB3D9\uAE30\uD654\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4",
  statusConnecting: "GitHub\uC5D0 \uC5F0\uACB0 \uC911\u2026",
  statusHashing: "\uB85C\uCEEC \uD30C\uC77C\uC744 \uD655\uC778 \uC911\u2026",
  statusReconciling: "\uB85C\uCEEC \uBC0F \uC6D0\uACA9 \uBCC0\uACBD \uC0AC\uD56D\uC744 \uBCD1\uD569 \uC911\u2026",
  statusComplete: "\uB3D9\uAE30\uD654 \uC644\uB8CC",
  quizDefinition: "\uD034\uC988 \uC815\uC758",
  quizDefinitionInvalid: "\uC798\uBABB\uB41C \uD034\uC988 \uC815\uC758",
  previousQuestion: "\uC774\uC804",
  nextQuestion: "\uB2E4\uC74C",
  rescore: "\uB2E4\uC2DC \uCC44\uC810",
  submit: "\uC81C\uCD9C",
  retryQuiz: "\uB2E4\uC2DC \uD480\uAE30",
  moveUp: "\uC704\uB85C",
  moveDown: "\uC544\uB798\uB85C",
  correct: "\uC815\uB2F5",
  notFullyCorrect: "\uC644\uC804\uD788 \uB9DE\uC9C0 \uC54A\uC74C",
  passed: "\uD1B5\uACFC",
  failed: "\uD1B5\uACFC\uD558\uC9C0 \uBABB\uD568"
};
var ES = {
  settingsIntro: "El panel, la b\xFAsqueda, los favoritos, el historial y los cuestionarios interactivos se guardan en los datos del complemento de este Vault.",
  language: "Idioma",
  languageDescription: "Elige el idioma de GitSync Portal. La opci\xF3n del sistema sigue el idioma seleccionado en Obsidian.",
  syncSection: "Sincronizaci\xF3n multiplataforma con GitHub",
  syncDescription: "Sincronizaci\xF3n bidireccional mediante la API REST de GitHub, sin depender del Git del sistema. Funciona en Android, iOS, Windows, macOS y Linux. La primera sincronizaci\xF3n conserva los archivos exclusivos de ambos lados; si una ruta entra en conflicto, se conserva la versi\xF3n m\xE1s reciente y la anterior se guarda como copia de conflicto.",
  githubTokenDescription: "Usa un token detallado limitado a este repositorio con Contents: Read and write. Obsidian SecretStorage evita que el token se guarde en data.json.",
  tokenSavedPlaceholder: "Guardado de forma segura; introduce otro token para reemplazarlo",
  clearToken: "Borrar token",
  repository: "Repositorio",
  repositoryDescription: "Formato: propietario/repositorio",
  branch: "Rama",
  branchDescription: "D\xE9jalo vac\xEDo para usar la rama predeterminada del repositorio.",
  autoDevice: "Detectar dispositivo autom\xE1ticamente",
  autoDeviceDescription: "Dispositivo actual: {device}. Al activarlo se usa el nombre correcto del sistema en cada plataforma.",
  deviceName: "Nombre del dispositivo",
  deviceNameAutoDescription: "Se obtiene de la plataforma actual. Desactiva la detecci\xF3n autom\xE1tica para personalizarlo.",
  deviceNameManualDescription: "Se utiliza en los mensajes de commit y en los nombres de las copias de conflicto.",
  testAndSync: "Probar y sincronizar",
  testConnection: "Probar conexi\xF3n",
  testing: "Probando\u2026",
  connectionSuccess: "Conexi\xF3n con GitHub correcta: {details}",
  connectionFailed: "Error de conexi\xF3n",
  syncNow: "Sincronizar ahora",
  syncNowLong: "Ejecutar sincronizaci\xF3n bidireccional",
  syncing: "Sincronizando\u2026",
  syncOnStartup: "Sincronizar al iniciar",
  syncOnStartupDescription: "Sincroniza una vez despu\xE9s de que Obsidian abra este Vault.",
  syncOnSave: "Sincronizar despu\xE9s de guardar",
  syncOnSaveDescription: "Sincroniza 30 segundos despu\xE9s de que cesen los cambios. La edici\xF3n continua solo activa una sincronizaci\xF3n.",
  periodicSync: "Sincronizaci\xF3n peri\xF3dica",
  periodicSyncDescription: "Solo se ejecuta mientras Obsidian est\xE1 activo. Los sistemas m\xF3viles no reactivan una aplicaci\xF3n suspendida en segundo plano.",
  syncInterval: "Intervalo de sincronizaci\xF3n (minutos)",
  syncIntervalDescription: "M\xEDnimo 5 minutos.",
  maxFileSize: "L\xEDmite por archivo (MB)",
  maxFileSizeDescription: "El valor predeterminado es 50 MB. La sincronizaci\xF3n se detiene en vez de omitir archivos demasiado grandes.",
  ignoredPaths: "Rutas ignoradas",
  ignoredPathsDescription: "Una ruta relativa al Vault o un glob por l\xEDnea. Las notas, temas, CSS, complementos y ajustes se sincronizan normalmente; el dise\xF1o del espacio de trabajo, la papelera, los datos internos de Git y el estado local permanecen en cada dispositivo.",
  obsidianGitWarning: "Este Vault tambi\xE9n tiene Obsidian Git activado. Desactiva su pull y backup autom\xE1ticos antes de activar la sincronizaci\xF3n autom\xE1tica para evitar que dos motores actualicen la misma rama.",
  homeNote: "Nota de inicio",
  homeNoteDescription: "Introduce la ruta Markdown completa dentro del Vault o usa el comando que establece la nota actual como inicio.",
  homeNotePlaceholder: "Ejemplo: Notas/Inicio.md",
  useCurrentNote: "Usar la nota actual",
  useCurrentNoteDescription: "Establece la nota Markdown abierta como nota de inicio.",
  setAsHome: "Establecer como inicio",
  openDashboardOnStartup: "Abrir el panel al iniciar",
  openDashboardOnStartupDescription: "Abre GitSync Portal en la barra lateral izquierda despu\xE9s de cargar el dise\xF1o de Obsidian.",
  historyLimit: "L\xEDmite del historial de lectura",
  historyLimitDescription: "Conserva las 10\u2013500 notas m\xE1s recientes.",
  readingDisplay: "Vista de lectura",
  bodyFontSize: "Tama\xF1o de letra del texto",
  bodyLineHeight: "Interlineado del texto",
  contentMaxWidth: "Anchura m\xE1xima del contenido",
  paragraphSpacing: "Espaciado entre p\xE1rrafos",
  dataManagement: "Gesti\xF3n de datos",
  clearHistory: "Borrar historial de lectura",
  clearHistoryDescription: "Hay {count} entradas guardadas. No se eliminar\xE1 ninguna nota.",
  clear: "Borrar",
  clearQuizProgress: "Borrar progreso de cuestionarios",
  clearQuizProgressDescription: "Elimina las respuestas y puntuaciones de Quizzable sin modificar las definiciones.",
  lastSync: "\xDAltima sincronizaci\xF3n: {date}; {summary}",
  never: "Nunca",
  notSynced: "A\xFAn no sincronizado",
  notesCount: "{count} notas",
  refresh: "Actualizar",
  tabHome: "Inicio",
  tabFiles: "Archivos",
  tabFavorites: "Favoritos",
  tabHistory: "Historial",
  currentNote: "Nota actual",
  favorite: "A\xF1adir a favoritos",
  unfavorite: "Quitar de favoritos",
  notSet: "Sin configurar",
  homeNoteHint: "Abre una nota y usa el bot\xF3n de inicio de la tarjeta de la nota actual.",
  openHome: "Abrir inicio",
  noFavorites: "Todav\xEDa no hay favoritos.",
  noFavoriteNotes: "Todav\xEDa no hay notas favoritas.",
  recentReading: "Lecturas recientes",
  recentReadingEmpty: "Las notas abiertas aparecer\xE1n aqu\xED.",
  githubSync: "Sincronizaci\xF3n multiplataforma con GitHub",
  defaultBranch: "Rama predeterminada",
  tokenMissing: "No hay ning\xFAn token de GitHub guardado. Abre primero los ajustes de GitSync Portal.",
  searchPlaceholder: "Buscar nombres y contenido de notas\u2026",
  searching: "Buscando\u2026",
  searchResults: "Resultados ({count})",
  noMatches: "No hay notas coincidentes.",
  back: "Atr\xE1s",
  forward: "Adelante",
  parentFolder: "Carpeta superior",
  vaultRoot: "Ra\xEDz del Vault",
  rootFolder: "Ra\xEDz",
  itemCount: "{count} elementos",
  emptyFolder: "Esta carpeta est\xE1 vac\xEDa.",
  readingHistory: "Historial de lectura ({count})",
  noHistory: "Todav\xEDa no hay historial de lectura.",
  pageOutline: "En esta p\xE1gina",
  noHeadings: "La nota actual no tiene encabezados.",
  focusEnabled: "Modo de lectura concentrada activado",
  focusDisabled: "Modo de lectura concentrada desactivado",
  syncAlreadyRunning: "Ya hay una sincronizaci\xF3n en curso.",
  syncSummary: "Descargados {pulled}, subidos {pushed}, eliminados {deleted}, conflictos {conflicts}",
  alreadyInSync: "El contenido local y remoto ya est\xE1 sincronizado",
  statusConnecting: "Conectando con GitHub\u2026",
  statusHashing: "Calculando huellas de archivos locales\u2026",
  statusReconciling: "Conciliando cambios locales y remotos\u2026",
  statusPulling: "Aplicando cambio remoto: {path}",
  statusPushing: "Subiendo cambio local: {path}",
  statusComplete: "Sincronizaci\xF3n completada",
  tokenRequired: "Guarda primero un token de GitHub en los ajustes de GitSync Portal.",
  tokenInvalid: "El token de GitHub no es v\xE1lido o ha caducado.",
  repositoryNotFound: "No se encontr\xF3 el repositorio, la rama o el commit. Comprueba el token y los ajustes.",
  repositoryFormat: "El repositorio debe usar el formato propietario/repositorio.",
  quizDefinition: "Definici\xF3n del cuestionario",
  quizDefinitionInvalid: "Definici\xF3n de cuestionario no v\xE1lida",
  previousQuestion: "Anterior",
  nextQuestion: "Siguiente",
  rescore: "Volver a puntuar",
  submit: "Enviar",
  retryQuiz: "Intentar de nuevo",
  moveUp: "Subir",
  moveDown: "Bajar",
  correct: "Correcto",
  notFullyCorrect: "No es completamente correcto",
  passed: "Aprobado",
  failed: "No aprobado"
};
var DE = {
  settingsIntro: "Dashboard, Suche, Favoriten, Verlauf und interaktive Quizze werden in den Plugin-Daten dieses Vaults gespeichert.",
  language: "Sprache",
  languageDescription: "W\xE4hle die Sprache von GitSync Portal. Die Systemeinstellung folgt der in Obsidian ausgew\xE4hlten Sprache.",
  syncSection: "Plattform\xFCbergreifende GitHub-Synchronisierung",
  syncDescription: "Bidirektionale Synchronisierung \xFCber die GitHub REST API ohne System-Git. Sie funktioniert unter Android, iOS, Windows, macOS und Linux. Beim ersten Abgleich bleiben Dateien beider Seiten erhalten; bei einem Pfadkonflikt gewinnt die neuere Version und die \xE4ltere wird als Konfliktkopie gespeichert.",
  githubTokenDescription: "Empfohlen wird ein auf dieses Repository begrenztes Fine-grained Token mit Contents: Read and write. Obsidian SecretStorage h\xE4lt das Token aus data.json heraus.",
  tokenSavedPlaceholder: "Sicher gespeichert; neues Token zum Ersetzen eingeben",
  clearToken: "Token l\xF6schen",
  repository: "Repository",
  repositoryDescription: "Format: Eigent\xFCmer/Repository",
  branch: "Branch",
  branchDescription: "Leer lassen, um den Standard-Branch des Repositorys zu verwenden.",
  autoDevice: "Ger\xE4t automatisch erkennen",
  autoDeviceDescription: "Aktuelles Ger\xE4t: {device}. Verwendet auf jeder Plattform den passenden Systemnamen.",
  deviceName: "Ger\xE4tename",
  deviceNameAutoDescription: "Wird von der aktuellen Plattform ausgef\xFCllt. Automatische Erkennung zum Anpassen ausschalten.",
  deviceNameManualDescription: "Wird in Commit-Nachrichten und Dateinamen von Konfliktkopien verwendet.",
  testAndSync: "Testen und synchronisieren",
  testConnection: "Verbindung testen",
  testing: "Wird getestet\u2026",
  connectionSuccess: "GitHub-Verbindung erfolgreich: {details}",
  connectionFailed: "Verbindung fehlgeschlagen",
  syncNow: "Jetzt synchronisieren",
  syncNowLong: "Bidirektionale Synchronisierung starten",
  syncing: "Wird synchronisiert\u2026",
  syncOnStartup: "Beim Start synchronisieren",
  syncOnStartupDescription: "Einmal synchronisieren, nachdem Obsidian diesen Vault ge\xF6ffnet hat.",
  syncOnSave: "Nach dem Speichern synchronisieren",
  syncOnSaveDescription: "30 Sekunden nach dem Ende von Datei\xE4nderungen synchronisieren. Fortlaufende Bearbeitung l\xF6st nur einen Abgleich aus.",
  periodicSync: "Regelm\xE4\xDFig synchronisieren",
  periodicSyncDescription: "Funktioniert nur, solange Obsidian aktiv ist. Mobile Systeme wecken eine angehaltene App nicht im Hintergrund.",
  syncInterval: "Synchronisierungsintervall (Minuten)",
  syncIntervalDescription: "Mindestens 5 Minuten.",
  maxFileSize: "Dateilimit (MB)",
  maxFileSizeDescription: "Standardm\xE4\xDFig 50 MB. Bei zu gro\xDFen Dateien wird der Abgleich gestoppt, statt sie still zu \xFCberspringen.",
  ignoredPaths: "Ignorierte Pfade",
  ignoredPathsDescription: "Ein Vault-relativer Pfad oder Glob pro Zeile. Notizen, Themes, CSS, Plugins und Einstellungen werden normal synchronisiert; Arbeitsbereich, Papierkorb, Git-Interna und lokaler Status bleiben ger\xE4tespezifisch.",
  obsidianGitWarning: "In diesem Vault ist auch Obsidian Git aktiviert. Deaktiviere dessen automatisches Pull/Backup, bevor die automatische Synchronisierung eingeschaltet wird.",
  homeNote: "Startnotiz",
  homeNoteDescription: "Vollst\xE4ndigen Markdown-Pfad im Vault eingeben oder die aktuelle Notiz per Befehl als Startnotiz festlegen.",
  homeNotePlaceholder: "Beispiel: Notizen/Start.md",
  useCurrentNote: "Aktuelle Notiz verwenden",
  useCurrentNoteDescription: "Die aktuell ge\xF6ffnete Markdown-Notiz als Startnotiz festlegen.",
  setAsHome: "Als Start festlegen",
  openDashboardOnStartup: "Dashboard beim Start \xF6ffnen",
  openDashboardOnStartupDescription: "GitSync Portal nach dem Laden des Obsidian-Layouts in der linken Seitenleiste \xF6ffnen.",
  historyLimit: "Limit des Leseverlaufs",
  historyLimitDescription: "Die 10\u2013500 zuletzt gelesenen Notizen behalten.",
  readingDisplay: "Leseansicht",
  bodyFontSize: "Textgr\xF6\xDFe",
  bodyLineHeight: "Zeilenh\xF6he",
  contentMaxWidth: "Maximale Inhaltsbreite",
  paragraphSpacing: "Absatzabstand",
  dataManagement: "Datenverwaltung",
  clearHistory: "Leseverlauf l\xF6schen",
  clearHistoryDescription: "{count} Eintr\xE4ge sind gespeichert. Es werden keine Notizen gel\xF6scht.",
  clear: "L\xF6schen",
  clearQuizProgress: "Quizfortschritt l\xF6schen",
  clearQuizProgressDescription: "Alle Quizzable-Antworten und Bewertungen entfernen, ohne die Quizdefinitionen zu \xE4ndern.",
  lastSync: "Letzte Synchronisierung: {date}; {summary}",
  never: "Nie",
  notSynced: "Noch nicht synchronisiert",
  notesCount: "{count} Notizen",
  refresh: "Aktualisieren",
  tabHome: "Start",
  tabFiles: "Dateien",
  tabFavorites: "Favoriten",
  tabHistory: "Verlauf",
  currentNote: "Aktuelle Notiz",
  favorite: "Favorisieren",
  unfavorite: "Favorit entfernen",
  notSet: "Nicht festgelegt",
  openHome: "Start \xF6ffnen",
  noFavorites: "Noch keine Favoriten.",
  recentReading: "Zuletzt gelesen",
  githubSync: "Plattform\xFCbergreifende GitHub-Synchronisierung",
  defaultBranch: "Standard-Branch",
  searchPlaceholder: "Dateinamen und Notizinhalte durchsuchen\u2026",
  searching: "Suche l\xE4uft\u2026",
  searchResults: "Suchergebnisse ({count})",
  noMatches: "Keine passenden Notizen.",
  back: "Zur\xFCck",
  forward: "Vorw\xE4rts",
  parentFolder: "\xDCbergeordneter Ordner",
  vaultRoot: "Vault-Stammordner",
  rootFolder: "Stammordner",
  itemCount: "{count} Elemente",
  emptyFolder: "Dieser Ordner ist leer.",
  readingHistory: "Leseverlauf ({count})",
  noHistory: "Noch kein Leseverlauf.",
  pageOutline: "Auf dieser Seite",
  noHeadings: "Die aktuelle Notiz enth\xE4lt keine \xDCberschriften.",
  focusEnabled: "Fokussierter Lesemodus aktiviert",
  focusDisabled: "Fokussierter Lesemodus deaktiviert",
  syncAlreadyRunning: "Eine Synchronisierung l\xE4uft bereits.",
  syncSummary: "Abgerufen {pulled}, hochgeladen {pushed}, gel\xF6scht {deleted}, Konflikte {conflicts}",
  alreadyInSync: "Lokale und entfernte Daten sind bereits synchron",
  statusConnecting: "Verbindung mit GitHub wird hergestellt\u2026",
  statusHashing: "Lokale Dateifingerabdr\xFCcke werden berechnet\u2026",
  statusReconciling: "Lokale und entfernte \xC4nderungen werden abgeglichen\u2026",
  statusPulling: "Entfernte \xC4nderung wird angewendet: {path}",
  statusPushing: "Lokale \xC4nderung wird hochgeladen: {path}",
  statusComplete: "Synchronisierung abgeschlossen",
  tokenRequired: "Speichere zuerst ein GitHub-Token in den Einstellungen von GitSync Portal.",
  tokenInvalid: "Das GitHub-Token ist ung\xFCltig oder abgelaufen.",
  repositoryNotFound: "Repository, Branch oder Commit nicht gefunden. Token und Einstellungen pr\xFCfen.",
  repositoryFormat: "Das Repository muss das Format Eigent\xFCmer/Repository verwenden.",
  quizDefinition: "Quizdefinition",
  quizDefinitionInvalid: "Ung\xFCltige Quizdefinition",
  previousQuestion: "Zur\xFCck",
  nextQuestion: "Weiter",
  rescore: "Neu bewerten",
  submit: "Absenden",
  retryQuiz: "Erneut versuchen",
  moveUp: "Nach oben",
  moveDown: "Nach unten",
  correct: "Richtig",
  notFullyCorrect: "Nicht vollst\xE4ndig richtig",
  passed: "Bestanden",
  failed: "Nicht bestanden"
};
var IT = {
  settingsIntro: "Dashboard, ricerca, preferiti, cronologia e quiz interattivi vengono salvati nei dati del plugin di questo Vault.",
  language: "Lingua",
  languageDescription: "Scegli la lingua di GitSync Portal. L'impostazione di sistema segue la lingua selezionata in Obsidian.",
  syncSection: "Sincronizzazione GitHub multipiattaforma",
  syncDescription: "Sincronizzazione bidirezionale tramite API REST di GitHub senza usare Git di sistema. Funziona su Android, iOS, Windows, macOS e Linux. La prima sincronizzazione conserva i file presenti su un solo lato; in caso di conflitto sullo stesso percorso, prevale la versione pi\xF9 recente e quella precedente viene salvata come copia di conflitto.",
  githubTokenDescription: "Usa un fine-grained token limitato a questo repository con Contents: Read and write. Obsidian SecretStorage impedisce che il token venga scritto in data.json.",
  tokenSavedPlaceholder: "Salvato in modo sicuro; inserisci un nuovo token per sostituirlo",
  clearToken: "Cancella token",
  repository: "Repository",
  repositoryDescription: "Formato: proprietario/repository",
  branch: "Branch",
  branchDescription: "Lascia vuoto per usare il branch predefinito del repository.",
  autoDevice: "Rileva automaticamente il dispositivo",
  autoDeviceDescription: "Dispositivo attuale: {device}. Se attivo, usa il nome di sistema corretto su ogni piattaforma.",
  deviceName: "Nome dispositivo",
  deviceNameAutoDescription: "Compilato dalla piattaforma attuale. Disattiva il rilevamento automatico per personalizzarlo.",
  deviceNameManualDescription: "Usato nei messaggi di commit e nei nomi delle copie di conflitto.",
  testAndSync: "Test e sincronizzazione",
  testConnection: "Verifica connessione",
  testing: "Verifica in corso\u2026",
  connectionSuccess: "Connessione GitHub riuscita: {details}",
  connectionFailed: "Connessione non riuscita",
  syncNow: "Sincronizza ora",
  syncNowLong: "Avvia sincronizzazione bidirezionale",
  syncing: "Sincronizzazione\u2026",
  syncOnStartup: "Sincronizza all'avvio",
  syncOnStartupDescription: "Sincronizza una volta dopo l'apertura di questo Vault in Obsidian.",
  syncOnSave: "Sincronizza dopo il salvataggio",
  syncOnSaveDescription: "Sincronizza 30 secondi dopo la fine delle modifiche. Le modifiche continue attivano una sola sincronizzazione.",
  periodicSync: "Sincronizzazione periodica",
  periodicSyncDescription: "Funziona solo mentre Obsidian \xE8 attivo. I sistemi mobili non riattivano in background un'app sospesa.",
  syncInterval: "Intervallo di sincronizzazione (minuti)",
  syncIntervalDescription: "Minimo 5 minuti.",
  maxFileSize: "Limite per file (MB)",
  maxFileSizeDescription: "Predefinito 50 MB. La sincronizzazione si arresta invece di ignorare silenziosamente i file troppo grandi.",
  ignoredPaths: "Percorsi ignorati",
  ignoredPathsDescription: "Un percorso relativo al Vault o un glob per riga. Note, temi, CSS, plugin e impostazioni vengono sincronizzati normalmente; layout, cestino, dati Git e stato locale restano specifici del dispositivo.",
  obsidianGitWarning: "In questo Vault \xE8 attivo anche Obsidian Git. Disattiva pull e backup automatici prima di attivare la sincronizzazione automatica.",
  homeNote: "Nota iniziale",
  homeNoteDescription: "Inserisci il percorso Markdown completo nel Vault oppure usa il comando per impostare la nota corrente come iniziale.",
  homeNotePlaceholder: "Esempio: Note/Home.md",
  useCurrentNote: "Usa la nota corrente",
  useCurrentNoteDescription: "Imposta la nota Markdown aperta come nota iniziale.",
  setAsHome: "Imposta come iniziale",
  openDashboardOnStartup: "Apri dashboard all'avvio",
  openDashboardOnStartupDescription: "Apre GitSync Portal nella barra laterale sinistra dopo il caricamento del layout di Obsidian.",
  historyLimit: "Limite cronologia di lettura",
  historyLimitDescription: "Conserva le 10\u2013500 note pi\xF9 recenti.",
  readingDisplay: "Visualizzazione di lettura",
  bodyFontSize: "Dimensione testo",
  bodyLineHeight: "Interlinea",
  contentMaxWidth: "Larghezza massima contenuto",
  paragraphSpacing: "Spaziatura paragrafi",
  dataManagement: "Gestione dati",
  clearHistory: "Cancella cronologia di lettura",
  clearHistoryDescription: "Sono salvate {count} voci. Nessuna nota verr\xE0 eliminata.",
  clear: "Cancella",
  clearQuizProgress: "Cancella progresso quiz",
  clearQuizProgressDescription: "Rimuove risposte e punteggi di Quizzable senza modificare le definizioni.",
  lastSync: "Ultima sincronizzazione: {date}; {summary}",
  never: "Mai",
  notSynced: "Non ancora sincronizzato",
  notesCount: "{count} note",
  refresh: "Aggiorna",
  tabHome: "Home",
  tabFiles: "File",
  tabFavorites: "Preferiti",
  tabHistory: "Cronologia",
  currentNote: "Nota corrente",
  favorite: "Aggiungi ai preferiti",
  unfavorite: "Rimuovi dai preferiti",
  notSet: "Non impostata",
  openHome: "Apri home",
  noFavorites: "Nessun preferito.",
  recentReading: "Letture recenti",
  githubSync: "Sincronizzazione GitHub multipiattaforma",
  defaultBranch: "Branch predefinito",
  searchPlaceholder: "Cerca nomi e contenuti delle note\u2026",
  searching: "Ricerca\u2026",
  searchResults: "Risultati ({count})",
  noMatches: "Nessuna nota corrispondente.",
  back: "Indietro",
  forward: "Avanti",
  parentFolder: "Cartella superiore",
  vaultRoot: "Radice del Vault",
  rootFolder: "Radice",
  itemCount: "{count} elementi",
  emptyFolder: "Questa cartella \xE8 vuota.",
  readingHistory: "Cronologia di lettura ({count})",
  noHistory: "Nessuna cronologia di lettura.",
  pageOutline: "In questa pagina",
  noHeadings: "La nota corrente non contiene intestazioni.",
  focusEnabled: "Modalit\xE0 lettura concentrata attivata",
  focusDisabled: "Modalit\xE0 lettura concentrata disattivata",
  syncAlreadyRunning: "\xC8 gi\xE0 in corso una sincronizzazione.",
  syncSummary: "Scaricati {pulled}, caricati {pushed}, eliminati {deleted}, conflitti {conflicts}",
  alreadyInSync: "I dati locali e remoti sono gi\xE0 sincronizzati",
  statusConnecting: "Connessione a GitHub\u2026",
  statusHashing: "Calcolo impronte dei file locali\u2026",
  statusReconciling: "Unione delle modifiche locali e remote\u2026",
  statusPulling: "Applicazione modifica remota: {path}",
  statusPushing: "Caricamento modifica locale: {path}",
  statusComplete: "Sincronizzazione completata",
  tokenRequired: "Salva prima un token GitHub nelle impostazioni di GitSync Portal.",
  tokenInvalid: "Il token GitHub non \xE8 valido o \xE8 scaduto.",
  repositoryNotFound: "Repository, branch o commit non trovato. Controlla token e impostazioni.",
  repositoryFormat: "Il repository deve usare il formato proprietario/repository.",
  quizDefinition: "Definizione quiz",
  quizDefinitionInvalid: "Definizione quiz non valida",
  previousQuestion: "Precedente",
  nextQuestion: "Successiva",
  rescore: "Ricalcola punteggio",
  submit: "Invia",
  retryQuiz: "Riprova",
  moveUp: "Sposta su",
  moveDown: "Sposta gi\xF9",
  correct: "Corretto",
  notFullyCorrect: "Non completamente corretto",
  passed: "Superato",
  failed: "Non superato"
};
var FR = {
  language: "Langue",
  languageDescription: "Choisissez la langue de GitSync Portal. Le r\xE9glage syst\xE8me suit la langue s\xE9lectionn\xE9e dans Obsidian.",
  syncSection: "Synchronisation GitHub multiplateforme",
  repository: "D\xE9p\xF4t",
  branch: "Branche",
  deviceName: "Nom de l\u2019appareil",
  testAndSync: "Tester et synchroniser",
  testConnection: "Tester la connexion",
  testing: "Test en cours\u2026",
  syncNow: "Synchroniser",
  syncing: "Synchronisation\u2026",
  syncOnStartup: "Synchroniser au d\xE9marrage",
  syncOnSave: "Synchroniser apr\xE8s l\u2019enregistrement",
  periodicSync: "Synchronisation p\xE9riodique",
  syncInterval: "Intervalle de synchronisation (minutes)",
  ignoredPaths: "Chemins ignor\xE9s",
  homeNote: "Note d\u2019accueil",
  setAsHome: "D\xE9finir comme accueil",
  readingDisplay: "Affichage de lecture",
  dataManagement: "Gestion des donn\xE9es",
  clear: "Effacer",
  never: "Jamais",
  notSynced: "Pas encore synchronis\xE9",
  tabHome: "Accueil",
  tabFiles: "Fichiers",
  tabFavorites: "Favoris",
  tabHistory: "Historique",
  currentNote: "Note actuelle",
  searchPlaceholder: "Rechercher dans les noms et le contenu\u2026",
  searching: "Recherche\u2026",
  noMatches: "Aucune note correspondante.",
  back: "Retour",
  forward: "Suivant",
  parentFolder: "Dossier parent",
  rootFolder: "Racine",
  pageOutline: "Sur cette page",
  githubSync: "Synchronisation GitHub multiplateforme",
  statusConnecting: "Connexion \xE0 GitHub\u2026",
  statusComplete: "Synchronisation termin\xE9e"
};
var AR = {
  language: "\u0627\u0644\u0644\u063A\u0629",
  languageDescription: "\u0627\u062E\u062A\u0631 \u0644\u063A\u0629 GitSync Portal. \u064A\u062A\u0628\u0639 \u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0641\u064A Obsidian.",
  syncSection: "\u0645\u0632\u0627\u0645\u0646\u0629 GitHub \u0639\u0628\u0631 \u0627\u0644\u0645\u0646\u0635\u0627\u062A",
  repository: "\u0627\u0644\u0645\u0633\u062A\u0648\u062F\u0639",
  branch: "\u0627\u0644\u0641\u0631\u0639",
  deviceName: "\u0627\u0633\u0645 \u0627\u0644\u062C\u0647\u0627\u0632",
  testAndSync: "\u0627\u062E\u062A\u0628\u0627\u0631 \u0648\u0645\u0632\u0627\u0645\u0646\u0629",
  testConnection: "\u0627\u062E\u062A\u0628\u0627\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644",
  syncNow: "\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0622\u0646",
  syncing: "\u062C\u0627\u0631\u064D \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629\u2026",
  syncOnStartup: "\u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0639\u0646\u062F \u0627\u0644\u062A\u0634\u063A\u064A\u0644",
  syncOnSave: "\u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0628\u0639\u062F \u0627\u0644\u062D\u0641\u0638",
  periodicSync: "\u0645\u0632\u0627\u0645\u0646\u0629 \u062F\u0648\u0631\u064A\u0629",
  ignoredPaths: "\u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u062A\u062C\u0627\u0647\u0644\u0629",
  homeNote: "\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u0635\u0641\u062D\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629",
  readingDisplay: "\u0639\u0631\u0636 \u0627\u0644\u0642\u0631\u0627\u0621\u0629",
  dataManagement: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A",
  clear: "\u0645\u0633\u062D",
  never: "\u0623\u0628\u062F\u064B\u0627",
  tabHome: "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629",
  tabFiles: "\u0627\u0644\u0645\u0644\u0641\u0627\u062A",
  tabFavorites: "\u0627\u0644\u0645\u0641\u0636\u0644\u0629",
  tabHistory: "\u0627\u0644\u0633\u062C\u0644",
  currentNote: "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629",
  searchPlaceholder: "\u0627\u0644\u0628\u062D\u062B \u0641\u064A \u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0648\u0627\u0644\u0645\u062D\u062A\u0648\u0649\u2026",
  searching: "\u062C\u0627\u0631\u064D \u0627\u0644\u0628\u062D\u062B\u2026",
  noMatches: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0645\u0637\u0627\u0628\u0642\u0629.",
  back: "\u0631\u062C\u0648\u0639",
  forward: "\u062A\u0642\u062F\u0645",
  parentFolder: "\u0627\u0644\u0645\u062C\u0644\u062F \u0627\u0644\u0623\u0635\u0644",
  rootFolder: "\u0627\u0644\u062C\u0630\u0631",
  githubSync: "\u0645\u0632\u0627\u0645\u0646\u0629 GitHub \u0639\u0628\u0631 \u0627\u0644\u0645\u0646\u0635\u0627\u062A"
};
var BN = {
  language: "\u09AD\u09BE\u09B7\u09BE",
  languageDescription: "GitSync Portal-\u098F\u09B0 \u09AD\u09BE\u09B7\u09BE \u09AC\u09C7\u099B\u09C7 \u09A8\u09BF\u09A8\u0964 \u09B8\u09BF\u09B8\u09CD\u099F\u09C7\u09AE \u09A1\u09BF\u09AB\u09B2\u09CD\u099F Obsidian-\u098F \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09BF\u09A4 \u09AD\u09BE\u09B7\u09BE \u0985\u09A8\u09C1\u09B8\u09B0\u09A3 \u0995\u09B0\u09C7\u0964",
  syncSection: "\u0995\u09CD\u09B0\u09B8-\u09AA\u09CD\u09B2\u09CD\u09AF\u09BE\u099F\u09AB\u09B0\u09CD\u09AE GitHub \u09B8\u09BF\u0999\u09CD\u0995",
  repository: "\u09B0\u09BF\u09AA\u09CB\u099C\u09BF\u099F\u09B0\u09BF",
  branch: "\u09AC\u09CD\u09B0\u09BE\u099E\u09CD\u099A",
  deviceName: "\u09A1\u09BF\u09AD\u09BE\u0987\u09B8\u09C7\u09B0 \u09A8\u09BE\u09AE",
  testAndSync: "\u09AA\u09B0\u09C0\u0995\u09CD\u09B7\u09BE \u0993 \u09B8\u09BF\u0999\u09CD\u0995",
  testConnection: "\u09B8\u0982\u09AF\u09CB\u0997 \u09AA\u09B0\u09C0\u0995\u09CD\u09B7\u09BE",
  syncNow: "\u098F\u0996\u09A8 \u09B8\u09BF\u0999\u09CD\u0995",
  syncing: "\u09B8\u09BF\u0999\u09CD\u0995 \u09B9\u099A\u09CD\u099B\u09C7\u2026",
  syncOnStartup: "\u099A\u09BE\u09B2\u09C1\u09B0 \u09B8\u09AE\u09AF\u09BC \u09B8\u09BF\u0999\u09CD\u0995",
  syncOnSave: "\u09B8\u09C7\u09AD\u09C7\u09B0 \u09AA\u09B0\u09C7 \u09B8\u09BF\u0999\u09CD\u0995",
  periodicSync: "\u09A8\u09BF\u09AF\u09BC\u09AE\u09BF\u09A4 \u09B8\u09BF\u0999\u09CD\u0995",
  ignoredPaths: "\u0989\u09AA\u09C7\u0995\u09CD\u09B7\u09BF\u09A4 \u09AA\u09BE\u09A5",
  homeNote: "\u09B9\u09CB\u09AE \u09A8\u09CB\u099F",
  readingDisplay: "\u09B0\u09BF\u09A1\u09BF\u0982 \u09AA\u09CD\u09B0\u09A6\u09B0\u09CD\u09B6\u09A8",
  dataManagement: "\u09A1\u09C7\u099F\u09BE \u09AC\u09CD\u09AF\u09AC\u09B8\u09CD\u09A5\u09BE\u09AA\u09A8\u09BE",
  clear: "\u09AE\u09C1\u099B\u09C1\u09A8",
  never: "\u0995\u0996\u09A8\u0993 \u09A8\u09AF\u09BC",
  tabHome: "\u09B9\u09CB\u09AE",
  tabFiles: "\u09AB\u09BE\u0987\u09B2",
  tabFavorites: "\u09AA\u099B\u09A8\u09CD\u09A6",
  tabHistory: "\u0987\u09A4\u09BF\u09B9\u09BE\u09B8",
  currentNote: "\u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09A8\u09CB\u099F",
  searchPlaceholder: "\u09AB\u09BE\u0987\u09B2\u09C7\u09B0 \u09A8\u09BE\u09AE \u0993 \u09A8\u09CB\u099F\u09C7\u09B0 \u09AC\u09BF\u09B7\u09AF\u09BC\u09AC\u09B8\u09CD\u09A4\u09C1 \u0996\u09C1\u0981\u099C\u09C1\u09A8\u2026",
  searching: "\u0996\u09CB\u0981\u099C\u09BE \u09B9\u099A\u09CD\u099B\u09C7\u2026",
  noMatches: "\u09AE\u09BF\u09B2 \u0986\u099B\u09C7 \u098F\u09AE\u09A8 \u09A8\u09CB\u099F \u09A8\u09C7\u0987\u0964",
  back: "\u09AA\u09C7\u099B\u09A8\u09C7",
  forward: "\u09B8\u09BE\u09AE\u09A8\u09C7",
  parentFolder: "\u09AE\u09C2\u09B2 \u09AB\u09CB\u09B2\u09CD\u09A1\u09BE\u09B0",
  rootFolder: "\u09B0\u09C1\u099F",
  githubSync: "\u0995\u09CD\u09B0\u09B8-\u09AA\u09CD\u09B2\u09CD\u09AF\u09BE\u099F\u09AB\u09B0\u09CD\u09AE GitHub \u09B8\u09BF\u0999\u09CD\u0995"
};
var NL = {
  language: "Taal",
  languageDescription: "Kies de taal van GitSync Portal. De systeeminstelling volgt de taal die in Obsidian is gekozen.",
  syncSection: "Platformonafhankelijke GitHub-synchronisatie",
  repository: "Repository",
  branch: "Branch",
  deviceName: "Apparaatnaam",
  testAndSync: "Testen en synchroniseren",
  testConnection: "Verbinding testen",
  syncNow: "Nu synchroniseren",
  syncing: "Synchroniseren\u2026",
  syncOnStartup: "Synchroniseren bij opstarten",
  syncOnSave: "Synchroniseren na opslaan",
  periodicSync: "Periodiek synchroniseren",
  ignoredPaths: "Genegeerde paden",
  homeNote: "Startnotitie",
  readingDisplay: "Leesweergave",
  dataManagement: "Gegevensbeheer",
  clear: "Wissen",
  never: "Nooit",
  tabHome: "Start",
  tabFiles: "Bestanden",
  tabFavorites: "Favorieten",
  tabHistory: "Geschiedenis",
  currentNote: "Huidige notitie",
  searchPlaceholder: "Zoek in bestandsnamen en notities\u2026",
  searching: "Zoeken\u2026",
  noMatches: "Geen overeenkomende notities.",
  back: "Terug",
  forward: "Vooruit",
  parentFolder: "Bovenliggende map",
  rootFolder: "Hoofdmap",
  githubSync: "Platformonafhankelijke GitHub-synchronisatie"
};
var PL = {
  language: "J\u0119zyk",
  languageDescription: "Wybierz j\u0119zyk GitSync Portal. Ustawienie systemowe u\u017Cywa j\u0119zyka wybranego w Obsidian.",
  syncSection: "Wieloplatformowa synchronizacja GitHub",
  repository: "Repozytorium",
  branch: "Ga\u0142\u0105\u017A",
  deviceName: "Nazwa urz\u0105dzenia",
  testAndSync: "Testuj i synchronizuj",
  testConnection: "Testuj po\u0142\u0105czenie",
  syncNow: "Synchronizuj teraz",
  syncing: "Synchronizacja\u2026",
  syncOnStartup: "Synchronizuj przy uruchomieniu",
  syncOnSave: "Synchronizuj po zapisaniu",
  periodicSync: "Synchronizacja okresowa",
  ignoredPaths: "Ignorowane \u015Bcie\u017Cki",
  homeNote: "Notatka startowa",
  readingDisplay: "Widok czytania",
  dataManagement: "Zarz\u0105dzanie danymi",
  clear: "Wyczy\u015B\u0107",
  never: "Nigdy",
  tabHome: "Start",
  tabFiles: "Pliki",
  tabFavorites: "Ulubione",
  tabHistory: "Historia",
  currentNote: "Bie\u017C\u0105ca notatka",
  searchPlaceholder: "Szukaj nazw plik\xF3w i tre\u015Bci notatek\u2026",
  searching: "Wyszukiwanie\u2026",
  noMatches: "Brak pasuj\u0105cych notatek.",
  back: "Wstecz",
  forward: "Dalej",
  parentFolder: "Folder nadrz\u0119dny",
  rootFolder: "Katalog g\u0142\xF3wny",
  githubSync: "Wieloplatformowa synchronizacja GitHub"
};
var PT = {
  language: "Idioma",
  languageDescription: "Escolha o idioma do GitSync Portal. A op\xE7\xE3o do sistema segue o idioma selecionado no Obsidian.",
  syncSection: "Sincroniza\xE7\xE3o GitHub multiplataforma",
  repository: "Reposit\xF3rio",
  branch: "Branch",
  deviceName: "Nome do dispositivo",
  testAndSync: "Testar e sincronizar",
  testConnection: "Testar liga\xE7\xE3o",
  syncNow: "Sincronizar agora",
  syncing: "A sincronizar\u2026",
  syncOnStartup: "Sincronizar ao iniciar",
  syncOnSave: "Sincronizar ap\xF3s guardar",
  periodicSync: "Sincroniza\xE7\xE3o peri\xF3dica",
  ignoredPaths: "Caminhos ignorados",
  homeNote: "Nota inicial",
  readingDisplay: "Visualiza\xE7\xE3o de leitura",
  dataManagement: "Gest\xE3o de dados",
  clear: "Limpar",
  never: "Nunca",
  tabHome: "In\xEDcio",
  tabFiles: "Ficheiros",
  tabFavorites: "Favoritos",
  tabHistory: "Hist\xF3rico",
  currentNote: "Nota atual",
  searchPlaceholder: "Pesquisar nomes e conte\xFAdo das notas\u2026",
  searching: "A pesquisar\u2026",
  noMatches: "Nenhuma nota correspondente.",
  back: "Voltar",
  forward: "Avan\xE7ar",
  parentFolder: "Pasta superior",
  rootFolder: "Raiz",
  githubSync: "Sincroniza\xE7\xE3o GitHub multiplataforma"
};
var PT_BR = {
  ...PT,
  testConnection: "Testar conex\xE3o",
  syncOnSave: "Sincronizar depois de salvar",
  homeNote: "Nota inicial",
  tabFiles: "Arquivos",
  searchPlaceholder: "Pesquisar nomes de arquivos e conte\xFAdo das notas\u2026",
  parentFolder: "Pasta pai"
};
var RO = {
  language: "Limb\u0103",
  languageDescription: "Alege limba GitSync Portal. Setarea sistemului urmeaz\u0103 limba selectat\u0103 \xEEn Obsidian.",
  syncSection: "Sincronizare GitHub multiplatform\u0103",
  repository: "Repository",
  branch: "Ramur\u0103",
  deviceName: "Numele dispozitivului",
  testAndSync: "Testeaz\u0103 \u0219i sincronizeaz\u0103",
  testConnection: "Testeaz\u0103 conexiunea",
  syncNow: "Sincronizeaz\u0103 acum",
  syncing: "Se sincronizeaz\u0103\u2026",
  syncOnStartup: "Sincronizare la pornire",
  syncOnSave: "Sincronizare dup\u0103 salvare",
  periodicSync: "Sincronizare periodic\u0103",
  ignoredPaths: "C\u0103i ignorate",
  homeNote: "Not\u0103 principal\u0103",
  readingDisplay: "Afi\u0219are pentru citire",
  dataManagement: "Gestionarea datelor",
  clear: "\u0218terge",
  never: "Niciodat\u0103",
  tabHome: "Acas\u0103",
  tabFiles: "Fi\u0219iere",
  tabFavorites: "Favorite",
  tabHistory: "Istoric",
  currentNote: "Nota curent\u0103",
  searchPlaceholder: "Caut\u0103 nume de fi\u0219iere \u0219i con\u021Binut\u2026",
  searching: "Se caut\u0103\u2026",
  noMatches: "Nu exist\u0103 note potrivite.",
  back: "\xCEnapoi",
  forward: "\xCEnainte",
  parentFolder: "Dosar p\u0103rinte",
  rootFolder: "R\u0103d\u0103cin\u0103",
  githubSync: "Sincronizare GitHub multiplatform\u0103"
};
var RU = {
  language: "\u042F\u0437\u044B\u043A",
  languageDescription: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u044F\u0437\u044B\u043A GitSync Portal. \u0421\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442 \u044F\u0437\u044B\u043A, \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0432 Obsidian.",
  syncSection: "\u041A\u0440\u043E\u0441\u0441\u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0435\u043D\u043D\u0430\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F GitHub",
  repository: "\u0420\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0438\u0439",
  branch: "\u0412\u0435\u0442\u043A\u0430",
  deviceName: "\u0418\u043C\u044F \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430",
  testAndSync: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0438 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F",
  testConnection: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435",
  syncNow: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  syncing: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F\u2026",
  syncOnStartup: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u0440\u0438 \u0437\u0430\u043F\u0443\u0441\u043A\u0435",
  syncOnSave: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F",
  periodicSync: "\u041F\u0435\u0440\u0438\u043E\u0434\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F",
  ignoredPaths: "\u0418\u0433\u043D\u043E\u0440\u0438\u0440\u0443\u0435\u043C\u044B\u0435 \u043F\u0443\u0442\u0438",
  homeNote: "\u0414\u043E\u043C\u0430\u0448\u043D\u044F\u044F \u0437\u0430\u043C\u0435\u0442\u043A\u0430",
  readingDisplay: "\u0420\u0435\u0436\u0438\u043C \u0447\u0442\u0435\u043D\u0438\u044F",
  dataManagement: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u043C\u0438",
  clear: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C",
  never: "\u041D\u0438\u043A\u043E\u0433\u0434\u0430",
  tabHome: "\u0413\u043B\u0430\u0432\u043D\u0430\u044F",
  tabFiles: "\u0424\u0430\u0439\u043B\u044B",
  tabFavorites: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435",
  tabHistory: "\u0418\u0441\u0442\u043E\u0440\u0438\u044F",
  currentNote: "\u0422\u0435\u043A\u0443\u0449\u0430\u044F \u0437\u0430\u043C\u0435\u0442\u043A\u0430",
  searchPlaceholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0438\u043C\u0435\u043D\u0430\u043C \u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u043C\u0443 \u0437\u0430\u043C\u0435\u0442\u043E\u043A\u2026",
  searching: "\u041F\u043E\u0438\u0441\u043A\u2026",
  noMatches: "\u041F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0445 \u0437\u0430\u043C\u0435\u0442\u043E\u043A \u043D\u0435\u0442.",
  back: "\u041D\u0430\u0437\u0430\u0434",
  forward: "\u0412\u043F\u0435\u0440\u0451\u0434",
  parentFolder: "\u0420\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u0441\u043A\u0430\u044F \u043F\u0430\u043F\u043A\u0430",
  rootFolder: "\u041A\u043E\u0440\u0435\u043D\u044C",
  githubSync: "\u041A\u0440\u043E\u0441\u0441\u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0435\u043D\u043D\u0430\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F GitHub"
};
var SV = {
  language: "Spr\xE5k",
  languageDescription: "V\xE4lj spr\xE5k f\xF6r GitSync Portal. Systeminst\xE4llningen f\xF6ljer spr\xE5ket som valts i Obsidian.",
  syncSection: "Plattformsoberoende GitHub-synkronisering",
  repository: "Katalog",
  branch: "Gren",
  deviceName: "Enhetsnamn",
  testAndSync: "Testa och synkronisera",
  testConnection: "Testa anslutning",
  syncNow: "Synkronisera nu",
  syncing: "Synkroniserar\u2026",
  syncOnStartup: "Synkronisera vid start",
  syncOnSave: "Synkronisera efter sparande",
  periodicSync: "Periodisk synkronisering",
  ignoredPaths: "Ignorerade s\xF6kv\xE4gar",
  homeNote: "Hemanteckning",
  readingDisplay: "L\xE4svy",
  dataManagement: "Datahantering",
  clear: "Rensa",
  never: "Aldrig",
  tabHome: "Hem",
  tabFiles: "Filer",
  tabFavorites: "Favoriter",
  tabHistory: "Historik",
  currentNote: "Aktuell anteckning",
  searchPlaceholder: "S\xF6k i filnamn och anteckningar\u2026",
  searching: "S\xF6ker\u2026",
  noMatches: "Inga matchande anteckningar.",
  back: "Bak\xE5t",
  forward: "Fram\xE5t",
  parentFolder: "\xD6verordnad mapp",
  rootFolder: "Rot",
  githubSync: "Plattformsoberoende GitHub-synkronisering"
};
var TR = {
  language: "Dil",
  languageDescription: "GitSync Portal dilini se\xE7in. Sistem se\xE7ene\u011Fi Obsidian'da se\xE7ili dili izler.",
  syncSection: "Platformlar aras\u0131 GitHub e\u015Fitleme",
  repository: "Depo",
  branch: "Dal",
  deviceName: "Cihaz ad\u0131",
  testAndSync: "Test et ve e\u015Fitle",
  testConnection: "Ba\u011Flant\u0131y\u0131 test et",
  syncNow: "\u015Eimdi e\u015Fitle",
  syncing: "E\u015Fitleniyor\u2026",
  syncOnStartup: "Ba\u015Flang\u0131\xE7ta e\u015Fitle",
  syncOnSave: "Kaydettikten sonra e\u015Fitle",
  periodicSync: "Periyodik e\u015Fitleme",
  ignoredPaths: "Yok say\u0131lan yollar",
  homeNote: "Ana not",
  readingDisplay: "Okuma g\xF6r\xFCn\xFCm\xFC",
  dataManagement: "Veri y\xF6netimi",
  clear: "Temizle",
  never: "Asla",
  tabHome: "Ana sayfa",
  tabFiles: "Dosyalar",
  tabFavorites: "Favoriler",
  tabHistory: "Ge\xE7mi\u015F",
  currentNote: "Ge\xE7erli not",
  searchPlaceholder: "Dosya adlar\u0131nda ve notlarda ara\u2026",
  searching: "Aran\u0131yor\u2026",
  noMatches: "E\u015Fle\u015Fen not yok.",
  back: "Geri",
  forward: "\u0130leri",
  parentFolder: "\xDCst klas\xF6r",
  rootFolder: "K\xF6k",
  githubSync: "Platformlar aras\u0131 GitHub e\u015Fitleme"
};
var UK = {
  language: "\u041C\u043E\u0432\u0430",
  languageDescription: "\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u043C\u043E\u0432\u0443 GitSync Portal. \u0421\u0438\u0441\u0442\u0435\u043C\u043D\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043D\u0442 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454 \u043C\u043E\u0432\u0443, \u0432\u0438\u0431\u0440\u0430\u043D\u0443 \u0432 Obsidian.",
  syncSection: "\u041A\u0440\u043E\u0441\u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u043D\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0430\u0446\u0456\u044F GitHub",
  repository: "\u0420\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u0440\u0456\u0439",
  branch: "\u0413\u0456\u043B\u043A\u0430",
  deviceName: "\u041D\u0430\u0437\u0432\u0430 \u043F\u0440\u0438\u0441\u0442\u0440\u043E\u044E",
  testAndSync: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0439 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0443\u0432\u0430\u0442\u0438",
  testConnection: "\u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0437\u2019\u0454\u0434\u043D\u0430\u043D\u043D\u044F",
  syncNow: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0443\u0432\u0430\u0442\u0438",
  syncing: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0430\u0446\u0456\u044F\u2026",
  syncOnStartup: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0430\u0446\u0456\u044F \u043F\u0456\u0434 \u0447\u0430\u0441 \u0437\u0430\u043F\u0443\u0441\u043A\u0443",
  syncOnSave: "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0430\u0446\u0456\u044F \u043F\u0456\u0441\u043B\u044F \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F",
  periodicSync: "\u041F\u0435\u0440\u0456\u043E\u0434\u0438\u0447\u043D\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0430\u0446\u0456\u044F",
  ignoredPaths: "\u0406\u0433\u043D\u043E\u0440\u043E\u0432\u0430\u043D\u0456 \u0448\u043B\u044F\u0445\u0438",
  homeNote: "\u0414\u043E\u043C\u0430\u0448\u043D\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0430",
  readingDisplay: "\u0420\u0435\u0436\u0438\u043C \u0447\u0438\u0442\u0430\u043D\u043D\u044F",
  dataManagement: "\u041A\u0435\u0440\u0443\u0432\u0430\u043D\u043D\u044F \u0434\u0430\u043D\u0438\u043C\u0438",
  clear: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u0438",
  never: "\u041D\u0456\u043A\u043E\u043B\u0438",
  tabHome: "\u0413\u043E\u043B\u043E\u0432\u043D\u0430",
  tabFiles: "\u0424\u0430\u0439\u043B\u0438",
  tabFavorites: "\u041E\u0431\u0440\u0430\u043D\u0435",
  tabHistory: "\u0406\u0441\u0442\u043E\u0440\u0456\u044F",
  currentNote: "\u041F\u043E\u0442\u043E\u0447\u043D\u0430 \u043D\u043E\u0442\u0430\u0442\u043A\u0430",
  searchPlaceholder: "\u041F\u043E\u0448\u0443\u043A \u0443 \u043D\u0430\u0437\u0432\u0430\u0445 \u0456 \u0432\u043C\u0456\u0441\u0442\u0456 \u043D\u043E\u0442\u0430\u0442\u043E\u043A\u2026",
  searching: "\u041F\u043E\u0448\u0443\u043A\u2026",
  noMatches: "\u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0438\u0445 \u043D\u043E\u0442\u0430\u0442\u043E\u043A \u043D\u0435\u043C\u0430\u0454.",
  back: "\u041D\u0430\u0437\u0430\u0434",
  forward: "\u0412\u043F\u0435\u0440\u0435\u0434",
  parentFolder: "\u0411\u0430\u0442\u044C\u043A\u0456\u0432\u0441\u044C\u043A\u0430 \u043F\u0430\u043F\u043A\u0430",
  rootFolder: "\u041A\u043E\u0440\u0456\u043D\u044C",
  githubSync: "\u041A\u0440\u043E\u0441\u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u043D\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0456\u0437\u0430\u0446\u0456\u044F GitHub"
};
var VI = {
  language: "Ng\xF4n ng\u1EEF",
  languageDescription: "Ch\u1ECDn ng\xF4n ng\u1EEF cho GitSync Portal. T\xF9y ch\u1ECDn h\u1EC7 th\u1ED1ng d\xF9ng ng\xF4n ng\u1EEF \u0111\xE3 ch\u1ECDn trong Obsidian.",
  syncSection: "\u0110\u1ED3ng b\u1ED9 GitHub \u0111a n\u1EC1n t\u1EA3ng",
  repository: "Kho l\u01B0u tr\u1EEF",
  branch: "Nh\xE1nh",
  deviceName: "T\xEAn thi\u1EBFt b\u1ECB",
  testAndSync: "Ki\u1EC3m tra v\xE0 \u0111\u1ED3ng b\u1ED9",
  testConnection: "Ki\u1EC3m tra k\u1EBFt n\u1ED1i",
  syncNow: "\u0110\u1ED3ng b\u1ED9 ngay",
  syncing: "\u0110ang \u0111\u1ED3ng b\u1ED9\u2026",
  syncOnStartup: "\u0110\u1ED3ng b\u1ED9 khi kh\u1EDFi \u0111\u1ED9ng",
  syncOnSave: "\u0110\u1ED3ng b\u1ED9 sau khi l\u01B0u",
  periodicSync: "\u0110\u1ED3ng b\u1ED9 \u0111\u1ECBnh k\u1EF3",
  ignoredPaths: "\u0110\u01B0\u1EDDng d\u1EABn b\u1ECF qua",
  homeNote: "Ghi ch\xFA trang ch\u1EE7",
  readingDisplay: "Hi\u1EC3n th\u1ECB \u0111\u1ECDc",
  dataManagement: "Qu\u1EA3n l\xFD d\u1EEF li\u1EC7u",
  clear: "X\xF3a",
  never: "Kh\xF4ng bao gi\u1EDD",
  tabHome: "Trang ch\u1EE7",
  tabFiles: "T\u1EC7p",
  tabFavorites: "Y\xEAu th\xEDch",
  tabHistory: "L\u1ECBch s\u1EED",
  currentNote: "Ghi ch\xFA hi\u1EC7n t\u1EA1i",
  searchPlaceholder: "T\xECm t\xEAn t\u1EC7p v\xE0 n\u1ED9i dung ghi ch\xFA\u2026",
  searching: "\u0110ang t\xECm\u2026",
  noMatches: "Kh\xF4ng c\xF3 ghi ch\xFA ph\xF9 h\u1EE3p.",
  back: "Quay l\u1EA1i",
  forward: "Ti\u1EBFp",
  parentFolder: "Th\u01B0 m\u1EE5c cha",
  rootFolder: "G\u1ED1c",
  githubSync: "\u0110\u1ED3ng b\u1ED9 GitHub \u0111a n\u1EC1n t\u1EA3ng"
};
var TRANSLATIONS = {
  en: EN,
  "en-GB": EN,
  zh: ZH,
  "zh-TW": ZH_TW,
  ja: JA,
  ko: KO,
  es: ES,
  de: DE,
  it: IT,
  fr: FR,
  ar: AR,
  bn: BN,
  nl: NL,
  pl: PL,
  pt: PT,
  "pt-BR": PT_BR,
  ro: RO,
  ru: RU,
  sv: SV,
  tr: TR,
  uk: UK,
  vi: VI
};
function resolveLanguage(setting, systemLanguage = systemLocale()) {
  if (setting !== "auto") return setting;
  const locale = systemLanguage.replace(/_/g, "-").toLocaleLowerCase();
  if (locale.startsWith("zh-tw") || locale.startsWith("zh-hk") || locale.startsWith("zh-mo") || locale.includes("hant")) return "zh-TW";
  if (locale.startsWith("zh")) return "zh";
  if (locale.startsWith("pt-br")) return "pt-BR";
  if (locale.startsWith("en-gb")) return "en-GB";
  for (const language of Object.keys(TRANSLATIONS)) {
    if (locale === language.toLocaleLowerCase() || locale.startsWith(`${language.toLocaleLowerCase()}-`)) return language;
  }
  return "en";
}
function translate(setting, key, values = {}) {
  var _a;
  const language = resolveLanguage(setting);
  const template = (_a = TRANSLATIONS[language][key]) != null ? _a : EN[key];
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => values[name] === void 0 ? match : String(values[name]));
}
function formatDateTime(setting, timestamp) {
  return new Intl.DateTimeFormat(resolveLanguage(setting), { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp));
}
function systemLocale() {
  var _a, _b;
  try {
    const obsidianLanguage = (_b = (_a = globalThis.localStorage) == null ? void 0 : _a.getItem("language")) == null ? void 0 : _b.trim();
    if (obsidianLanguage) return obsidianLanguage;
  } catch (e) {
  }
  return typeof navigator === "undefined" ? "en" : navigator.language || "en";
}

// main.ts
var PLUGIN_ID = "gitsync-portal";
var LEGACY_PLUGIN_IDS2 = ["gitsync-port", "obsidian-viewer"];
var GITHUB_TOKEN_SECRET_ID = "gitsync-portal-github-token";
var LEGACY_GITHUB_TOKEN_SECRET_IDS = ["gitsync-port-github-token", "obsidian-viewer-github-token"];
var SYNCED_VIEWER_STATE_PATH = `.obsidian/plugins/${PLUGIN_ID}/sync-state.json`;
var LOCAL_SYNC_STATE_PATH = `.obsidian/plugins/${PLUGIN_ID}/local-sync-state.json`;
var PORTAL_SYNC_IGNORE_PATTERNS_WITHOUT_GLOBAL_CONFLICTS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  `.obsidian/plugins/${PLUGIN_ID}/local-sync-state.json`,
  `.obsidian/plugins/${PLUGIN_ID}/*.conflict-*`,
  ...LEGACY_PLUGIN_IDS2.map((id) => `.obsidian/plugins/${id}/`),
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/"
].join("\n");
var DEFAULT_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  "*.conflict-*",
  "**/*.conflict-*",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  `.obsidian/plugins/${PLUGIN_ID}/local-sync-state.json`,
  `.obsidian/plugins/${PLUGIN_ID}/*.conflict-*`,
  ...LEGACY_PLUGIN_IDS2.map((id) => `.obsidian/plugins/${id}/`),
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/"
].join("\n");
var GITSYNC_PORT_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  ".obsidian/plugins/gitsync-port/local-sync-state.json",
  ".obsidian/plugins/gitsync-port/*.conflict-*",
  ".obsidian/plugins/obsidian-viewer/",
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
  language: "auto",
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
  lastSyncSummary: ""
};
var GitSyncPortalPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
    this.searchCache = /* @__PURE__ */ new Map();
    this.quizSaveTimer = null;
    this.syncOnSaveTimer = null;
    this.periodicSyncTimer = null;
    this.periodicSyncKey = "";
    this.syncStatus = { stage: "idle", message: "" };
    this.githubSync = new GitHubSyncService(this, (status) => {
      this.syncStatus = status;
      this.updateDashboardSyncStatus();
    });
  }
  async onload() {
    await this.loadSettings();
    this.migrateLegacyToken();
    this.registerView(VIEW_TYPE_GITSYNC_PORTAL, (leaf) => new GitSyncPortalDashboardView(leaf, this));
    this.registerView(LEGACY_VIEW_TYPE_GITSYNC_PORT, (leaf) => new GitSyncPortalDashboardView(leaf, this));
    this.registerView(LEGACY_VIEW_TYPE_VIEWER, (leaf) => new GitSyncPortalDashboardView(leaf, this));
    this.addRibbonIcon("refresh-cw", this.t("openDashboard"), () => void this.activateDashboard());
    this.addCommand({
      id: "open-dashboard",
      name: this.t("openReadingDashboard"),
      callback: () => void this.activateDashboard()
    });
    this.addCommand({
      id: "sync-github-now",
      name: this.t("syncGitHubNow"),
      callback: () => void this.syncNow()
    });
    this.addCommand({
      id: "pull-github-now",
      name: this.t("pullOnlyLong"),
      callback: () => void this.syncNow(true, "pull-only")
    });
    this.addCommand({
      id: "push-github-now",
      name: this.t("pushOnlyLong"),
      callback: () => void this.syncNow(true, "push-only")
    });
    this.addCommand({
      id: "open-home-note",
      name: this.t("openHomeNote"),
      callback: () => void this.openHomeNote()
    });
    this.addCommand({
      id: "toggle-current-favorite",
      name: this.t("toggleFavorite"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.toggleFavorite(file);
        return true;
      }
    });
    this.addCommand({
      id: "set-current-as-home",
      name: this.t("setCurrentHome"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.setHomeNote(file);
        return true;
      }
    });
    this.addCommand({
      id: "toggle-focus-reading",
      name: this.t("toggleFocus"),
      callback: () => {
        document.body.classList.toggle("ov-focus-reading");
        new import_obsidian5.Notice(this.t(document.body.classList.contains("ov-focus-reading") ? "focusEnabled" : "focusDisabled"));
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
    this.addSettingTab(new GitSyncPortalSettingTab(this.app, this));
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
    const currentData = await this.loadData();
    const legacyData = currentData ? null : await this.loadLegacyPluginData();
    const loaded = currentData != null ? currentData : legacyData;
    const localSyncState = await this.loadLocalSyncState(loaded);
    const loadedDeviceName = (_b = (_a = loaded == null ? void 0 : loaded.syncDeviceName) == null ? void 0 : _a.trim()) != null ? _b : "";
    const syncDeviceNameAuto = typeof (loaded == null ? void 0 : loaded.syncDeviceNameAuto) === "boolean" ? loaded.syncDeviceNameAuto : !loadedDeviceName || AUTO_GENERATED_DEVICE_NAMES.has(loadedDeviceName);
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded != null ? loaded : {},
      language: isLanguageSetting(loaded == null ? void 0 : loaded.language) ? loaded.language : "auto",
      syncDeviceNameAuto,
      syncDeviceName: syncDeviceNameAuto ? defaultDeviceName() : loadedDeviceName || defaultDeviceName(),
      favorites: Array.isArray(loaded == null ? void 0 : loaded.favorites) ? loaded.favorites : [],
      history: Array.isArray(loaded == null ? void 0 : loaded.history) ? loaded.history : [],
      quizProgress: (loaded == null ? void 0 : loaded.quizProgress) && typeof loaded.quizProgress === "object" ? loaded.quizProgress : {},
      lastSyncedCommit: localSyncState.lastSyncedCommit,
      lastSyncAt: localSyncState.lastSyncAt,
      lastSyncSummary: localSyncState.lastSyncSummary
    };
    let migrated = legacyData !== null || (loaded == null ? void 0 : loaded.syncDeviceNameAuto) !== syncDeviceNameAuto || (loaded == null ? void 0 : loaded.syncDeviceName) !== this.settings.syncDeviceName;
    if ([PORTAL_SYNC_IGNORE_PATTERNS_WITHOUT_GLOBAL_CONFLICTS, GITSYNC_PORT_SYNC_IGNORE_PATTERNS, PLUGIN_SYNC_IGNORE_PATTERNS_WITHOUT_CONFLICTS, DEVICE_LOCAL_PLUGIN_IGNORE_PATTERNS, PREVIOUS_SYNC_IGNORE_PATTERNS, LEGACY_SYNC_IGNORE_PATTERNS].includes(this.settings.syncIgnorePatterns)) {
      this.settings.syncIgnorePatterns = DEFAULT_SYNC_IGNORE_PATTERNS;
      migrated = true;
    }
    if (await this.applySyncedViewerStateFromDisk()) migrated = true;
    if (migrated) await this.savePluginData();
    await this.saveLocalSyncState();
    await this.saveSyncedViewerState();
    this.syncStatus = { stage: "idle", message: this.settings.lastSyncSummary || this.t("notSynced") };
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
    var _a;
    return ((_a = this.app.secretStorage.getSecret(GITHUB_TOKEN_SECRET_ID)) == null ? void 0 : _a.trim()) || LEGACY_GITHUB_TOKEN_SECRET_IDS.map((id) => {
      var _a2;
      return (_a2 = this.app.secretStorage.getSecret(id)) == null ? void 0 : _a2.trim();
    }).find(Boolean) || "";
  }
  setGitHubToken(token) {
    this.app.secretStorage.setSecret(GITHUB_TOKEN_SECRET_ID, token.trim());
  }
  t(key, values) {
    return translate(this.settings.language, key, values);
  }
  formatDateTime(timestamp) {
    return formatDateTime(this.settings.language, timestamp);
  }
  getLanguageOptions() {
    return LANGUAGE_OPTIONS;
  }
  getCurrentDeviceName() {
    return defaultDeviceName();
  }
  async testGitHubConnection() {
    const result = await this.githubSync.testConnection();
    return `${result.repository} \xB7 ${result.branch} \xB7 ${result.commitSha.slice(0, 7)}`;
  }
  async syncNow(showNotice = true, mode = "two-way") {
    if (this.githubSync.isRunning) {
      if (showNotice) new import_obsidian5.Notice(this.t("syncAlreadyRunning"));
      return;
    }
    try {
      await this.saveSettings();
      const result = await this.githubSync.sync(mode);
      if (mode !== "push-only") this.settings.lastSyncedCommit = result.commitSha;
      this.settings.lastSyncAt = Date.now();
      this.settings.lastSyncSummary = result.changed ? this.t(mode === "pull-only" ? "syncSummaryPull" : mode === "push-only" ? "syncSummaryPush" : "syncSummary", {
        pulled: result.pulled,
        pushed: result.pushed,
        deleted: result.deleted,
        conflicts: result.conflicts
      }) : this.t("alreadyInSync");
      await this.saveLocalSyncState();
      await this.loadSettings();
      await this.applySyncedViewerStateFromDisk();
      await this.saveSettings();
      await this.refreshDashboard();
      if (showNotice) new import_obsidian5.Notice(this.t("syncCompleteNotice", { summary: this.settings.lastSyncSummary }));
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
    var _a, _b, _c;
    let leaf = (_b = (_a = this.app.workspace.getLeavesOfType(VIEW_TYPE_GITSYNC_PORTAL)[0]) != null ? _a : this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_GITSYNC_PORT)[0]) != null ? _b : this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_VIEWER)[0];
    if (!leaf) {
      leaf = (_c = this.app.workspace.getLeftLeaf(false)) != null ? _c : this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE_GITSYNC_PORTAL, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }
  async openHomeNote() {
    const path = this.settings.homeNote;
    const file = path ? this.app.vault.getAbstractFileByPath(path) : null;
    if (!(file instanceof import_obsidian5.TFile)) {
      new import_obsidian5.Notice(this.t("missingHomeNote"));
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
    const name = file instanceof import_obsidian5.TFile ? file.basename : file.name || this.t("rootName");
    this.settings.favorites = isFavorite ? this.settings.favorites.filter((path) => path !== file.path) : [file.path, ...this.settings.favorites.filter((path) => path !== file.path)];
    await this.saveSettings();
    new import_obsidian5.Notice(this.t(isFavorite ? "removedFavorite" : "addedFavorite", { name }));
  }
  async setHomeNote(file) {
    this.settings.homeNote = file.path;
    await this.saveSettings();
    new import_obsidian5.Notice(this.t("homeSet", { name: file.basename }));
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
    const leaves = [
      ...this.app.workspace.getLeavesOfType(VIEW_TYPE_GITSYNC_PORTAL),
      ...this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_GITSYNC_PORT),
      ...this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_VIEWER)
    ];
    await Promise.all(leaves.map((leaf) => {
      const view = leaf.view;
      return view instanceof GitSyncPortalDashboardView ? view.render() : Promise.resolve();
    }));
  }
  updateDashboardSyncStatus() {
    const leaves = [
      ...this.app.workspace.getLeavesOfType(VIEW_TYPE_GITSYNC_PORTAL),
      ...this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_GITSYNC_PORT),
      ...this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_VIEWER)
    ];
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof GitSyncPortalDashboardView) view.updateSyncStatus();
    });
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
    const sourcePath = await this.app.vault.adapter.exists(path) ? path : await firstExistingAdapterPath(this, legacyPluginPaths(this.app.vault.configDir, "sync-state.json"));
    if (!sourcePath) return null;
    try {
      const parsed = JSON.parse(await this.app.vault.adapter.read(sourcePath));
      return {
        version: 1,
        favorites: normalizeTrackedPaths(parsed.favorites),
        history: normalizeTrackedPaths(parsed.history)
      };
    } catch (error) {
      new import_obsidian5.Notice(this.t("sharedStateReadFailed", { error: error instanceof Error ? error.message : String(error) }), 8e3);
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
      new import_obsidian5.Notice(this.t("sharedStateWriteFailed", { error: error instanceof Error ? error.message : String(error) }), 8e3);
    }
  }
  async loadLocalSyncState(loaded) {
    const path = localSyncStatePath(this.app.vault.configDir);
    const fallback = {
      lastSyncedCommit: typeof (loaded == null ? void 0 : loaded.lastSyncedCommit) === "string" ? loaded.lastSyncedCommit : DEFAULT_SETTINGS.lastSyncedCommit,
      lastSyncAt: typeof (loaded == null ? void 0 : loaded.lastSyncAt) === "number" ? loaded.lastSyncAt : DEFAULT_SETTINGS.lastSyncAt,
      lastSyncSummary: typeof (loaded == null ? void 0 : loaded.lastSyncSummary) === "string" ? loaded.lastSyncSummary : DEFAULT_SETTINGS.lastSyncSummary
    };
    const sourcePath = await this.app.vault.adapter.exists(path) ? path : await firstExistingAdapterPath(this, legacyPluginPaths(this.app.vault.configDir, "local-sync-state.json"));
    if (!sourcePath) return fallback;
    try {
      const parsed = JSON.parse(await this.app.vault.adapter.read(sourcePath));
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
  migrateLegacyToken() {
    var _a;
    if ((_a = this.app.secretStorage.getSecret(GITHUB_TOKEN_SECRET_ID)) == null ? void 0 : _a.trim()) return;
    const legacyToken = LEGACY_GITHUB_TOKEN_SECRET_IDS.map((id) => {
      var _a2;
      return (_a2 = this.app.secretStorage.getSecret(id)) == null ? void 0 : _a2.trim();
    }).find(Boolean);
    if (legacyToken) this.app.secretStorage.setSecret(GITHUB_TOKEN_SECRET_ID, legacyToken);
  }
  async loadLegacyPluginData() {
    for (const path of legacyPluginPaths(this.app.vault.configDir, "data.json")) {
      if (!await this.app.vault.adapter.exists(path)) continue;
      try {
        return JSON.parse(await this.app.vault.adapter.read(path));
      } catch (e) {
        continue;
      }
    }
    return null;
  }
};
function syncedViewerStatePath(configDir) {
  return (0, import_obsidian5.normalizePath)(configDir ? `${configDir}/plugins/${PLUGIN_ID}/sync-state.json` : SYNCED_VIEWER_STATE_PATH);
}
function localSyncStatePath(configDir) {
  return (0, import_obsidian5.normalizePath)(configDir ? `${configDir}/plugins/${PLUGIN_ID}/local-sync-state.json` : LOCAL_SYNC_STATE_PATH);
}
function legacyPluginPaths(configDir, filename) {
  return LEGACY_PLUGIN_IDS2.map((id) => (0, import_obsidian5.normalizePath)(configDir ? `${configDir}/plugins/${id}/${filename}` : `.obsidian/plugins/${id}/${filename}`));
}
async function firstExistingAdapterPath(plugin, paths) {
  for (const path of paths) {
    if (await plugin.app.vault.adapter.exists(path)) return path;
  }
  return null;
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
function isLanguageSetting(value) {
  return typeof value === "string" && value in LANGUAGE_OPTIONS;
}
