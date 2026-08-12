import {
  Notice,
  Platform,
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
  normalizePath,
} from "obsidian";
import { GitSyncPortalDashboardView, LEGACY_VIEW_TYPE_GITSYNC_PORT, LEGACY_VIEW_TYPE_VIEWER, VIEW_TYPE_GITSYNC_PORTAL } from "./src/viewer-view";
import { GitSyncPortalSettingTab } from "./src/settings";
import { registerQuizProcessors, QuizProgress } from "./src/quiz";
import { GitHubSyncMode, GitHubSyncService, GitHubSyncStatus } from "./src/github-sync";
import { LANGUAGE_OPTIONS, LanguageSetting, TranslationKey, formatDateTime, translate } from "./src/i18n";

const PLUGIN_ID = "gitsync-portal";
const LEGACY_PLUGIN_IDS = ["gitsync-port", "obsidian-viewer"] as const;
const GITHUB_TOKEN_SECRET_ID = "gitsync-portal-github-token";
const LEGACY_GITHUB_TOKEN_SECRET_IDS = ["gitsync-port-github-token", "obsidian-viewer-github-token"] as const;
const SYNCED_VIEWER_STATE_PATH = `.obsidian/plugins/${PLUGIN_ID}/sync-state.json`;
const LOCAL_SYNC_STATE_PATH = `.obsidian/plugins/${PLUGIN_ID}/local-sync-state.json`;
const PORTAL_SYNC_IGNORE_PATTERNS_WITHOUT_GLOBAL_CONFLICTS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  `.obsidian/plugins/${PLUGIN_ID}/local-sync-state.json`,
  `.obsidian/plugins/${PLUGIN_ID}/*.conflict-*`,
  ...LEGACY_PLUGIN_IDS.map((id) => `.obsidian/plugins/${id}/`),
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/",
].join("\n");
const DEFAULT_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  "*.conflict-*",
  "**/*.conflict-*",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  `.obsidian/plugins/${PLUGIN_ID}/local-sync-state.json`,
  `.obsidian/plugins/${PLUGIN_ID}/*.conflict-*`,
  ...LEGACY_PLUGIN_IDS.map((id) => `.obsidian/plugins/${id}/`),
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/",
].join("\n");
const GITSYNC_PORT_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  ".obsidian/plugins/gitsync-port/local-sync-state.json",
  ".obsidian/plugins/gitsync-port/*.conflict-*",
  ".obsidian/plugins/obsidian-viewer/",
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/",
].join("\n");
const PLUGIN_SYNC_IGNORE_PATTERNS_WITHOUT_CONFLICTS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/page-preview.json",
  ".obsidian/plugins/obsidian-viewer/local-sync-state.json",
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/",
].join("\n");
const DEVICE_LOCAL_PLUGIN_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/community-plugins*.json",
  ".obsidian/core-plugins*.json",
  ".obsidian/page-preview.json",
  ".obsidian/plugins/obsidian-viewer/data.json",
  ".obsidian/plugins/obsidian-git/data.json",
  ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
  ".obsidian/plugins/*/manifest.conflict-*",
  "node_modules/",
].join("\n");
const PREVIOUS_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/plugins/obsidian-viewer/data.json",
  "node_modules/",
].join("\n");
const LEGACY_SYNC_IGNORE_PATTERNS = [
  ".DS_Store",
  ".obsidian/workspace*.json",
  ".obsidian/plugins/obsidian-viewer/data.json",
  ".obsidian/plugins/obsidian-git/data.json",
  "node_modules/",
].join("\n");

