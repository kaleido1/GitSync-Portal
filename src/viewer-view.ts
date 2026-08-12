import { ItemView, TAbstractFile, TFile, TFolder, WorkspaceLeaf, setIcon } from "obsidian";
import type GitSyncPortalPlugin from "../main";

export const VIEW_TYPE_GITSYNC_PORTAL = "gitsync-portal-dashboard";
export const LEGACY_VIEW_TYPE_GITSYNC_PORT = "gitsync-port-dashboard";
export const LEGACY_VIEW_TYPE_VIEWER = "obsidian-viewer-dashboard";
type DashboardTab = "home" | "files" | "favorites" | "history";
type ViewerListItem = TFile | TFolder;

export class GitSyncPortalDashboardView extends ItemView {
  private activeTab: DashboardTab = "home";
  private searchQuery = "";
  private searchSequence = 0;
  private searchTimer: number | null = null;
  private isSearchComposing = false;
  private currentFolderPath = "";
  private folderBackStack: string[] = [];
  private folderForwardStack: string[] = [];

  constructor(leaf: WorkspaceLeaf, private readonly plugin: GitSyncPortalPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_GITSYNC_PORTAL;
  }

  getDisplayText(): string {
    return this.plugin.t("appName");
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
    const scrollTop = root.scrollTop;
    root.empty();
    root.addClass("ov-dashboard");

    const header = root.createDiv({ cls: "ov-dashboard-header" });
    const titleBox = header.createDiv();
    titleBox.createEl("h2", { text: this.plugin.t("appName") });
    titleBox.createEl("small", { text: this.plugin.t("notesCount", { count: this.app.vault.getMarkdownFiles().length }) });
    const refresh = header.createEl("button", { cls: "clickable-icon ov-icon-button", attr: { "aria-label": this.plugin.t("refresh") } });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.render());

    this.renderTabs(root);
    this.renderActiveNote(root);

