import { ItemView, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type ObsidianViewerPlugin from "../main";

export const VIEW_TYPE_VIEWER = "obsidian-viewer-dashboard";
type DashboardTab = "home" | "files" | "favorites" | "history";

export class ViewerDashboardView extends ItemView {
  private activeTab: DashboardTab = "home";
  private searchQuery = "";
  private searchSequence = 0;
  private searchTimer: number | null = null;

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
    if (this.activeTab === "files") await this.renderFiles(root);
    if (this.activeTab === "favorites") this.renderTrackedFiles(root, "收藏笔记", this.plugin.settings.favorites, "还没有收藏笔记。", true);
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

    const favorites = this.plugin.settings.favorites.map((path) => this.plugin.getMarkdownFile(path)).filter((file): file is TFile => file !== null).slice(0, 5);
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

  private async renderFiles(root: HTMLElement): Promise<void> {
    const searchBox = root.createDiv({ cls: "ov-search-box" });
    setIcon(searchBox.createSpan(), "search");
    const input = searchBox.createEl("input", {
      type: "search",
      placeholder: "搜索文件名和正文…",
      value: this.searchQuery,
      attr: { "aria-label": "搜索文件名和正文" },
    });
    input.addEventListener("input", () => {
      this.searchQuery = input.value;
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => void this.render(), 250);
    });

    const sequence = ++this.searchSequence;
    let files: TFile[];
    if (this.searchQuery.trim()) {
      const status = root.createDiv({ text: "正在搜索…", cls: "ov-search-status" });
      files = await this.plugin.searchFiles(this.searchQuery);
      if (sequence !== this.searchSequence) return;
      status.remove();
    } else {
      files = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path)).slice(0, 300);
    }
    this.renderSection(root, this.searchQuery.trim() ? `搜索结果（${files.length}）` : `全部笔记（显示 ${files.length}）`, files, "没有匹配的笔记。", true);
  }

  private renderHistory(root: HTMLElement): void {
    const heading = root.createDiv({ cls: "ov-section-heading" });
    heading.createEl("h3", { text: `阅读历史（${this.plugin.settings.history.length}）` });
    const clear = heading.createEl("button", { text: "清空", cls: "mod-warning" });
    clear.disabled = this.plugin.settings.history.length === 0;
    clear.addEventListener("click", () => void this.plugin.clearHistory());
    this.renderTrackedFiles(root, "", this.plugin.settings.history, "暂无阅读历史。", false, false);
  }

  private renderTrackedFiles(root: HTMLElement, title: string, paths: string[], emptyText: string, showFavorite: boolean, showHeading = true): void {
    const files = paths.map((path) => this.plugin.getMarkdownFile(path)).filter((file): file is TFile => file !== null);
    if (showHeading && title) root.createEl("h3", { text: `${title}（${files.length}）`, cls: "ov-section-title" });
    this.renderFileList(root, files, emptyText, showFavorite);
  }

  private renderSection(root: HTMLElement, title: string, files: TFile[], emptyText: string, showFavorite: boolean): void {
    root.createEl("h3", { text: title, cls: "ov-section-title" });
    this.renderFileList(root, files, emptyText, showFavorite);
  }

  private renderFileList(root: HTMLElement, files: TFile[], emptyText: string, showFavorite: boolean): void {
    const list = root.createDiv({ cls: "ov-file-list" });
    if (!files.length) {
      list.createEl("p", { text: emptyText, cls: "ov-empty" });
      return;
    }
    files.forEach((file) => {
      const row = list.createDiv({ cls: "ov-file-row" });
      const open = row.createEl("button", { cls: "ov-file-open" });
      setIcon(open.createSpan({ cls: "ov-file-icon" }), "file-text");
      const labels = open.createSpan({ cls: "ov-file-labels" });
      labels.createEl("strong", { text: file.basename });
      labels.createEl("small", { text: file.path });
      open.addEventListener("click", () => void this.plugin.openFile(file));
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
}