export interface ViewerSettings {
  language: LanguageSetting;
  homeNote: string;
  favorites: string[];
  history: string[];
  maxHistory: number;
  openDashboardOnStartup: boolean;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  paragraphSpacing: number;
  quizProgress: Record<string, QuizProgress>;
  syncRepository: string;
  syncBranch: string;
  syncDeviceNameAuto: boolean;
  syncDeviceName: string;
  syncIgnorePatterns: string;
  syncMaxFileSizeMb: number;
  syncOnStartup: boolean;
  syncOnSave: boolean;
  syncPeriodically: boolean;
  syncIntervalMinutes: number;
  lastSyncedCommit: string;
  lastSyncAt: number;
  lastSyncSummary: string;
}

interface ViewerSyncedState {
  version: 1;
  favorites: string[];
  history: string[];
}

interface ViewerLocalSyncState {
  lastSyncedCommit: string;
  lastSyncAt: number;
  lastSyncSummary: string;
}

const DEFAULT_SETTINGS: ViewerSettings = {
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
  lastSyncSummary: "",
};

export default class GitSyncPortalPlugin extends Plugin {
  settings: ViewerSettings = { ...DEFAULT_SETTINGS };
  private searchCache = new Map<string, string>();
  private quizSaveTimer: number | null = null;
  private syncOnSaveTimer: number | null = null;
  private periodicSyncTimer: number | null = null;
  private periodicSyncKey = "";
  syncStatus: GitHubSyncStatus = { stage: "idle", message: "" };
  readonly githubSync = new GitHubSyncService(this, (status) => {
    this.syncStatus = status;
    this.updateDashboardSyncStatus();
  });

  async onload(): Promise<void> {
    await this.loadSettings();
    this.migrateLegacyToken();
    this.registerView(VIEW_TYPE_GITSYNC_PORTAL, (leaf) => new GitSyncPortalDashboardView(leaf, this));
    this.registerView(LEGACY_VIEW_TYPE_GITSYNC_PORT, (leaf) => new GitSyncPortalDashboardView(leaf, this));
    this.registerView(LEGACY_VIEW_TYPE_VIEWER, (leaf) => new GitSyncPortalDashboardView(leaf, this));
    this.addRibbonIcon("refresh-cw", this.t("openDashboard"), () => void this.activateDashboard());

    this.addCommand({
      id: "open-dashboard",
      name: this.t("openReadingDashboard"),
      callback: () => void this.activateDashboard(),
    });
    this.addCommand({
      id: "sync-github-now",
      name: this.t("syncGitHubNow"),
      callback: () => void this.syncNow(),
    });
    this.addCommand({
      id: "pull-github-now",
      name: this.t("pullOnlyLong"),
      callback: () => void this.syncNow(true, "pull-only"),
    });
    this.addCommand({
      id: "push-github-now",
      name: this.t("pushOnlyLong"),
      callback: () => void this.syncNow(true, "push-only"),
    });
    this.addCommand({
      id: "open-home-note",
      name: this.t("openHomeNote"),
      callback: () => void this.openHomeNote(),
    });
    this.addCommand({
      id: "toggle-current-favorite",
      name: this.t("toggleFavorite"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.toggleFavorite(file);
        return true;
      },
    });
    this.addCommand({
      id: "set-current-as-home",
      name: this.t("setCurrentHome"),
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.setHomeNote(file);
        return true;
      },
    });
    this.addCommand({
      id: "toggle-focus-reading",
      name: this.t("toggleFocus"),
      callback: () => {
        document.body.classList.toggle("ov-focus-reading");
        new Notice(this.t(document.body.classList.contains("ov-focus-reading") ? "focusEnabled" : "focusDisabled"));
      },
    });

