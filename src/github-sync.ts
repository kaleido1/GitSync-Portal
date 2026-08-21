import ignore from "ignore";
import {
  TFile,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  normalizePath,
  requestUrl,
} from "obsidian";
import type GitSyncPortalPlugin from "../main";

const API_ROOT = "https://api.github.com";
const API_VERSION = "2026-03-10";
const HARD_EXCLUDES = [".git/", ".trash/"];
const GENERATED_CONFLICT_COPY = /(?:^|\/)[^/]+\.conflict-[a-z0-9_-]+-\d{8}T\d{6}Z(?:-\d+)?(?:\.[^/]+)?$/i;
const LEGACY_PLUGIN_IDS = new Set(["gitsync-port", "obsidian-viewer"]);
const MAX_SYNC_ATTEMPTS = 5;
const MAX_REF_UPDATE_ATTEMPTS = 8;
const MAX_REMOTE_RETRY_DELAY_MS = 15_000;
const MASS_DELETION_MINIMUM = 20;
const MASS_DELETION_RATIO = 0.25;

interface GitHubRepository {
  default_branch: string;
  full_name: string;
}

interface GitReference {
  object: { sha: string };
}

interface GitCommit {
  sha: string;
  tree: { sha: string };
}

interface GitTreeResponse {
  sha: string;
  truncated: boolean;
  tree: GitTreeItem[];
}

interface GitTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

interface TreeEntry {
  path: string;
  mode: string;
  type: "blob";
  sha: string | null;
}

interface GitBlob {
  content: string;
  encoding: string;
  sha: string;
}

interface GitHubPathCommit {
  commit?: {
    author?: { date?: string };
    committer?: { date?: string };
  };
}

interface RemoteFile {
  path: string;
  sha: string;
  mode: string;
  size: number;
}

interface RemoteSnapshot {
  commitSha: string;
  treeSha: string;
  files: Map<string, RemoteFile>;
}

interface LocalFile {
  path: string;
  sha: string;
  mtime: number;
}

interface ReconcilePlan {
  upload: Map<string, LocalFile | null>;
  pull: Array<{ path: string; remote: RemoteFile | null }>;
  conflicts: Array<{ path: string; local: LocalFile; remote: RemoteFile | null }>;
}

interface PullOnlyPlan {
  pull: Array<{ path: string; remote: RemoteFile | null }>;
  conflicts: Array<{ path: string; local: LocalFile; remote: RemoteFile | null }>;
}

interface PushOnlyPlan {
  upload: Map<string, LocalFile | null>;
  conflicts: Array<{ path: string; local: LocalFile | null; remote: RemoteFile | null }>;
}

export type GitHubSyncMode = "two-way" | "pull-only" | "push-only";

export interface GitHubSyncResult {
  mode: GitHubSyncMode;
  branch: string;
  commitSha: string;
  pulled: number;
  pushed: number;
  deleted: number;
  conflicts: number;
  changed: boolean;
}

export type GitHubSyncStage =
  | "idle"
  | "connecting"
  | "scanning"
  | "reconciling"
  | "pulling"
  | "pushing"
  | "complete"
  | "error";

export interface GitHubSyncStatus {
  stage: GitHubSyncStage;
  message: string;
  current?: number;
  total?: number;
}

type IgnoreScope = "push" | "pull";

export class GitHubSyncService {
  private running = false;
  private configuredIgnoreRules: string[] = [];
  private gitignoreRules: string[] = [];