    if (this.activeTab === "home") await this.renderHome(root);
    if (this.activeTab === "files") await this.renderFiles(root, searchFocus);
    if (this.activeTab === "favorites") this.renderTrackedItems(root, this.plugin.t("tabFavorites"), this.plugin.settings.favorites, this.plugin.t("noFavorites"), true);
    if (this.activeTab === "history") this.renderHistory(root);
    root.scrollTop = scrollTop;
  }

  private renderTabs(root: HTMLElement): void {
    const tabs = root.createDiv({ cls: "ov-tabs" });
    const choices: Array<[DashboardTab, string, string]> = [
      ["home", this.plugin.t("tabHome"), "home"],
      ["files", this.plugin.t("tabFiles"), "files"],
      ["favorites", this.plugin.t("tabFavorites"), "star"],
      ["history", this.plugin.t("tabHistory"), "history"],
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
    card.createEl("small", { text: this.plugin.t("currentNote") });
    card.createEl("strong", { text: file.basename });
    card.createEl("span", { text: file.path, cls: "ov-muted ov-path" });
    const actions = card.createDiv({ cls: "ov-inline-actions" });
    this.iconButton(actions, this.plugin.isFavorite(file.path) ? "star-off" : "star", this.plugin.t(this.plugin.isFavorite(file.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(file));
    this.iconButton(actions, "house-plus", this.plugin.t("setAsHome"), () => void this.plugin.setHomeNote(file));
  }

  private async renderHome(root: HTMLElement): Promise<void> {
    const home = this.plugin.getMarkdownFile(this.plugin.settings.homeNote);
    const hero = root.createDiv({ cls: "ov-home-card" });
    hero.createEl("div", { text: this.plugin.t("homeNoteCard"), cls: "ov-eyebrow" });
    hero.createEl("h3", { text: home?.basename ?? this.plugin.t("notSet") });
    hero.createEl("p", {
      text: home ? home.path : this.plugin.t("homeNoteHint"),
      cls: "ov-muted",
    });
    const heroActions = hero.createDiv({ cls: "ov-inline-actions" });
    const openHome = heroActions.createEl("button", { text: this.plugin.t("openHome"), cls: "mod-cta" });
    openHome.disabled = !home;
    openHome.addEventListener("click", () => void this.plugin.openHomeNote());

    this.renderSyncCard(root);

    const favorites = this.plugin.settings.favorites.map((path) => this.plugin.getFileOrFolder(path)).filter((item): item is ViewerListItem => item !== null).slice(0, 5);
    this.renderSection(root, this.plugin.t("tabFavorites"), favorites, this.plugin.t("noFavoriteNotes"), true);

    const recent = this.plugin.settings.history.map((path) => this.plugin.getMarkdownFile(path)).filter((file): file is TFile => file !== null).slice(0, 8);
    this.renderSection(root, this.plugin.t("recentReading"), recent, this.plugin.t("recentReadingEmpty"), false);

    this.renderOutline(root);
  }

  private renderSyncCard(root: HTMLElement): void {
    const status = this.plugin.syncStatus;
    const card = root.createDiv({ cls: `ov-sync-card is-${status.stage}` });
    const header = card.createDiv({ cls: "ov-sync-card-header" });
    const title = header.createDiv();
    title.createEl("strong", { text: this.plugin.t("githubSync") });
    title.createEl("small", { text: `${this.plugin.settings.syncRepository} · ${this.plugin.settings.syncBranch || this.plugin.t("defaultBranch")}` });
    const sync = header.createEl("button", { text: this.plugin.t(this.plugin.githubSync.isRunning ? "syncing" : "syncNow"), cls: "mod-cta" });
    sync.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    sync.addEventListener("click", () => void this.plugin.syncNow());
    card.createDiv({
      text: this.plugin.getGitHubToken() ? status.message : this.plugin.t("tokenMissing"),
      cls: "ov-sync-message",
    });
    if (status.total && status.current !== undefined) {
      const progress = card.createEl("progress", { attr: { max: String(status.total), value: String(status.current) } });
      progress.value = status.current;
      progress.max = status.total;
    }
    if (this.plugin.settings.lastSyncAt) {
      card.createEl("small", {
        text: `${this.plugin.formatDateTime(this.plugin.settings.lastSyncAt)} · ${this.plugin.settings.lastSyncSummary || this.plugin.t("notSynced")}`,
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
      placeholder: this.plugin.t("searchPlaceholder"),
      value: this.searchQuery,
      attr: { "aria-label": this.plugin.t("searchPlaceholder") },
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
      results.createDiv({ text: this.plugin.t("searching"), cls: "ov-search-status" });
      const files = await this.plugin.searchFiles(this.searchQuery);
      if (sequence !== this.searchSequence || !results.isConnected) return;
      results.empty();
      this.renderSection(results, this.plugin.t("searchResults", { count: files.length }), files, this.plugin.t("noMatches"), true);
    } else {
      this.renderDirectory(results);
    }
  }

  private renderDirectory(root: HTMLElement): void {
    const folder = this.getCurrentFolder();
    const controls = root.createDiv({ cls: "ov-directory-controls" });
    this.iconButton(controls, "arrow-left", this.plugin.t("back"), () => this.navigateHistory(-1)).disabled = this.folderBackStack.length === 0;
    this.iconButton(controls, "arrow-right", this.plugin.t("forward"), () => this.navigateHistory(1)).disabled = this.folderForwardStack.length === 0;
    this.iconButton(controls, "arrow-up", this.plugin.t("parentFolder"), () => this.openParentFolder()).disabled = !this.currentFolderPath;
    const location = controls.createDiv({ cls: "ov-directory-location" });
    setIcon(location.createSpan(), "folder-open");
    location.createSpan({ text: this.currentFolderPath || this.plugin.t("vaultRoot") });

    this.renderBreadcrumbs(root);
    const children = [...folder.children].sort(compareVaultItems);
    this.renderDirectoryList(root, children);
  }

  private renderBreadcrumbs(root: HTMLElement): void {
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

  private renderDirectoryList(root: HTMLElement, children: TAbstractFile[]): void {
    root.createEl("h3", { text: this.plugin.t("folderTitle", { name: this.currentFolderPath || this.plugin.t("rootFolder"), count: children.length }), cls: "ov-section-title" });
    const list = root.createDiv({ cls: "ov-file-list" });
    if (!children.length) {
      list.createEl("p", { text: this.plugin.t("emptyFolder"), cls: "ov-empty" });
      return;
    }
    children.forEach((child) => {
      const row = list.createDiv({ cls: "ov-file-row" });
      const open = row.createEl("button", { cls: "ov-file-open" });
      if (child instanceof TFolder) {
        setIcon(open.createSpan({ cls: "ov-file-icon" }), "folder");
        const labels = open.createSpan({ cls: "ov-file-labels" });
        labels.createEl("strong", { text: child.name || this.plugin.t("rootFolder") });
        labels.createEl("small", { text: `${this.plugin.t("itemCount", { count: child.children.length })} · ${child.path || this.plugin.t("vaultRoot")}` });
        open.addEventListener("click", () => this.openFolder(child.path, true));
        this.iconButton(row, this.plugin.isFavorite(child.path) ? "star-off" : "star", this.plugin.t(this.plugin.isFavorite(child.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(child));
        return;
      }
      if (child instanceof TFile) {
        this.markSelectedFile(row, child);
        setIcon(open.createSpan({ cls: "ov-file-icon" }), child.extension === "md" ? "file-text" : "file");
        const labels = open.createSpan({ cls: "ov-file-labels" });
        labels.createEl("strong", { text: child.basename });
        labels.createEl("small", { text: child.path });
        open.addEventListener("click", () => this.selectAndOpenFile(row, child));
        if (child.extension === "md") {
          this.iconButton(row, this.plugin.isFavorite(child.path) ? "star-off" : "star", this.plugin.t(this.plugin.isFavorite(child.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(child));
        }
      }
    });
  }

  private renderHistory(root: HTMLElement): void {
    const heading = root.createDiv({ cls: "ov-section-heading" });
    heading.createEl("h3", { text: this.plugin.t("readingHistory", { count: this.plugin.settings.history.length }) });
    const clear = heading.createEl("button", { text: this.plugin.t("clear"), cls: "mod-warning" });
    clear.disabled = this.plugin.settings.history.length === 0;
    clear.addEventListener("click", () => void this.plugin.clearHistory());
    this.renderTrackedItems(root, "", this.plugin.settings.history, this.plugin.t("noHistory"), false, false);
  }

  private renderTrackedItems(root: HTMLElement, title: string, paths: string[], emptyText: string, showFavorite: boolean, showHeading = true): void {
    const items = paths
      .map((path) => showFavorite ? this.plugin.getFileOrFolder(path) : this.plugin.getMarkdownFile(path))
      .filter((item): item is ViewerListItem => item !== null);
    if (showHeading && title) root.createEl("h3", { text: this.plugin.t("folderTitle", { name: title, count: items.length }), cls: "ov-section-title" });
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
      if (file instanceof TFile) this.markSelectedFile(row, file);
      const open = row.createEl("button", { cls: "ov-file-open" });
      setIcon(open.createSpan({ cls: "ov-file-icon" }), file instanceof TFolder ? "folder" : "file-text");
      const labels = open.createSpan({ cls: "ov-file-labels" });
      labels.createEl("strong", { text: file instanceof TFolder ? file.name || this.plugin.t("rootFolder") : file.basename });
      labels.createEl("small", { text: file instanceof TFolder ? `${this.plugin.t("itemCount", { count: file.children.length })} · ${file.path || this.plugin.t("vaultRoot")}` : file.path });
      open.addEventListener("click", () => {
        if (file instanceof TFolder) {
          this.activeTab = "files";
          this.searchQuery = "";
          this.openFolder(file.path, true);
        } else {
          this.selectAndOpenFile(row, file);
        }
      });
      if (showFavorite) {
        this.iconButton(row, this.plugin.isFavorite(file.path) ? "star-off" : "star", this.plugin.t(this.plugin.isFavorite(file.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(file));
      }
    });
  }

  private renderOutline(root: HTMLElement): void {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile)) return;
    const headings = this.app.metadataCache.getFileCache(file)?.headings ?? [];
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

  private iconButton(root: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
    const button = root.createEl("button", { cls: "clickable-icon ov-icon-button", attr: { "aria-label": label, title: label } });
    setIcon(button, icon);
    button.addEventListener("click", action);
    return button;
  }

  private markSelectedFile(row: HTMLElement, file: TFile): void {
    if (this.app.workspace.getActiveFile()?.path !== file.path) return;
    row.addClass("is-selected");
    row.setAttribute("aria-current", "true");
  }

  private selectAndOpenFile(row: HTMLElement, file: TFile): void {
    this.contentEl.querySelectorAll<HTMLElement>(".ov-file-row.is-selected").forEach((selected) => {
      selected.removeClass("is-selected");
      selected.removeAttribute("aria-current");
    });
    row.addClass("is-selected");
    row.setAttribute("aria-current", "true");
    void this.plugin.openFile(file);
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
