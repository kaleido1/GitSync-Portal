import { ItemView, TAbstractFile, TFile, TFolder, WorkspaceLeaf, setIcon } from "obsidian";
import type GitSyncPortalPlugin from "../main";

export const VIEW_TYPE_GITSYNC_PORTAL = "gitsync-portal-dashboard";
export const LEGACY_VIEW_TYPE_GITSYNC_PORT = "gitsync-port-dashboard";
export const LEGACY_VIEW_TYPE_VIEWER = "obsidian-viewer-dashboard";
type DashboardTab = "home" | "files" | "favorites" | "history";
type ViewerListItem = TFile | TFolder;
const HISTORY_BATCH_SIZE = 40;
const DASHBOARD_SCROLL_STATE_KEY_PREFIX = "gitsync-portal:dashboard-scroll:";
let savedDashboardScrollTop = 0;

export class GitSyncPortalDashboardView extends ItemView {
  private activeTab: DashboardTab = "home";
  private searchQuery = "";
  private searchSequence = 0;
  private searchTimer: number | null = null;
  private syncUpdateFrame: number | null = null;
  private isSearchComposing = false;
  private currentFolderPath = "";
  private folderBackStack: string[] = [];
  private folderForwardStack: string[] = [];
  private historyVisibleCount = HISTORY_BATCH_SIZE;
  private scrollSaveTimer: number | null = null;
  private scrollRestoreFrame: number | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: GitSyncPortalPlugin) {
    super(leaf);
    savedDashboardScrollTop = this.loadSavedScrollTop();
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
    // On mobile, the drawer can make an ancestor (not contentEl itself) the
    // scrolling element, so subscribe to every possible Portal scroll parent.
    this.getScrollContainers().forEach((container) => {
      this.registerDomEvent(container, "scroll", () => {
        if (container.scrollTop <= 0) return;
        savedDashboardScrollTop = container.scrollTop;
        this.scheduleScrollSave();
      }, { passive: true });
    });
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) this.scheduleScrollRestore();
      });
      observer.observe(this.contentEl);
      this.register(() => observer.disconnect());
    }
    await this.render();
  }

  async onClose(): Promise<void> {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    if (this.syncUpdateFrame !== null) window.cancelAnimationFrame(this.syncUpdateFrame);
    if (this.scrollSaveTimer !== null) window.clearTimeout(this.scrollSaveTimer);
    if (this.scrollRestoreFrame !== null) window.cancelAnimationFrame(this.scrollRestoreFrame);
    this.captureScrollTop();
    this.saveScrollTop();
  }

  async render(): Promise<void> {
    const root = this.contentEl;
    const searchFocus = this.captureSearchFocus(root);
    const scrollTop = root.scrollTop || savedDashboardScrollTop;
    root.empty();
    root.addClass("ov-dashboard");

    const header = root.createDiv({ cls: "ov-dashboard-header" });
    const brand = header.createDiv({ cls: "ov-dashboard-brand" });
    setIcon(brand.createSpan({ cls: "ov-brand-icon" }), "cloud-cog");
    const titleBox = brand.createDiv();
    titleBox.createEl("h2", { text: this.plugin.t("appName") });
    titleBox.createEl("small", { text: this.plugin.t("notesCount", { count: this.app.vault.getMarkdownFiles().length }) });
    const refresh = header.createEl("button", { cls: "clickable-icon ov-icon-button", attr: { "aria-label": this.plugin.t("refresh") } });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.render());

    this.renderTabs(root);

    if (this.activeTab === "home") {
      this.renderActiveNote(root);
      await this.renderHome(root);
    }
    if (this.activeTab === "files") await this.renderFiles(root, searchFocus);
    if (this.activeTab === "favorites") this.renderTrackedItems(root, this.plugin.t("tabFavorites"), this.plugin.settings.favorites, this.plugin.t("noFavorites"), true);
    if (this.activeTab === "history") this.renderHistory(root);
    this.restoreScrollTop(scrollTop);
  }

  private restoreScrollTop(scrollTop: number): void {
    savedDashboardScrollTop = scrollTop;
    this.applyScrollTop(scrollTop);
    this.scheduleScrollRestore();
  }

  private captureScrollTop(): void {
    for (const element of this.getScrollContainers()) {
      if (element.scrollTop > 0) {
        savedDashboardScrollTop = element.scrollTop;
        return;
      }
    }
  }

  private applyScrollTop(scrollTop: number): void {
    this.getScrollContainers().forEach((element) => {
      element.scrollTop = scrollTop;
    });
  }

  private getScrollContainers(): HTMLElement[] {
    const containers: HTMLElement[] = [];
    let element: HTMLElement | null = this.contentEl;
    while (element && element !== document.body) {
      const overflowY = window.getComputedStyle(element).overflowY;
      if (element === this.contentEl || overflowY === "auto" || overflowY === "scroll") containers.push(element);
      if (element.classList.contains("workspace-drawer")) break;
      element = element.parentElement;
    }
    return containers;
  }

  private scheduleScrollRestore(): void {
    if (this.scrollRestoreFrame !== null) window.cancelAnimationFrame(this.scrollRestoreFrame);
    this.scrollRestoreFrame = window.requestAnimationFrame(() => {
      this.scrollRestoreFrame = null;
      this.applyScrollTop(savedDashboardScrollTop);
    });
  }

  private scrollStateKey(): string {
    return `${DASHBOARD_SCROLL_STATE_KEY_PREFIX}${this.app.vault.getName()}`;
  }

  private loadSavedScrollTop(): number {
    try {
      const value = Number(window.localStorage.getItem(this.scrollStateKey()));
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  private scheduleScrollSave(): void {
    if (this.scrollSaveTimer !== null) window.clearTimeout(this.scrollSaveTimer);
    this.scrollSaveTimer = window.setTimeout(() => {
      this.scrollSaveTimer = null;
      this.saveScrollTop();
    }, 150);
  }

  private saveScrollTop(): void {
    try {
      window.localStorage.setItem(this.scrollStateKey(), String(savedDashboardScrollTop));
    } catch {
      // Device-local state must not prevent Portal from opening.
    }
  }

  private renderTabs(root: HTMLElement): void {
    const tabs = root.createDiv({ cls: "ov-tabs", attr: { role: "tablist" } });
    const choices: Array<[DashboardTab, string, string]> = [
      ["home", this.plugin.t("tabHome"), "home"],
      ["files", this.plugin.t("tabFiles"), "files"],
      ["favorites", this.plugin.t("tabFavorites"), "star"],
      ["history", this.plugin.t("tabHistory"), "history"],
    ];
    choices.forEach(([tab, label, icon]) => {
      const button = tabs.createEl("button", {
        cls: `ov-tab${this.activeTab === tab ? " is-active" : ""}`,
        attr: { role: "tab", "aria-selected": String(this.activeTab === tab) },
      });
      setIcon(button.createSpan({ cls: "ov-tab-icon" }), icon);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        this.activeTab = tab;
        this.searchQuery = "";
        if (tab === "history") this.historyVisibleCount = HISTORY_BATCH_SIZE;
        void this.render();
      });
    });
  }

  private renderActiveNote(root: HTMLElement): void {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== "md") return;
    const card = root.createDiv({ cls: "ov-active-card" });
    setIcon(card.createSpan({ cls: "ov-active-note-icon" }), "file-text");
    const labels = card.createDiv({ cls: "ov-active-note-labels" });
    labels.createEl("small", { text: this.plugin.t("currentNote") });
    labels.createEl("strong", { text: file.basename });
    const actions = card.createDiv({ cls: "ov-inline-actions" });
    this.iconButton(actions, "star", this.plugin.t(this.plugin.isFavorite(file.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(file), this.plugin.isFavorite(file.path));
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

    this.renderOutline(root);

    const recent = this.plugin.settings.history.map((path) => this.plugin.getMarkdownFile(path)).filter((file): file is TFile => file !== null).slice(0, 8);
    this.renderSection(root, this.plugin.t("recentReading"), recent, this.plugin.t("recentReadingEmpty"), false);
  }

  private renderSyncCard(root: HTMLElement): void {
    const status = this.plugin.syncStatus;
    const card = root.createDiv({ cls: `ov-sync-card is-${status.stage}` });
    const header = card.createDiv({ cls: "ov-sync-card-header" });
    const title = header.createDiv();
    title.createEl("strong", { text: this.plugin.t("githubSync") });
    title.createEl("small", { text: `${this.plugin.settings.syncRepository} · ${this.plugin.settings.syncBranch || this.plugin.t("defaultBranch")}` });
    const sync = header.createEl("button", { cls: "mod-cta ov-sync-primary" });
    setIcon(sync.createSpan(), "refresh-cw");
    sync.createSpan({ text: this.plugin.t(this.plugin.githubSync.isRunning ? "syncing" : "syncNow") });
    sync.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    sync.addEventListener("click", () => void this.plugin.syncNow());
    card.createDiv({
      text: this.plugin.getGitHubToken() ? status.message : this.plugin.t("tokenMissing"),
      cls: "ov-sync-message",
    });
    const directionalActions = card.createDiv({ cls: "ov-sync-direction-actions" });
    const pull = directionalActions.createEl("button", {
      cls: "ov-tonal-button",
      attr: { title: this.plugin.t("pullOnlyHint"), "aria-label": this.plugin.t("pullOnlyLong") },
    });
    setIcon(pull.createSpan(), "cloud-download");
    pull.createSpan({ text: this.plugin.t("pullOnly") });
    pull.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    pull.addEventListener("click", () => void this.plugin.syncNow(true, "pull-only"));
    const push = directionalActions.createEl("button", {
      cls: "ov-tonal-button",
      attr: { title: this.plugin.t("pushOnlyHint"), "aria-label": this.plugin.t("pushOnlyLong") },
    });
    setIcon(push.createSpan(), "cloud-upload");
    push.createSpan({ text: this.plugin.t("pushOnly") });
    push.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    push.addEventListener("click", () => void this.plugin.syncNow(true, "push-only"));
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

  updateSyncStatus(): void {
    if (this.syncUpdateFrame !== null) return;
    this.syncUpdateFrame = window.requestAnimationFrame(() => {
      this.syncUpdateFrame = null;
      this.applySyncStatus();
    });
  }

  private applySyncStatus(): void {
    const current = this.contentEl.querySelector<HTMLElement>(".ov-sync-card");
    if (!current) return;
    const status = this.plugin.syncStatus;
    current.className = `ov-sync-card is-${status.stage}`;
    const message = current.querySelector<HTMLElement>(".ov-sync-message");
    if (message) message.textContent = this.plugin.getGitHubToken() ? status.message : this.plugin.t("tokenMissing");
    current.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.disabled = this.plugin.githubSync.isRunning || !this.plugin.getGitHubToken();
    });
    const primaryLabel = current.querySelector<HTMLElement>(".ov-sync-primary span:last-child");
    if (primaryLabel) primaryLabel.textContent = this.plugin.t(this.plugin.githubSync.isRunning ? "syncing" : "syncNow");

    let progress = current.querySelector<HTMLProgressElement>("progress");
    if (status.total && status.current !== undefined) {
      if (!progress) progress = current.createEl("progress");
      progress.value = status.current;
      progress.max = status.total;
    } else {
      progress?.remove();
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
        labels.createEl("small", { text: this.plugin.t("itemCount", { count: child.children.length }) });
        open.addEventListener("click", () => this.openFolder(child.path, true));
        this.iconButton(row, "star", this.plugin.t(this.plugin.isFavorite(child.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(child), this.plugin.isFavorite(child.path));
        return;
      }
      if (child instanceof TFile) {
        this.markSelectedFile(row, child);
        setIcon(open.createSpan({ cls: "ov-file-icon" }), child.extension === "md" ? "file-text" : "file");
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

  private renderHistory(root: HTMLElement): void {
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
        cls: "ov-load-more ov-tonal-button",
      });
      more.addEventListener("click", () => {
        this.historyVisibleCount += HISTORY_BATCH_SIZE;
        void this.render();
      });
    }
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
      labels.createEl("small", {
        text: file instanceof TFolder
          ? `${this.plugin.t("itemCount", { count: file.children.length })} · ${this.parentLabel(file.path)}`
          : this.fileMeta(file),
      });
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
        this.iconButton(row, "star", this.plugin.t(this.plugin.isFavorite(file.path) ? "unfavorite" : "favorite"), () => void this.plugin.toggleFavorite(file), this.plugin.isFavorite(file.path));
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

  private iconButton(root: HTMLElement, icon: string, label: string, action: () => void, active = false): HTMLButtonElement {
    const button = root.createEl("button", {
      cls: `clickable-icon ov-icon-button${active ? " is-active" : ""}`,
      attr: { "aria-label": label, title: label, ...(active ? { "aria-pressed": "true" } : {}) },
    });
    setIcon(button, icon);
    button.addEventListener("click", action);
    return button;
  }

  private fileMeta(file: TFile): string {
    const parent = this.parentLabel(file.path);
    return `${parent} · ${file.extension.toLocaleUpperCase()}`;
  }

  private parentLabel(path: string): string {
    const slash = path.lastIndexOf("/");
    return slash > 0 ? path.slice(0, slash) : this.plugin.t("vaultRoot");
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