  constructor(
    private readonly plugin: GitSyncPortalPlugin,
    private readonly onStatus: (status: GitHubSyncStatus) => void,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  private async loadIgnoreRules(): Promise<void> {
    this.configuredIgnoreRules = parseIgnorePatterns(this.plugin.settings.syncIgnorePatterns);
    this.gitignoreRules = [];
    if (this.plugin.settings.syncUseGitignore === false) return;

    try {
      const gitignoreFile = this.plugin.app.vault.getFileByPath(".gitignore");
      if (gitignoreFile) {
        this.gitignoreRules = parseIgnorePatterns(await this.plugin.app.vault.read(gitignoreFile));
        return;
      }
      if (await this.plugin.app.vault.adapter.exists(".gitignore")) {
        this.gitignoreRules = parseIgnorePatterns(await this.plugin.app.vault.adapter.read(".gitignore"));
      }
    } catch {
      // A missing or unreadable .gitignore must not disable normal syncing.
      this.gitignoreRules = [];
    }
  }

  async testConnection(): Promise<{ repository: string; branch: string; commitSha: string }> {
    await this.loadIgnoreRules();
    const token = this.requireToken();
    const repository = await this.getRepository(token);
    const branch = this.plugin.settings.syncBranch.trim() || repository.default_branch;
    const head = await this.getHead(token, branch);
    return { repository: repository.full_name, branch, commitSha: head.commitSha };
  }

  async sync(mode: GitHubSyncMode = "two-way"): Promise<GitHubSyncResult> {
    if (this.running) throw new Error(this.plugin.t("syncAlreadyRunning"));
    this.running = true;
    try {
      await this.loadIgnoreRules();
      const token = this.requireToken();
      this.update("connecting", this.plugin.t("statusConnecting"));
      const repository = await this.getRepository(token);
      const branch = this.plugin.settings.syncBranch.trim() || repository.default_branch;
      let latestRemoteChange: RemoteChangedDuringSyncError | null = null;
      for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt++) {
        try {
          if (attempt > 1) {
            this.update("connecting", this.plugin.t("statusRemoteRetry", { attempt }));
            await sleep(remoteRetryDelay(attempt));
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
      throw latestRemoteChange ?? new Error(this.plugin.t("syncRetryFailed"));
    } catch (error) {
      this.update("error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.running = false;
    }
  }

  private async syncAttempt(token: string, branch: string, mode: GitHubSyncMode = "two-way"): Promise<GitHubSyncResult> {
    const remote = await this.getHead(token, branch);
    const base = this.plugin.settings.lastSyncedCommit
      ? await this.tryGetSnapshot(token, this.plugin.settings.lastSyncedCommit)
      : null;

    this.update("scanning", this.plugin.t("statusHashing"));
    const local = await this.getLocalSnapshot();
    if (base) {
      if (mode !== "pull-only") this.assertNoMassDeletion("local", base.files, local);
      if (mode !== "push-only") this.assertNoMassDeletion("remote", base.files, remote.files);
    }
    if (mode === "pull-only") return this.pullOnly(token, branch, remote, base?.files ?? null, local);
    if (mode === "push-only") return this.pushOnly(token, branch, remote, base?.files ?? null, local);

    const plan = createReconcilePlan(local, remote.files, base?.files ?? null);
    this.update("reconciling", this.plugin.t("statusReconciling"));

    let pulled = 0;
    let deleted = 0;
    let conflicts = 0;
    const upload = new Map(plan.upload);
    const protectedConflicts = new Set<string>();
    const localWins = new Set<string>();

    const conflictDecisions = await mapWithConcurrency(plan.conflicts, 6, async (conflict) => ({
      conflict,
      remoteModifiedAt: await this.getRemoteModifiedAt(token, branch, conflict.path),
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
      ...plan.conflicts
        .filter(({ path }) => !protectedConflicts.has(path) && !localWins.has(path))
        .map(({ path, remote: remoteFile }) => ({ path, remote: remoteFile })),
      ...plan.pull.filter(({ path, remote: remoteFile }) => {
        if (remoteFile || !this.isSelfCoreFile(path)) return true;
        const localFile = local.get(path);
        if (localFile) upload.set(path, localFile);
        return false;
      }),
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
          if (existing) await this.plugin.app.fileManager.trashFile(existing);
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
      const { entries, uploaded, removed } = await this.buildUploadEntries(token, upload);
      pushed = uploaded + removed;
      if (entries.length) commitSha = await this.pushEntriesWithRemoteRetry(token, branch, remote, entries);
    }

    const result: GitHubSyncResult = {
      mode,
      branch,
      commitSha,
      pulled,
      pushed,
      deleted,
      conflicts,
      changed: pulled + pushed + deleted + conflicts > 0,
    };
    this.update("complete", this.plugin.t(result.changed ? "statusComplete" : "alreadyInSync"));
    return result;
  }

  private async pullOnly(
    token: string,
    branch: string,
    remote: RemoteSnapshot,
    base: Map<string, RemoteFile> | null,
    local: Map<string, LocalFile>,
  ): Promise<GitHubSyncResult> {
    const plan = createPullOnlyPlan(local, remote.files, base);
    this.update("reconciling", this.plugin.t("statusReconcilingPull"));
    const protectedPaths = new Set<string>();

    for (const conflict of plan.conflicts) {
      if (!conflict.remote && this.isSelfCoreFile(conflict.path)) {
        protectedPaths.add(conflict.path);
        continue;
      }
      await this.createConflictCopy(conflict.local);
    }

    const operations = [
      ...plan.conflicts
        .filter(({ path }) => !protectedPaths.has(path))
        .map(({ path, remote: remoteFile }) => ({ path, remote: remoteFile })),
      ...plan.pull.filter(({ path, remote: remoteFile }) => remoteFile || !this.isSelfCoreFile(path)),
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
    const result: GitHubSyncResult = {
      mode: "pull-only",
      branch,
      commitSha: remote.commitSha,
      pulled,
      pushed: 0,
      deleted,
      conflicts,
      changed: pulled + deleted + conflicts > 0,
    };
    this.update("complete", this.plugin.t(result.changed ? "statusCompletePull" : "alreadyInSync"));
    return result;
  }

  private async pushOnly(
    token: string,
    branch: string,
    remote: RemoteSnapshot,
    base: Map<string, RemoteFile> | null,
    local: Map<string, LocalFile>,
  ): Promise<GitHubSyncResult> {
    const plan = createPushOnlyPlan(local, remote.files, base);
    this.update("reconciling", this.plugin.t("statusReconcilingPush"));
    const upload = new Map(plan.upload);

    // Push-only is the explicit deployment path for installed community
    // plugins. Always publish local plugin files when they differ from remote,
    // even if a stale or reverted baseline would otherwise classify the
    // difference as remote-only. Ignored runtime files never enter `local`.
    for (const [path, localFile] of local) {
      if (this.isCommunityPluginFile(path) && localFile.sha !== remote.files.get(path)?.sha) {
        upload.set(path, localFile);
      }
    }

    for (const conflict of plan.conflicts) {
      if (!conflict.local && this.isSelfCoreFile(conflict.path)) continue;
      upload.set(conflict.path, conflict.local);
      if (conflict.remote) {
        await this.createRemoteConflictCopy(token, conflict.remote);
      }
    }

    const enabledList = await this.ensureSelfEnabled();
    if (enabledList) upload.set(enabledList.path, enabledList);

    const { entries, uploaded: pushed, removed: deleted } = await this.buildUploadEntries(token, upload);

    const commitSha = entries.length
      ? await this.pushEntriesWithRemoteRetry(token, branch, remote, entries)
      : remote.commitSha;
    const conflicts = plan.conflicts.length;
    const result: GitHubSyncResult = {
      mode: "push-only",
      branch,
      commitSha,
      pulled: 0,
      pushed,
      deleted,
      conflicts,
      changed: pushed + deleted + conflicts > 0,
    };
    this.update("complete", this.plugin.t(result.changed ? "statusCompletePush" : "alreadyInSync"));
    return result;
  }

  private async buildUploadEntries(token: string, upload: Map<string, LocalFile | null>): Promise<{ entries: TreeEntry[]; uploaded: number; removed: number }> {
    const entries: TreeEntry[] = [];
    let uploaded = 0;
    let removed = 0;
    let index = 0;
    for (const [path, localFile] of upload) {
      index++;
      this.update("pushing", this.plugin.t("statusPushing", { path }), index, upload.size);
      if (!localFile) {
        entries.push({ path, mode: "100644", type: "blob", sha: null });
        removed++;
        continue;
      }
      if (!await this.plugin.app.vault.adapter.exists(localFile.path)) continue;
      const data = await this.readLocalBinary(localFile.path);
      this.ensureFileSize(localFile.path, data.byteLength);
      const blob = await this.api<GitBlob>(token, "POST", "/git/blobs", {
        content: arrayBufferToBase64(data),
        encoding: "base64",
      });
      entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
      uploaded++;
    }
    return { entries, uploaded, removed };
  }

  private async deleteLocalPath(path: string): Promise<boolean> {
    const existing = this.plugin.app.vault.getFileByPath(path);
    if (existing) {
      await this.plugin.app.fileManager.trashFile(existing);
      return true;
    }
    if (await this.plugin.app.vault.adapter.exists(path)) {
      await this.plugin.app.vault.adapter.trashLocal(path);
      return true;
    }
    return false;
  }

  private async pushEntriesWithRemoteRetry(token: string, branch: string, plannedRemote: RemoteSnapshot, entries: TreeEntry[]): Promise<string> {
    let remote = plannedRemote;
    let latestRemoteChange: RemoteChangedDuringSyncError | null = null;
    for (let attempt = 1; attempt <= MAX_REF_UPDATE_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        this.update("pushing", this.plugin.t("statusCommitRetry", { attempt }));
        await sleep(remoteRetryDelay(attempt));
        remote = await this.getHead(token, branch);
        if (this.entriesTouchChangedRemotePaths(entries, plannedRemote, remote)) {
          throw new RemoteChangedDuringSyncError(this.plugin.t("remoteSamePathChanged"));
        }
      }
      try {
        const tree = await this.api<{ sha: string }>(token, "POST", "/git/trees", {
          ...(remote.treeSha ? { base_tree: remote.treeSha } : {}),
          tree: entries,
        });
        const commit = await this.api<GitCommit>(token, "POST", "/git/commits", {
          message: this.commitMessage(),
          tree: tree.sha,
          ...(remote.commitSha ? { parents: [remote.commitSha] } : {}),
        });
        if (remote.commitSha) {
          await this.api<GitReference>(token, "PATCH", `/git/refs/heads/${encodeURIComponent(branch)}`, {
            sha: commit.sha,
            force: false,
          });
        } else {
          await this.api<GitReference>(token, "POST", "/git/refs", {
            ref: `refs/heads/${branch}`,
            sha: commit.sha,
          });
        }
        return commit.sha;
      } catch (error) {
        if (isRemoteChangedDuringSync(error) && attempt < MAX_REF_UPDATE_ATTEMPTS) {
          latestRemoteChange = error;
          continue;
        }
        throw error;
      }
    }
    throw latestRemoteChange ?? new Error(this.plugin.t("remoteContinuouslyChanged"));
  }

  private entriesTouchChangedRemotePaths(entries: TreeEntry[], plannedRemote: RemoteSnapshot, latestRemote: RemoteSnapshot): boolean {
    return entries.some((entry) => plannedRemote.files.get(entry.path)?.sha !== latestRemote.files.get(entry.path)?.sha);
  }

  private requireToken(): string {
    const token = this.plugin.getGitHubToken();
    if (!token) throw new Error(this.plugin.t("tokenRequired"));
    return token;
  }

  private async getRepository(token: string): Promise<GitHubRepository> {
    return this.api<GitHubRepository>(token, "GET", "");
  }

  private async getHead(token: string, branch: string): Promise<RemoteSnapshot> {
    try {
      const reference = await this.api<GitReference>(token, "GET", `/git/ref/heads/${encodeURIComponent(branch)}`);
      return this.getSnapshot(token, reference.object.sha);
    } catch (error) {
      // An uninitialized GitHub repository has no branch ref yet. Treat it as
      // an empty snapshot so the first local sync can create its root commit.
      if (isEmptyRepositoryError(error)) return { commitSha: "", treeSha: "", files: new Map() };
      throw error;
    }
  }

  private async tryGetSnapshot(token: string, commitSha: string): Promise<RemoteSnapshot | null> {
    if (!/^[0-9a-f]{40}$/i.test(commitSha)) return null;
    try {
      return await this.getSnapshot(token, commitSha);
    } catch {
      return null;
    }
  }

  private async getSnapshot(token: string, commitSha: string): Promise<RemoteSnapshot> {
    const commit = await this.api<GitCommit>(token, "GET", `/git/commits/${encodeURIComponent(commitSha)}`);
    const tree = await this.api<GitTreeResponse>(token, "GET", `/git/trees/${encodeURIComponent(commit.tree.sha)}?recursive=1`);
    if (tree.truncated) throw new Error(this.plugin.t("remoteTreeTooLarge"));
    const files = new Map<string, RemoteFile>();
    tree.tree.forEach((entry) => {
      const path = normalizePath(entry.path);
      if (entry.type !== "blob" || this.isIgnored(path, "pull")) return;
      files.set(path, { path, sha: entry.sha, mode: entry.mode, size: entry.size ?? 0 });
    });
    return { commitSha: commit.sha, treeSha: commit.tree.sha, files };
  }

  private async getLocalSnapshot(): Promise<Map<string, LocalFile>> {
    const files = await this.listAdapterFiles();
    let scanned = 0;
    const entries = await mapWithConcurrency(files, 8, async (path): Promise<[string, LocalFile]> => {
      const data = await this.readLocalBinary(path);
      this.ensureFileSize(path, data.byteLength);
      const [sha, mtime] = await Promise.all([gitBlobSha(data), this.getLocalModifiedAt(path)]);
      scanned++;
      this.update("scanning", this.plugin.t("statusScanning", { path }), scanned, files.length);
      return [path, { path, sha, mtime }];
    });
    return new Map(entries);
  }

  private async listAdapterFiles(): Promise<string[]> {
    const output: string[] = [];
    const visit = async (directory: string): Promise<void> => {
      const listed = await this.plugin.app.vault.adapter.list(directory || "/");
      for (const rawPath of listed.files) {
        const path = adapterPath(rawPath);
        if (path && !this.isIgnored(path, "push")) output.push(path);
      }
      for (const rawPath of listed.folders) {
        const path = adapterPath(rawPath);
        if (path && !this.isIgnored(path, "push")) await visit(path);
      }
    };
    await visit("/");
    return [...new Set(output)].sort();
  }

  private async readLocalBinary(path: string): Promise<ArrayBuffer> {
    const file = this.plugin.app.vault.getFileByPath(path);
    return file ? this.plugin.app.vault.readBinary(file) : this.plugin.app.vault.adapter.readBinary(path);
  }

  private async writeRemoteFile(token: string, remote: RemoteFile): Promise<void> {
    this.ensureFileSize(remote.path, remote.size);
    const blob = await this.api<GitBlob>(token, "GET", `/git/blobs/${encodeURIComponent(remote.sha)}`);
    if (blob.encoding !== "base64") throw new Error(this.plugin.t("unsupportedEncoding", { path: remote.path }));
    const data = base64ToArrayBuffer(blob.content.replace(/\s/g, ""));
    this.ensureFileSize(remote.path, data.byteLength);
    await this.ensureParentFolders(remote.path);
    try {
      const existing = this.plugin.app.vault.getAbstractFileByPath(remote.path);
      if (existing instanceof TFile) {
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

  private async createConflictCopy(local: LocalFile): Promise<LocalFile> {
    const data = await this.readLocalBinary(local.path);
    const path = await this.availableConflictPath(local.path);
    await this.ensureParentFolders(path);
    await this.plugin.app.vault.adapter.writeBinary(path, data);
    return { path, sha: await gitBlobSha(data), mtime: Date.now() };
  }

  private async createRemoteConflictCopy(token: string, remote: RemoteFile): Promise<LocalFile> {
    this.ensureFileSize(remote.path, remote.size);
    const blob = await this.api<GitBlob>(token, "GET", `/git/blobs/${encodeURIComponent(remote.sha)}`);
    if (blob.encoding !== "base64") throw new Error(this.plugin.t("unsupportedEncoding", { path: remote.path }));
    const data = base64ToArrayBuffer(blob.content.replace(/\s/g, ""));
    const path = await this.availableConflictPath(remote.path);
    await this.ensureParentFolders(path);
    await this.plugin.app.vault.adapter.writeBinary(path, data);
    return { path, sha: await gitBlobSha(data), mtime: Date.now() };
  }

  private async getLocalModifiedAt(path: string): Promise<number> {
    const file = this.plugin.app.vault.getFileByPath(path);
    if (file instanceof TFile) return file.stat.mtime;
    try {
      const stat = await this.plugin.app.vault.adapter.stat(path);
      return stat?.mtime ?? 0;
    } catch {
      return 0;
    }
  }

  private async getRemoteModifiedAt(token: string, branch: string, path: string): Promise<number> {
    try {
      const commits = await this.api<GitHubPathCommit[]>(token, "GET", `/commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=1`);
      const date = commits[0]?.commit?.committer?.date ?? commits[0]?.commit?.author?.date ?? "";
      const timestamp = Date.parse(date);
      return Number.isFinite(timestamp) ? timestamp : 0;
    } catch {
      return 0;
    }
  }

  private async availableConflictPath(path: string, occupiedPaths?: Set<string>): Promise<string> {
    const slash = path.lastIndexOf("/");
    const directory = slash >= 0 ? path.slice(0, slash + 1) : "";
    const name = slash >= 0 ? path.slice(slash + 1) : path;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const extension = dot > 0 ? name.slice(dot) : "";
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const device = sanitizeSegment(this.plugin.settings.syncDeviceName || "device");
    let candidate = `${directory}${stem}.conflict-${device}-${stamp}${extension}`;
    let counter = 2;
    while (occupiedPaths?.has(candidate) || await this.plugin.app.vault.adapter.exists(candidate)) {
      candidate = `${directory}${stem}.conflict-${device}-${stamp}-${counter}${extension}`;
      counter++;
    }
    return candidate;
  }

  private async ensureParentFolders(path: string): Promise<void> {
    const parent = path.indexOf("/") !== -1 ? path.slice(0, path.lastIndexOf("/")) : "";
    if (!parent) return;
    let current = "";
    for (const segment of parent.split("/")) {
      current = current ? `${current}/${segment}` : segment;
      const existing = this.plugin.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFile) throw new Error(this.plugin.t("folderFileConflict", { path: current }));
      if (!existing && !await this.plugin.app.vault.adapter.exists(current)) {
        try {
          await this.plugin.app.vault.createFolder(current);
        } catch (error) {
          if (!await this.plugin.app.vault.adapter.exists(current)) throw error;
        }
      }
    }
  }

  private async ensureSelfEnabled(): Promise<LocalFile | null> {
    const path = normalizePath(`${this.plugin.app.vault.configDir}/community-plugins.json`);
    let enabled: unknown;
    try {
      const content = await this.plugin.app.vault.adapter.read(path);
      enabled = JSON.parse(content) as unknown;
    } catch (error) {
      throw new Error(this.plugin.t("enabledListReadFailed", { path, error: error instanceof Error ? error.message : String(error) }));
    }
    if (!Array.isArray(enabled) || !enabled.every((id) => typeof id === "string")) {
      throw new Error(this.plugin.t("enabledListInvalid", { path }));
    }
    const updated = enabled.filter((id) => !LEGACY_PLUGIN_IDS.has(id));
    if (updated.indexOf(this.plugin.manifest.id) === -1) updated.push(this.plugin.manifest.id);
    if (updated.length === enabled.length && updated.every((id, index) => id === enabled[index])) return null;
    const bytes = new TextEncoder().encode(`${JSON.stringify(updated, null, 2)}\n`);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await this.plugin.app.vault.adapter.writeBinary(path, data);
    if (this.isIgnored(path, "push")) return null;
    return { path, sha: await gitBlobSha(data), mtime: Date.now() };
  }

  private isSelfCoreFile(path: string): boolean {
    const enabledList = normalizePath(`${this.plugin.app.vault.configDir}/community-plugins.json`);
    if (path === enabledList) return true;
    const root = normalizePath(`${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}`);
    return ["main.js", "manifest.json", "styles.css"].some((name) => path === `${root}/${name}`);
  }

  private isCommunityPluginFile(path: string): boolean {
    const root = normalizePath(`${this.plugin.app.vault.configDir}/plugins`);
    return path.startsWith(`${root}/`);
  }

  private isIgnored(path: string, scope: IgnoreScope = "push"): boolean {
    const normalized = normalizePath(path);
    if (HARD_EXCLUDES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))) return true;
    const localSyncState = normalizePath(`${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/local-sync-state.json`);
    if (normalized === localSyncState) return true;
    if (GENERATED_CONFLICT_COPY.test(normalized)) return true;

    if (normalized === ".gitignore" && this.plugin.settings.syncUseGitignore === false) return true;

    if (this.plugin.settings.syncUseGitignore === false) {
      return matchesIgnoreRules(normalized, this.configuredIgnoreRules);
    }
    if (scope === "pull" && !this.plugin.settings.syncGitignoreAffectsPull) return false;
    return matchesIgnoreRules(normalized, this.gitignoreRules);
  }

  private ensureFileSize(path: string, bytes: number): void {
    const maximum = Math.max(1, this.plugin.settings.syncMaxFileSizeMb) * 1024 * 1024;
    if (bytes > maximum) {
      throw new Error(this.plugin.t("fileTooLarge", { limit: this.plugin.settings.syncMaxFileSizeMb, path }));
    }
  }

  private assertNoMassDeletion(
    side: "local" | "remote",
    base: Map<string, RemoteFile>,
    current: Map<string, LocalFile | RemoteFile>,
  ): void {
    const detected = detectMassDeletion(base, current);
    if (!detected) return;
    throw new Error(this.plugin.t("massDeletionBlocked", {
      side: this.plugin.t(side === "local" ? "localSide" : "remoteSide"),
      missing: detected.missing,
      total: detected.total,
    }));
  }

  private commitMessage(): string {
    const device = this.plugin.settings.syncDeviceName.trim() || "Obsidian";
    return `Vault sync from ${device} at ${new Date().toISOString()}`;
  }

  private async api<T>(token: string, method: string, endpoint: string, body?: unknown): Promise<T> {
    const { owner, repository } = parseRepository(this.plugin.settings.syncRepository, this.plugin.t("repositoryFormat"));
    const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${endpoint}`;
    const response = await requestUrl({
      url,
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "gitsync-portal",
      },
      contentType: "application/json",
      body: body === undefined ? undefined : JSON.stringify(body),
      throw: false,
    });
    if (response.status >= 200 && response.status < 300) return response.json as T;
    let apiMessage = "";
    let detail = "";
    try {
      const parsed = response.json as { message?: string };
      apiMessage = parsed?.message ?? "";
      detail = apiMessage ? `：${apiMessage}` : "";
    } catch {
      detail = response.text ? `：${response.text.slice(0, 200)}` : "";
    }
    if (response.status === 401) throw new Error(this.plugin.t("tokenInvalid"));
    if (response.status === 403) throw new Error(this.plugin.t("tokenForbidden"));
    if (response.status === 404) throw new Error(this.plugin.t("repositoryNotFound"));
    if ((response.status === 409 || response.status === 422) && /git repository is empty/i.test(apiMessage)) {
      throw new EmptyRepositoryError();
    }
    if (response.status === 409 || response.status === 422) throw new RemoteChangedDuringSyncError(this.plugin.t("remoteChanged", { detail }));
    throw new Error(this.plugin.t("apiFailed", { status: response.status, detail }));
  }

  private update(stage: GitHubSyncStage, message: string, current?: number, total?: number): void {
    this.onStatus({ stage, message, current, total });
  }
}

function remoteRetryDelay(attempt: number): number {
  return Math.min(MAX_REMOTE_RETRY_DELAY_MS, 1_500 * (2 ** (attempt - 2)));
}

export function createReconcilePlan(
  local: Map<string, LocalFile>,
  remote: Map<string, RemoteFile>,
  base: Map<string, RemoteFile> | null,
): ReconcilePlan {
  const upload = new Map<string, LocalFile | null>();
  const pull: Array<{ path: string; remote: RemoteFile | null }> = [];
  const conflicts: Array<{ path: string; local: LocalFile; remote: RemoteFile | null }> = [];
  const paths = new Set<string>([...local.keys(), ...remote.keys(), ...(base?.keys() ?? [])]);

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
    const localChanged = localFile?.sha !== baseFile?.sha;
    const remoteChanged = remoteFile?.sha !== baseFile?.sha;
    if (!localChanged && !remoteChanged) continue;
    if (localChanged && !remoteChanged) {
      upload.set(path, localFile ?? null);
      continue;
    }
    if (!localChanged && remoteChanged) {
      pull.push({ path, remote: remoteFile ?? null });
      continue;
    }
    if (localFile?.sha === remoteFile?.sha) continue;
    if (localFile) conflicts.push({ path, local: localFile, remote: remoteFile ?? null });
    else if (remoteFile) pull.push({ path, remote: remoteFile });
  }

  return { upload, pull, conflicts };
}

export function createPullOnlyPlan(
  local: Map<string, LocalFile>,
  remote: Map<string, RemoteFile>,
  base: Map<string, RemoteFile> | null,
): PullOnlyPlan {
  const pull: PullOnlyPlan["pull"] = [];
  const conflicts: PullOnlyPlan["conflicts"] = [];
  const paths = new Set<string>([...remote.keys(), ...(base?.keys() ?? [])]);

  for (const path of [...paths].sort()) {
    const localFile = local.get(path);
    const remoteFile = remote.get(path);
    const baseFile = base?.get(path);
    // Pull-only is also the bootstrap path for a new or rebuilt vault. A file
    // that still exists remotely must be restored when it is missing locally,
    // even when the remote copy has not changed since the saved baseline.
    if (remoteFile && !localFile) {
      pull.push({ path, remote: remoteFile });
      continue;
    }
    const remoteChanged = base ? remoteFile?.sha !== baseFile?.sha : Boolean(remoteFile);
    if (!remoteChanged || localFile?.sha === remoteFile?.sha) continue;
    const localChanged = base ? localFile?.sha !== baseFile?.sha : Boolean(localFile);
    if (localChanged && localFile) conflicts.push({ path, local: localFile, remote: remoteFile ?? null });
    else pull.push({ path, remote: remoteFile ?? null });
  }

  return { pull, conflicts };
}

export function createPushOnlyPlan(
  local: Map<string, LocalFile>,
  remote: Map<string, RemoteFile>,
  base: Map<string, RemoteFile> | null,
): PushOnlyPlan {
  const upload = new Map<string, LocalFile | null>();
  const conflicts: PushOnlyPlan["conflicts"] = [];
  const paths = new Set<string>([...local.keys(), ...(base?.keys() ?? [])]);

  for (const path of [...paths].sort()) {
    const localFile = local.get(path);
    const remoteFile = remote.get(path);
    const baseFile = base?.get(path);
    const localChanged = base ? localFile?.sha !== baseFile?.sha : Boolean(localFile);
    if (!localChanged || localFile?.sha === remoteFile?.sha) continue;
    const remoteChanged = base ? remoteFile?.sha !== baseFile?.sha : Boolean(remoteFile);
    if (remoteChanged) conflicts.push({ path, local: localFile ?? null, remote: remoteFile ?? null });
    else upload.set(path, localFile ?? null);
  }

  return { upload, conflicts };
}

export function detectMassDeletion(
  base: Map<string, RemoteFile>,
  current: Map<string, LocalFile | RemoteFile>,
): { missing: number; total: number } | null {
  const total = base.size;
  if (total < MASS_DELETION_MINIMUM) return null;
  let missing = 0;
  for (const path of base.keys()) {
    if (!current.has(path)) missing++;
  }
  return missing >= MASS_DELETION_MINIMUM && missing / total >= MASS_DELETION_RATIO
    ? { missing, total }
    : null;
}

export async function gitBlobSha(data: ArrayBuffer): Promise<string> {
  const header = new TextEncoder().encode(`blob ${data.byteLength}\0`);
  const payload = new Uint8Array(header.byteLength + data.byteLength);
  payload.set(header, 0);
  payload.set(new Uint8Array(data), header.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", payload);
  return [...new Uint8Array(digest)].map((byte) => `${byte < 16 ? "0" : ""}${byte.toString(16)}`).join("");
}

export function parseRepository(value: string, invalidMessage = "Repository must use the owner/repository format."): { owner: string; repository: string } {
  const match = value.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (!match) throw new Error(invalidMessage);
  return { owner: match[1], repository: match[2] };
}

function parseIgnorePatterns(value?: string): string[] {
  if (!value) return [];
  return value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

function matchesIgnoreRules(path: string, patterns: string[]): boolean {
  if (!patterns.length) return false;
  return ignore().add(patterns).ignores(path);
}

function sanitizeSegment(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "device";
}

function adapterPath(value: string): string {
  return normalizePath(value.replace(/^\/+/, ""));
}

class RemoteChangedDuringSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteChangedDuringSyncError";
  }
}

class EmptyRepositoryError extends Error {
  constructor() {
    super("Git Repository is empty");
    this.name = "EmptyRepositoryError";
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      output[index] = await mapper(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return output;
}

function isRemoteChangedDuringSync(error: unknown): error is RemoteChangedDuringSyncError {
  return error instanceof RemoteChangedDuringSyncError
    || error instanceof Error && error.name === "RemoteChangedDuringSyncError";
}

function isEmptyRepositoryError(error: unknown): error is EmptyRepositoryError {
  return error instanceof EmptyRepositoryError
    || error instanceof Error && error.name === "EmptyRepositoryError";
}
