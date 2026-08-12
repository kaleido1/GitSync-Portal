import { ItemView, TAbstractFile, TFile, TFolder, WorkspaceLeaf, setIcon } from "obsidian";
import type ObsidianViewerPlugin from "../main";

export const VIEW_TYPE_VIEWER = "obsidian-viewer-dashboard";
type DashboardTab = "home" | "files" | "favorites" | "history";
type ViewerListItem = TFile | TFolder;

export class ViewerDashboardView extends ItemView {
  private activeTab: DashboardTab = "home";
  private searchQuery = "";
  private searchSequence = 0;
  private searchTimer: number | null = null;
  private isSearchComposing = false;
  private currentFolderPath = "";
  private folderBackStack: string[] = [];
  private folderForwardStack: string[] = [];

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ObsidianViewerPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_VIEWER;
  }

  getDisplayText(): string {
    return "Obsidian Viewer";
  }

  getIcon(): string {
    return "library";
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("ov-dashboard");
    await this.render();
  }

  async onClose(): Promise<void> {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
  }

  async render(): Promise<void> {
    const root = this.contentEl;
    const searchFocus = this.captureSearchFocus(root);
    root.empty();
    root.addClass("ov-dashboard");

    const header = root.createDiv({ cls: "ov-dashboard-header" });
    const titleBox = header.createDiv();
    titleBox.createEl("h2", { text: "Obsidian Viewer" });
    titleBox.createEl("small", { text: `${this.app.vault.getMarkdownFiles().length} 篇笔记` });
    const refresh = header.createEl("button", { cls: "clickable-icon ov-icon-button", attr: { "aria-label": "刷新" } });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.render());

    this.renderTabs(root);
    this.renderActiveNote(root);

    if (this.activeTab === "home") await this.renderHome(root);
    if (this.activeTab === "files") await this.renderFiles(root, searchFocus);
    if (this.activeTab === "favorites") this.renderTrackedItems(root, "收藏", this.plugin.settings.favorites, "还没有收藏。", true);
    if (this.activeTab === "history") this.renderHistory(root);
  }

  private renderTabs(root: HTMLElement): void {
    const tabs = root.createDiv({ cls: "ov-tabs" });
    const choices: Array<[DashboardTab, string, string]> = [
      ["home", "首页", "home"],
      ["files", "文件", "files"],
      ["favorites", "收藏", "star"],
      ["history", "历史", "history"],
    ];
    choices.forEach(([tab, label, icon]) => {
      const button = tabs.createEl("button", {
        cls: `ov-tab${this.activeTab === tab ? " is-active" : ""}`,
        attr: { "aria-pressed": String(this.activeTab === tab) },
      });
      setIcon(button.createSpan({ cls: "ov-tab-icon" }), icon);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        this.activeTab = tab;
        this.searchQuery = "";
        void this.render();
      });
    });
  }

  private renderActiveNote(root: HTMLElement): void {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== "md") return;
    const card = root.createDiv({ cls: "ov-active-card" });
    card.createEl("small", { text: "当前笔记" });
    card.createEl("strong", { text: file.basename });
    card.createEl("span", { text: file.path, cls: "ov-muted ov-path" });
    const actions = card.createDiv({ cls: "ov-inline-actions" });
    this.iconButton(actions, this.plugin.isFavorite(file.path) ? "star-off" : "star", this.plugin.isFavorite(file.path) ? "取消收藏" : "收藏", () => void this.plugin.toggleFavorite(file));
    this.iconButton(actions, "house-plus", "设为首页", () => void this.plugin.setHomeNote(file));
  }

  private async renderHome(root: HTMLElement): Promise<void> {
    const home = this.plugin.getMarkdownFile(this.plugin.settings.homeNote);
    const hero = root.createDiv({ cls: "ov-home-card" });
    hero.createEl("div", { text: "首页笔记", cls: "ov-eyebrow" });
    hero.createEl("h3", { text: home?.basename ?? "尚未设置" });
    hero.createEl("p", {
      text: home ? home.path : "打开一篇笔记后，使用当前笔记卡片上的首页按钮。",
      cls: "ov-muted",
    });
    const heroActions = hero.createDiv({ cls: "ov-inline-actions" });
    const openHome = heroActions.createEl("button", { text: "打开首页", cls: "mod-cta" });
    openHome.disabled = !home;
    openHome.addEventListener("click", () => void this.plugin.openHomeNote());

    this.renderSyncCard(root);

    const favorites = this.plugin.settings.favorites.map((path) => this.plugin.getFileOrFolder(path)).filter((item): item is ViewerListItem => item !== null).slice(0, 5);
    this.renderSection(root, "收藏", favorites, "还没有收藏笔记。", true);

    const recent = this.plugin.settings.history.map((path) => this.plugin.getMarkdownFile(path)).filter((file): file is TFile => file !== null).slice(0, 8);
    this.renderSection(root, "最近阅读", recent, "打开过的笔记会出现在这里。", false);

    this.renderOutline(root);
  }

  private renderSyncCard(root: HTMLElement): void {
    const status = this.plugin.syncStatus;
    const card = root.createDiv({ cls: `ov-sync-card is-${status.stage}` });
    const header = card.createDiv({ cls: "ov-sync-card-header" });
    const title = header.createDiv();
    title.createEl("strong", { text: "GitHub 跨平台同步" });
    title.createEl("small", { text: `${this.plugin.settings.syncRepository} · ${this.plugin.settings.syncBranch || "默认分支"}` });
    const sync = header.createEl("button", { text: this.plugin.githubSync.isRunning ? "同步中…" : "立即同步", cls: "mod-cta" });
    sync.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    sync.addEventListener("click", () => void this.plugin.syncNow());
    card.createDiv({
      text: this.plugin.getGitHubToken() ? status.message : "尚未保存 GitHub token，请先前往插件设置。",
      cls: "ov-sync-message",
    });
    if (status.total && status.current !== undefined) {
      const progress = card.createEl("progress", { attr: { max: String(status.total), value: String(status.current) } });
      progress.value = status.current;
      progress.max = status.total;
    }
    if (this.plugin.settings.lastSyncAt) {
      card.createEl("small", {
        text: `${new Date(this.plugin.settings.lastSyncAt).toLocaleString()} · ${this.plugin.settings.lastSyncSummary}`,
        cls: "ov-muted",
      });
    }
  }

  private captureSearchFocus(root: HTMLElement): { start: number; end: number } | null {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLInputElement) || !root.contains(activeElement) || !activeElement.matches(".ov-search-box input")) {
      return null;
    }
    const length = activeElement.value.length;
    return {
      start: activeElement.selectionStart ?? length,
      end: activeElement.selectionEnd ?? length,
    };
  }

  private scheduleSearchRender(results: HTMLElement): void {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => {
      this.searchTimer = null;
      if (results.isConnected) void this.renderSearchResults(results);
    }, 250);
  }

  private async renderFiles(root: HTMLElement, searchFocus: { start: number; end: number } | null): Promise<void> {
    const searchBox = root.createDiv({ cls: "ov-search-box", attr: { tabindex: "0", role: "search" } });
    setIcon(searchBox.createSpan(), "search");
    const input = searchBox.createEl("input", {
      type: "search",
      placeholder: "搜索文件名和正文…",
      value: this.searchQuery,
      attr: { "aria-label": "搜索文件名和正文" },
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
      if ((event as InputEvent).isComposing || this.isSearchComposing) return;
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

  private async renderSearchResults(results: HTMLElement): Promise<void> {
    const sequence = ++this.searchSequence;
    results.empty();
    if (this.searchQuery.trim()) {
      results.createDiv({ text: "正在搜索…", cls: "ov-search-status" });
      const files = await this.plugin.searchFiles(this.searchQuery);
      if (sequence !== this.searchSequence || !results.isConnected) return;
      results.empty();
      this.renderSection(results, `搜索结果（${files.length}）`, files, "没有匹配的笔记。", true);
    } else {
      this.renderDirectory(results);
    }
  }

  private renderDirectory(root: HTMLElement): void {
    const folder = this.getCurrentFolder();
    const controls = root.createDiv({ cls: "ov-directory-controls" });
    this.iconButton(controls, "arrow-left", "后退", () => this.navigateHistory(-1)).disabled = this.folderBackStack.length === 0;
    this.iconButton(controls, "arrow-right", "前进", () => this.navigateHistory(1)).disabled = this.folderForwardStack.length === 0;
    this.iconButton(controls, "arrow-up", "上一级", () => this.openParentFolder()).disabled = !this.currentFolderPath;
    const location = controls.createDiv({ cls: "ov-directory-location" });
    setIcon(location.createSpan(), "folder-open");
    location.createSpan({ text: this.currentFolderPath || "Vault 根目录" });

    this.renderBreadcrumbs(root);
    const children = [...folder.children].sort(compareVaultItems);
    this.renderDirectoryList(root, children);
  }

  private renderBreadcrumbs(root: HTMLElement): void {
    const crumbs = root.createDiv({ cls: "ov-breadcrumbs" });
    const rootButton = crumbs.createEl("button", { text: "根目录" });
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

  private renderDirectoryList(root: HTMLElement, children: TAbstractFile[]): void {
    root.createEl("h3", { text: `${this.currentFolderPath || "根目录"}（${children.length}）`, cls: "ov-section-title" });
    const list = root.createDiv({ cls: "ov-file-list" });
    if (!children.length) {
      list.createEl("p", { text: "当前目录为空。", cls: "ov-empty" });
      return;
    }
    children.forEach((child) => {
      const row = list.createDiv({ cls: "ov-file-row" });
      const open = row.createEl("button", { cls: "ov-file-open" });
      if (child instanceof TFolder) {
        setIcon(open.createSpan({ cls: "ov-file-icon" }), "folder");
        const labels = open.createSpan({ cls: "ov-file-labels" });
        labels.createEl("strong", { text: child.name || "根目录" });
        labels.createEl("small", { text: `${child.children.length} 项 · ${child.path || "Vault 根目录"}` });
        open.addEventListener("click", () => this.openFolder(child.path, true));
        this.iconButton(row, this.plugin.isFavorite(child.path) ? "star-off" : "star", this.plugin.isFavorite(child.path) ? "取消收藏" : "收藏", () => void this.plugin.toggleFavorite(child));
        return;
      }
      if (child instanceof TFile) {
        setIcon(open.createSpan({ cls: "ov-file-icon" }), child.extension === "md" ? "file-text" : "file");
        const labels = open.createSpan({ cls: "ov-file-labels" });
        labels.createEl("strong", { text: child.basename });
        labels.createEl("small", { text: child.path });
        open.addEventListener("click", () => void this.plugin.openFile(child));
        if (child.extension === "md") {
          this.iconButton(row, this.plugin.isFavorite(child.path) ? "star-off" : "star", this.plugin.isFavorite(child.path) ? "取消收藏" : "收藏", () => void this.plugin.toggleFavorite(child));
        }
      }
    });
  }

  private renderHistory(root: HTMLElement): void {
    const heading = root.createDiv({ cls: "ov-section-heading" });
    heading.createEl("h3", { text: `阅读历史（${this.plugin.settings.history.length}）` });
    const clear = heading.createEl("button", { text: "清空", cls: "mod-warning" });
    clear.disabled = this.plugin.settings.history.length === 0;
    clear.addEventListener("click", () => void this.plugin.clearHistory());
    this.renderTrackedItems(root, "", this.plugin.settings.history, "暂无阅读历史。", false, false);
  }

  private renderTrackedItems(root: HTMLElement, title: string, paths: string[], emptyText: string, showFavorite: boolean, showHeading = true): void {
    const items = paths
      .map((path) => showFavorite ? this.plugin.getFileOrFolder(path) : this.plugin.getMarkdownFile(path))
      .filter((item): item is ViewerListItem => item !== null);
    if (showHeading && title) root.createEl("h3", { text: `${title}（${items.length}）`, cls: "ov-section-title" });
    this.renderFileList(root, items, emptyText, showFavorite);
  }

  private renderSection(root: HTMLElement, title: string, files: ViewerListItem[], emptyText: string, showFavorite: boolean): void {
    root.createEl("h3", { text: title, cls: "ov-section-title" });
    this.renderFileList(root, files, emptyText, showFavorite);
  }

  private renderFileList(root: HTMLElement, files: ViewerListItem[], emptyText: string, showFavorite: boolean): void {
    const list = root.createDiv({ cls: "ov-file-list" });
    if (!files.length) {
      list.createEl("p", { text: emptyText, cls: "ov-empty" });
      return;
    }
    files.forEach((file) => {
      const row = list.createDiv({ cls: "ov-file-row" });
      const open = row.createEl("button", { cls: "ov-file-open" });
      setIcon(open.createSpan({ cls: "ov-file-icon" }), file instanceof TFolder ? "folder" : "file-text");
      const labels = open.createSpan({ cls: "ov-file-labels" });
      labels.createEl("strong", { text: file instanceof TFolder ? file.name || "根目录" : file.basename });
      labels.createEl("small", { text: file instanceof TFolder ? `${file.children.length} 项 · ${file.path || "Vault 根目录"}` : file.path });
      open.addEventListener("click", () => {
        if (file instanceof TFolder) {
          this.activeTab = "files";
          this.searchQuery = "";
          this.openFolder(file.path, true);
        } else {
          void this.plugin.openFile(file);
        }
      });
      if (showFavorite) {
        this.iconButton(row, this.plugin.isFavorite(file.path) ? "star-off" : "star", this.plugin.isFavorite(file.path) ? "取消收藏" : "收藏", () => void this.plugin.toggleFavorite(file));
      }
    });
  }

  private renderOutline(root: HTMLElement): void {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile)) return;
    const headings = this.app.metadataCache.getFileCache(file)?.headings ?? [];
    root.createEl("h3", { text: "本页目录", cls: "ov-section-title" });
    const outline = root.createDiv({ cls: "ov-outline" });
    if (!headings.length) {
      outline.createEl("p", { text: "当前笔记没有标题。", cls: "ov-empty" });
      return;
    }
    headings.forEach(({ heading, level }) => {
      const button = outline.createEl("button", { text: heading, cls: "ov-outline-item" });
      button.style.paddingLeft = `${8 + (level - 1) * 12}px`;
      button.addEventListener("click", () => void this.app.workspace.openLinkText(`${file.path}#${heading}`, file.path, false));
    });
  }

  private iconButton(root: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
    const button = root.createEl("button", { cls: "clickable-icon ov-icon-button", attr: { "aria-label": label, title: label } });
    setIcon(button, icon);
    button.addEventListener("click", action);
    return button;
  }

  private getCurrentFolder(): TFolder {
    if (!this.currentFolderPath) return this.app.vault.getRoot();
    const folder = this.app.vault.getAbstractFileByPath(this.currentFolderPath);
    if (folder instanceof TFolder) return folder;
    this.currentFolderPath = "";
    return this.app.vault.getRoot();
  }

  private openFolder(path: string, trackHistory: boolean): void {
    if (path === this.currentFolderPath) return;
    if (trackHistory) {
      this.folderBackStack.push(this.currentFolderPath);
      this.folderForwardStack = [];
    }
    this.currentFolderPath = path;
    void this.render();
  }

  private openParentFolder(): void {
    if (!this.currentFolderPath) return;
    const parent = this.currentFolderPath.includes("/")
      ? this.currentFolderPath.slice(0, this.currentFolderPath.lastIndexOf("/"))
      : "";
    this.openFolder(parent, true);
  }

  private navigateHistory(direction: -1 | 1): void {
    const from = direction < 0 ? this.folderBackStack : this.folderForwardStack;
    const to = direction < 0 ? this.folderForwardStack : this.folderBackStack;
    const next = from.pop();
    if (next === undefined) return;
    to.push(this.currentFolderPath);
    this.currentFolderPath = next;
    void this.render();
  }
}

function compareVaultItems(a: TAbstractFile, b: TAbstractFile): number {
  const aFolder = a instanceof TFolder;
  const bFolder = b instanceof TFolder;
  if (aFolder !== bFolder) return aFolder ? -1 : 1;
  return a.name.localeCompare(b.name);
}