    this.registerEvent(this.app.workspace.on("file-open", (file) => {
      if (file instanceof TFile && file.extension === "md") void this.recordOpen(file);
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof TFile) this.searchCache.delete(file.path);
      this.scheduleSyncOnSave();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      this.searchCache.delete(file.path);
      if (file instanceof TAbstractFile) void this.removeMissingPath(file.path);
      this.scheduleSyncOnSave();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.searchCache.delete(oldPath);
      if (file instanceof TAbstractFile) void this.renameTrackedPath(oldPath, file.path);
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
        const timer = window.setTimeout(() => void this.syncNow(false), 2000);
        this.register(() => window.clearTimeout(timer));
      }
    });
  }

  onunload(): void {
    document.body.classList.remove("ov-reader-enabled", "ov-focus-reading");
    ["--ov-reader-font-size", "--ov-reader-line-height", "--ov-reader-width", "--ov-reader-paragraph-spacing"]
      .forEach((name) => document.body.style.removeProperty(name));
    if (this.quizSaveTimer !== null) window.clearTimeout(this.quizSaveTimer);
    if (this.syncOnSaveTimer !== null) window.clearTimeout(this.syncOnSaveTimer);
    if (this.periodicSyncTimer !== null) window.clearInterval(this.periodicSyncTimer);
  }

  async loadSettings(): Promise<void> {
    const currentData = (await this.loadData()) as Partial<ViewerSettings> | null;
    const legacyData = currentData ? null : await this.loadLegacyPluginData();
    const loaded = currentData ?? legacyData;
    const localSyncState = await this.loadLocalSyncState(loaded);
    const loadedDeviceName = loaded?.syncDeviceName?.trim() ?? "";
    const syncDeviceNameAuto = typeof loaded?.syncDeviceNameAuto === "boolean"
      ? loaded.syncDeviceNameAuto
      : !loadedDeviceName || AUTO_GENERATED_DEVICE_NAMES.has(loadedDeviceName);
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
      language: isLanguageSetting(loaded?.language) ? loaded.language : "auto",
      syncDeviceNameAuto,
      syncDeviceName: syncDeviceNameAuto ? defaultDeviceName() : loadedDeviceName || defaultDeviceName(),
      favorites: Array.isArray(loaded?.favorites) ? loaded.favorites : [],
      history: Array.isArray(loaded?.history) ? loaded.history : [],
      quizProgress: loaded?.quizProgress && typeof loaded.quizProgress === "object" ? loaded.quizProgress : {},
      lastSyncedCommit: localSyncState.lastSyncedCommit,
      lastSyncAt: localSyncState.lastSyncAt,
      lastSyncSummary: localSyncState.lastSyncSummary,
    };
    let migrated = legacyData !== null
      || loaded?.syncDeviceNameAuto !== syncDeviceNameAuto
      || loaded?.syncDeviceName !== this.settings.syncDeviceName;
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

  async saveSettings(): Promise<void> {
    await this.savePluginData();
    await this.saveLocalSyncState();
    await this.saveSyncedViewerState();
    this.applyReaderSettings();
    this.configurePeriodicSync();
    await this.refreshDashboard();
  }

  getGitHubToken(): string {
    return this.app.secretStorage.getSecret(GITHUB_TOKEN_SECRET_ID)?.trim()
      || LEGACY_GITHUB_TOKEN_SECRET_IDS.map((id) => this.app.secretStorage.getSecret(id)?.trim()).find(Boolean)
      || "";
  }

  setGitHubToken(token: string): void {
    this.app.secretStorage.setSecret(GITHUB_TOKEN_SECRET_ID, token.trim());
  }

  t(key: TranslationKey, values?: Record<string, string | number>): string {
    return translate(this.settings.language, key, values);
  }

  formatDateTime(timestamp: number): string {
    return formatDateTime(this.settings.language, timestamp);
  }

  getLanguageOptions(): typeof LANGUAGE_OPTIONS {
    return LANGUAGE_OPTIONS;
  }

  getCurrentDeviceName(): string {
    return defaultDeviceName();
  }

  async testGitHubConnection(): Promise<string> {
    const result = await this.githubSync.testConnection();
    return `${result.repository} · ${result.branch} · ${result.commitSha.slice(0, 7)}`;
  }

  async syncNow(showNotice = true, mode: GitHubSyncMode = "two-way"): Promise<void> {
    if (this.githubSync.isRunning) {
      if (showNotice) new Notice(this.t("syncAlreadyRunning"));
      return;
    }
    try {
      await this.saveSettings();
      const result = await this.githubSync.sync(mode);
      if (mode !== "push-only") this.settings.lastSyncedCommit = result.commitSha;
      this.settings.lastSyncAt = Date.now();
      this.settings.lastSyncSummary = result.changed
        ? this.t(mode === "pull-only" ? "syncSummaryPull" : mode === "push-only" ? "syncSummaryPush" : "syncSummary", {
          pulled: result.pulled,
          pushed: result.pushed,
          deleted: result.deleted,
          conflicts: result.conflicts,
        })
        : this.t("alreadyInSync");
      await this.saveLocalSyncState();
      await this.loadSettings();
      await this.applySyncedViewerStateFromDisk();
      await this.saveSettings();
      await this.refreshDashboard();
      if (showNotice) new Notice(this.t("syncCompleteNotice", { summary: this.settings.lastSyncSummary }));
    } catch (error) {
      if (showNotice) new Notice(error instanceof Error ? error.message : String(error), 8000);
    }
  }

  applyReaderSettings(): void {
    document.body.classList.add("ov-reader-enabled");
    document.body.style.setProperty("--ov-reader-font-size", `${this.settings.fontSize}px`);
    document.body.style.setProperty("--ov-reader-line-height", String(this.settings.lineHeight));
    document.body.style.setProperty("--ov-reader-width", `${this.settings.contentWidth}px`);
    document.body.style.setProperty("--ov-reader-paragraph-spacing", `${this.settings.paragraphSpacing}em`);
  }

  async activateDashboard(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_GITSYNC_PORTAL)[0]
      ?? this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_GITSYNC_PORT)[0]
      ?? this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_VIEWER)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeftLeaf(false) ?? this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE_GITSYNC_PORTAL, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  async openHomeNote(): Promise<void> {
    const path = this.settings.homeNote;
    const file = path ? this.app.vault.getAbstractFileByPath(path) : null;
    if (!(file instanceof TFile)) {
      new Notice(this.t("missingHomeNote"));
      return;
    }
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  async openFile(file: TFile): Promise<void> {
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  isFavorite(path: string): boolean {
    return this.settings.favorites.includes(path);
  }

  async toggleFavorite(file: TFile | TFolder): Promise<void> {
    const isFavorite = this.isFavorite(file.path);
    const name = file instanceof TFile ? file.basename : file.name || this.t("rootName");
    this.settings.favorites = isFavorite
      ? this.settings.favorites.filter((path) => path !== file.path)
      : [file.path, ...this.settings.favorites.filter((path) => path !== file.path)];
    await this.saveSettings();
    new Notice(this.t(isFavorite ? "removedFavorite" : "addedFavorite", { name }));
  }

  async setHomeNote(file: TFile): Promise<void> {
    this.settings.homeNote = file.path;
    await this.saveSettings();
    new Notice(this.t("homeSet", { name: file.basename }));
  }

  async recordOpen(file: TFile): Promise<void> {
    this.settings.history = [file.path, ...this.settings.history.filter((path) => path !== file.path)]
      .slice(0, this.settings.maxHistory);
    await this.savePluginData();
    await this.saveSyncedViewerState();
    await this.refreshDashboard();
  }

  async clearHistory(): Promise<void> {
    this.settings.history = [];
    await this.saveSettings();
  }

  getMarkdownFile(path: string): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile && file.extension === "md" ? file : null;
  }

  getFileOrFolder(path: string): TFile | TFolder | null {
    const item = this.app.vault.getAbstractFileByPath(path);
    return item instanceof TFile || item instanceof TFolder ? item : null;
  }

  async searchFiles(query: string): Promise<TFile[]> {
    const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    const files = this.app.vault.getMarkdownFiles();
    const results: Array<{ file: TFile; score: number }> = [];

    await Promise.all(files.map(async (file) => {
      const path = file.path.toLocaleLowerCase();
      let content = this.searchCache.get(file.path);
      if (content === undefined) {
        try {
          content = (await this.app.vault.cachedRead(file)).toLocaleLowerCase();
        } catch {
          content = "";
        }
        this.searchCache.set(file.path, content);
      }
      if (!terms.every((term) => path.includes(term) || content.includes(term))) return;
      const score = terms.reduce((total, term) => total + (path.includes(term) ? 10 : 1), 0);
      results.push({ file, score });
    }));

    return results
      .sort((a, b) => b.score - a.score || a.file.basename.localeCompare(b.file.basename) || a.file.path.localeCompare(b.file.path))
      .slice(0, 100)
      .map(({ file }) => file);
  }

  getQuizProgress(key: string): QuizProgress {
    return this.settings.quizProgress[key] ?? { answers: {}, page: 0, submitted: false };
  }

  setQuizProgress(key: string, progress: QuizProgress): void {
    this.settings.quizProgress[key] = progress;
    if (this.quizSaveTimer !== null) window.clearTimeout(this.quizSaveTimer);
    this.quizSaveTimer = window.setTimeout(() => {
      this.quizSaveTimer = null;
      void this.savePluginData();
    }, 250);
  }

  private async refreshDashboard(): Promise<void> {
    const leaves = [
      ...this.app.workspace.getLeavesOfType(VIEW_TYPE_GITSYNC_PORTAL),
      ...this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_GITSYNC_PORT),
      ...this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_VIEWER),
    ];
    await Promise.all(leaves.map((leaf) => {
      const view = leaf.view;
      return view instanceof GitSyncPortalDashboardView ? view.render() : Promise.resolve();
    }));
  }

  private updateDashboardSyncStatus(): void {
    const leaves = [
      ...this.app.workspace.getLeavesOfType(VIEW_TYPE_GITSYNC_PORTAL),
      ...this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_GITSYNC_PORT),
      ...this.app.workspace.getLeavesOfType(LEGACY_VIEW_TYPE_VIEWER),
    ];
    leaves.forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof GitSyncPortalDashboardView) view.updateSyncStatus();
    });
  }

  private scheduleSyncOnSave(): void {
    if (!this.settings.syncOnSave || !this.getGitHubToken() || this.githubSync.isRunning) return;
    if (this.syncOnSaveTimer !== null) window.clearTimeout(this.syncOnSaveTimer);
    this.syncOnSaveTimer = window.setTimeout(() => {
      this.syncOnSaveTimer = null;
      if (!this.settings.syncOnSave || !this.getGitHubToken() || this.githubSync.isRunning) return;
      void this.syncNow(false);
    }, 30_000);
  }

  private configurePeriodicSync(): void {
    const minutes = Math.max(5, this.settings.syncIntervalMinutes);
    const key = `${this.settings.syncPeriodically}:${minutes}`;
    if (key === this.periodicSyncKey) return;
    this.periodicSyncKey = key;
    if (this.periodicSyncTimer !== null) window.clearInterval(this.periodicSyncTimer);
    this.periodicSyncTimer = null;
    if (!this.settings.syncPeriodically) return;
    this.periodicSyncTimer = window.setInterval(() => {
      if (this.getGitHubToken() && !this.githubSync.isRunning) void this.syncNow(false);
    }, minutes * 60_000);
  }

  private async removeMissingPath(path: string): Promise<void> {
    const keep = (entry: string): boolean => entry !== path && !entry.startsWith(`${path}/`);
    this.settings.favorites = this.settings.favorites.filter(keep);
    this.settings.history = this.settings.history.filter(keep);
    if (this.settings.homeNote === path) this.settings.homeNote = "";
    await this.saveSettings();
  }

  private async renameTrackedPath(oldPath: string, newPath: string): Promise<void> {
    const replace = (path: string): string => {
      if (path === oldPath) return newPath;
      if (path.startsWith(`${oldPath}/`)) return `${newPath}${path.slice(oldPath.length)}`;
      return path;
    };
    this.settings.favorites = this.settings.favorites.map(replace);
    this.settings.history = this.settings.history.map(replace);
    if (this.settings.homeNote === oldPath) this.settings.homeNote = newPath;
    await this.saveSettings();
  }

  private async loadSyncedViewerState(): Promise<ViewerSyncedState | null> {
    const path = syncedViewerStatePath(this.app.vault.configDir);
    const sourcePath = await this.app.vault.adapter.exists(path)
      ? path
      : await firstExistingAdapterPath(this, legacyPluginPaths(this.app.vault.configDir, "sync-state.json"));
    if (!sourcePath) return null;
    try {
      const parsed = JSON.parse(await this.app.vault.adapter.read(sourcePath)) as Partial<ViewerSyncedState>;
      return {
        version: 1,
        favorites: normalizeTrackedPaths(parsed.favorites),
        history: normalizeTrackedPaths(parsed.history),
      };
    } catch (error) {
      new Notice(this.t("sharedStateReadFailed", { error: error instanceof Error ? error.message : String(error) }), 8000);
      return null;
    }
  }

  private async applySyncedViewerStateFromDisk(): Promise<boolean> {
    const syncedState = await this.loadSyncedViewerState();
    if (!syncedState) return false;
    this.settings.favorites = syncedState.favorites;
    this.settings.history = syncedState.history.slice(0, this.settings.maxHistory);
    return true;
  }

  private async saveSyncedViewerState(): Promise<void> {
    const path = syncedViewerStatePath(this.app.vault.configDir);
    const state: ViewerSyncedState = {
      version: 1,
      favorites: normalizeTrackedPaths(this.settings.favorites),
      history: normalizeTrackedPaths(this.settings.history).slice(0, this.settings.maxHistory),
    };
    this.settings.favorites = state.favorites;
    this.settings.history = state.history;
    const content = `${JSON.stringify(state, null, 2)}\n`;
    try {
      if (await this.app.vault.adapter.exists(path) && await this.app.vault.adapter.read(path) === content) return;
      await ensureAdapterParentFolders(this, path);
      await this.app.vault.adapter.write(path, content);
    } catch (error) {
      new Notice(this.t("sharedStateWriteFailed", { error: error instanceof Error ? error.message : String(error) }), 8000);
    }
  }

  private async loadLocalSyncState(loaded: Partial<ViewerSettings> | null): Promise<ViewerLocalSyncState> {
    const path = localSyncStatePath(this.app.vault.configDir);
    const fallback: ViewerLocalSyncState = {
      lastSyncedCommit: typeof loaded?.lastSyncedCommit === "string" ? loaded.lastSyncedCommit : DEFAULT_SETTINGS.lastSyncedCommit,
      lastSyncAt: typeof loaded?.lastSyncAt === "number" ? loaded.lastSyncAt : DEFAULT_SETTINGS.lastSyncAt,
      lastSyncSummary: typeof loaded?.lastSyncSummary === "string" ? loaded.lastSyncSummary : DEFAULT_SETTINGS.lastSyncSummary,
    };
    const sourcePath = await this.app.vault.adapter.exists(path)
      ? path
      : await firstExistingAdapterPath(this, legacyPluginPaths(this.app.vault.configDir, "local-sync-state.json"));
    if (!sourcePath) return fallback;
    try {
      const parsed = JSON.parse(await this.app.vault.adapter.read(sourcePath)) as Partial<ViewerLocalSyncState>;
      return {
        lastSyncedCommit: typeof parsed.lastSyncedCommit === "string" ? parsed.lastSyncedCommit : fallback.lastSyncedCommit,
        lastSyncAt: typeof parsed.lastSyncAt === "number" ? parsed.lastSyncAt : fallback.lastSyncAt,
        lastSyncSummary: typeof parsed.lastSyncSummary === "string" ? parsed.lastSyncSummary : fallback.lastSyncSummary,
      };
    } catch {
      return fallback;
    }
  }

  private async saveLocalSyncState(): Promise<void> {
    const path = localSyncStatePath(this.app.vault.configDir);
    const state: ViewerLocalSyncState = {
      lastSyncedCommit: this.settings.lastSyncedCommit,
      lastSyncAt: this.settings.lastSyncAt,
      lastSyncSummary: this.settings.lastSyncSummary,
    };
    await ensureAdapterParentFolders(this, path);
    await this.app.vault.adapter.write(path, `${JSON.stringify(state, null, 2)}\n`);
  }

  private async savePluginData(): Promise<void> {
    const syncedSettings: Partial<ViewerSettings> = { ...this.settings };
    delete syncedSettings.favorites;
    delete syncedSettings.history;
    delete syncedSettings.lastSyncedCommit;
    delete syncedSettings.lastSyncAt;
    delete syncedSettings.lastSyncSummary;
    await this.saveData(syncedSettings);
  }

  private migrateLegacyToken(): void {
    if (this.app.secretStorage.getSecret(GITHUB_TOKEN_SECRET_ID)?.trim()) return;
    const legacyToken = LEGACY_GITHUB_TOKEN_SECRET_IDS
      .map((id) => this.app.secretStorage.getSecret(id)?.trim())
      .find(Boolean);
    if (legacyToken) this.app.secretStorage.setSecret(GITHUB_TOKEN_SECRET_ID, legacyToken);
  }

  private async loadLegacyPluginData(): Promise<Partial<ViewerSettings> | null> {
    for (const path of legacyPluginPaths(this.app.vault.configDir, "data.json")) {
      if (!await this.app.vault.adapter.exists(path)) continue;
      try {
        return JSON.parse(await this.app.vault.adapter.read(path)) as Partial<ViewerSettings>;
      } catch {
        continue;
      }
    }
    return null;
  }
}

function syncedViewerStatePath(configDir: string): string {
  return normalizePath(configDir ? `${configDir}/plugins/${PLUGIN_ID}/sync-state.json` : SYNCED_VIEWER_STATE_PATH);
}

function localSyncStatePath(configDir: string): string {
  return normalizePath(configDir ? `${configDir}/plugins/${PLUGIN_ID}/local-sync-state.json` : LOCAL_SYNC_STATE_PATH);
}

function legacyPluginPaths(configDir: string, filename: string): string[] {
  return LEGACY_PLUGIN_IDS.map((id) => normalizePath(configDir
    ? `${configDir}/plugins/${id}/${filename}`
    : `.obsidian/plugins/${id}/${filename}`));
}

async function firstExistingAdapterPath(plugin: GitSyncPortalPlugin, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    if (await plugin.app.vault.adapter.exists(path)) return path;
  }
  return null;
}

function normalizeTrackedPaths(paths: unknown): string[] {
  if (!Array.isArray(paths)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const path of paths) {
    if (typeof path !== "string") continue;
    const normalized = normalizePath(path.trim());
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

async function ensureAdapterParentFolders(plugin: GitSyncPortalPlugin, path: string): Promise<void> {
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

function defaultDeviceName(): string {
  if (Platform.isIosApp) return "iOS";
  if (Platform.isAndroidApp) return "Android";
  if (Platform.isWin) return "Windows";
  if (Platform.isMacOS) return "macOS";
  if (Platform.isLinux) return "Linux";
  return "Obsidian";
}

const AUTO_GENERATED_DEVICE_NAMES = new Set(["Android", "iOS", "Windows", "macOS", "Linux", "Obsidian"]);

function isLanguageSetting(value: unknown): value is LanguageSetting {
  return typeof value === "string" && value in LANGUAGE_OPTIONS;
}
