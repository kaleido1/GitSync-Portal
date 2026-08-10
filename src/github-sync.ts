import {
  TFile,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  normalizePath,
  requestUrl,
} from "obsidian";
import type ObsidianViewerPlugin from "../main";

const API_ROOT = "https://api.github.com";
const API_VERSION = "2026-03-10";
const HARD_EXCLUDES = [".git/", ".trash/"];

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

interface GitBlob {
  content: string;
  encoding: string;
  sha: string;
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
}

interface ReconcilePlan {
  upload: Map<string, LocalFile | null>;
  pull: Array<{ path: string; remote: RemoteFile | null }>;
  conflicts: Array<{ path: string; local: LocalFile; remote: RemoteFile | null }>;
}

export interface GitHubSyncResult {
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

export class GitHubSyncService {
  private running = false;

  constructor(
    private readonly plugin: ObsidianViewerPlugin,
    private readonly onStatus: (status: GitHubSyncStatus) => void,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  async testConnection(): Promise<{ repository: string; branch: string; commitSha: string }> {
    const token = this.requireToken();
    const repository = await this.getRepository(token);
    const branch = this.plugin.settings.syncBranch.trim() || repository.default_branch;
    const head = await this.getHead(token, branch);
    return { repository: repository.full_name, branch, commitSha: head.commitSha };
  }

  async sync(): Promise<GitHubSyncResult> {
    if (this.running) throw new Error("同步已经在进行中。");
    this.running = true;
    try {
      const token = this.requireToken();
      this.update("connecting", "正在连接 GitHub…");
      const repository = await this.getRepository(token);
      const branch = this.plugin.settings.syncBranch.trim() || repository.default_branch;
      const remote = await this.getHead(token, branch);
      const base = this.plugin.settings.lastSyncedCommit
        ? await this.tryGetSnapshot(token, this.plugin.settings.lastSyncedCommit)
        : null;

      this.update("scanning", "正在计算本地文件指纹…");
      const local = await this.getLocalSnapshot();
      const plan = createReconcilePlan(local, remote.files, base?.files ?? null);
      this.update("reconciling", "正在合并本地与远端变更…");

      let pulled = 0;
      let deleted = 0;
      let conflicts = 0;
      const upload = new Map(plan.upload);
      const protectedConflicts = new Set<string>();

      for (const conflict of plan.conflicts) {
        if (!conflict.remote && this.isSelfCoreFile(conflict.path)) {
          upload.set(conflict.path, conflict.local);
          protectedConflicts.add(conflict.path);
          continue;
        }
        const preserved = await this.createConflictCopy(conflict.local);
        upload.set(preserved.path, preserved);
        conflicts++;
      }

      const pullOperations = [
        ...plan.conflicts
          .filter(({ path }) => !protectedConflicts.has(path))
          .map(({ path, remote: remoteFile }) => ({ path, remote: remoteFile })),
        ...plan.pull.filter(({ path, remote: remoteFile }) => {
          if (remoteFile || !this.isSelfCoreFile(path)) return true;
          const localFile = local.get(path);
          if (localFile) upload.set(path, localFile);
          return false;
        }),
      ];
      for (let index = 0; index < pullOperations.length; index++) {
        const operation = pullOperations[index]!;
        this.update("pulling", `正在应用远端变更：${operation.path}`, index + 1, pullOperations.length);
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
        const entries: Array<{ path: string; mode: string; type: "blob"; sha: string | null }> = [];
        let index = 0;
        for (const [path, localFile] of upload) {
          index++;
          this.update("pushing", `正在上传本地变更：${path}`, index, upload.size);
          if (!localFile) {
            entries.push({ path, mode: "100644", type: "blob", sha: null });
            pushed++;
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
          pushed++;
        }

        if (entries.length) {
          const tree = await this.api<{ sha: string }>(token, "POST", "/git/trees", {
            base_tree: remote.treeSha,
            tree: entries,
          });
          const commit = await this.api<GitCommit>(token, "POST", "/git/commits", {
            message: this.commitMessage(),
            tree: tree.sha,
            parents: [remote.commitSha],
          });
          await this.api<GitReference>(token, "PATCH", `/git/refs/heads/${encodeURIComponent(branch)}`, {
            sha: commit.sha,
            force: false,
          });
          commitSha = commit.sha;
        }
      }

      const result: GitHubSyncResult = {
        branch,
        commitSha,
        pulled,
        pushed,
        deleted,
        conflicts,
        changed: pulled + pushed + deleted + conflicts > 0,
      };
      this.update("complete", result.changed ? "同步完成" : "本地与远端已经一致");
      return result;
    } catch (error) {
      this.update("error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.running = false;
    }
  }

  private requireToken(): string {
    const token = this.plugin.getGitHubToken();
    if (!token) throw new Error("请先在 Obsidian Viewer 设置中保存 GitHub token。");
    return token;
  }

  private async getRepository(token: string): Promise<GitHubRepository> {
    return this.api<GitHubRepository>(token, "GET", "");
  }

  private async getHead(token: string, branch: string): Promise<RemoteSnapshot> {
    const reference = await this.api<GitReference>(token, "GET", `/git/ref/heads/${encodeURIComponent(branch)}`);
    return this.getSnapshot(token, reference.object.sha);
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
    if (tree.truncated) throw new Error("远端仓库文件树超过 GitHub 单次递归读取上限，已停止同步以避免遗漏文件。");
    const files = new Map<string, RemoteFile>();
    tree.tree.forEach((entry) => {
      const path = normalizePath(entry.path);
      if (entry.type !== "blob" || this.isIgnored(path)) return;
      files.set(path, { path, sha: entry.sha, mode: entry.mode, size: entry.size ?? 0 });
    });
    return { commitSha: commit.sha, treeSha: commit.tree.sha, files };
  }

  private async getLocalSnapshot(): Promise<Map<string, LocalFile>> {
    const files = await this.listAdapterFiles();
    const snapshot = new Map<string, LocalFile>();
    for (let index = 0; index < files.length; index++) {
      const path = files[index]!;
      this.update("scanning", `正在扫描：${path}`, index + 1, files.length);
      const data = await this.readLocalBinary(path);
      this.ensureFileSize(path, data.byteLength);
      snapshot.set(path, { path, sha: await gitBlobSha(data) });
    }
    return snapshot;
  }

  private async listAdapterFiles(): Promise<string[]> {
    const output: string[] = [];
    const visit = async (directory: string): Promise<void> => {
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

  private async readLocalBinary(path: string): Promise<ArrayBuffer> {
    const file = this.plugin.app.vault.getFileByPath(path);
    return file ? this.plugin.app.vault.readBinary(file) : this.plugin.app.vault.adapter.readBinary(path);
  }

  private async writeRemoteFile(token: string, remote: RemoteFile): Promise<void> {
    this.ensureFileSize(remote.path, remote.size);
    const blob = await this.api<GitBlob>(token, "GET", `/git/blobs/${encodeURIComponent(remote.sha)}`);
    if (blob.encoding !== "base64") throw new Error(`GitHub 返回了不支持的编码：${remote.path}`);
    const data = base64ToArrayBuffer(blob.content.replace(/\s/g, ""));
    this.ensureFileSize(remote.path, data.byteLength);
    await this.ensureParentFolders(remote.path);
    try {
      const existing = this.plugin.app.vault.getAbstractFileByPath(remote.path);
      if (existing instanceof TFile) {
        await this.plugin.app.vault.modifyBinary(existing, data);
      } else if (existing) {
        throw new Error(`远端文件与本地文件夹同名：${remote.path}`);
      } else if (await this.plugin.app.vault.adapter.exists(remote.path)) {
        await this.plugin.app.vault.adapter.writeBinary(remote.path, data);
      } else {
        await this.plugin.app.vault.createBinary(remote.path, data);
      }
    } catch (error) {
      throw new Error(`写入远端文件失败：${remote.path}：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createConflictCopy(local: LocalFile): Promise<LocalFile> {
    const data = await this.readLocalBinary(local.path);
    const path = await this.availableConflictPath(local.path);
    await this.ensureParentFolders(path);
    await this.plugin.app.vault.adapter.writeBinary(path, data);
    return { path, sha: await gitBlobSha(data) };
  }

  private async availableConflictPath(path: string): Promise<string> {
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
    while (await this.plugin.app.vault.adapter.exists(candidate)) {
      candidate = `${directory}${stem}.conflict-${device}-${stamp}-${counter}${extension}`;
      counter++;
    }
    return candidate;
  }

  private async ensureParentFolders(path: string): Promise<void> {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (!parent) return;
    let current = "";
    for (const segment of parent.split("/")) {
      current = current ? `${current}/${segment}` : segment;
      const existing = this.plugin.app.vault.getAbstractFileByPath(current);
      if (existing instanceof TFile) throw new Error(`无法创建文件夹，已有同名文件：${current}`);
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
      throw new Error(`无法读取插件启用列表 ${path}：${error instanceof Error ? error.message : String(error)}`);
    }
    if (!Array.isArray(enabled) || !enabled.every((id) => typeof id === "string")) {
      throw new Error(`插件启用列表格式无效：${path}`);
    }
    if (enabled.includes(this.plugin.manifest.id)) return null;
    const updated = [...enabled, this.plugin.manifest.id];
    const bytes = new TextEncoder().encode(`${JSON.stringify(updated, null, 2)}\n`);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await this.plugin.app.vault.adapter.writeBinary(path, data);
    return { path, sha: await gitBlobSha(data) };
  }

  private isSelfCoreFile(path: string): boolean {
    const enabledList = normalizePath(`${this.plugin.app.vault.configDir}/community-plugins.json`);
    if (path === enabledList) return true;
    const root = normalizePath(`${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}`);
    return ["main.js", "manifest.json", "styles.css"].some((name) => path === `${root}/${name}`);
  }

  private isIgnored(path: string): boolean {
    const normalized = normalizePath(path);
    if (HARD_EXCLUDES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix))) return true;
    return parseIgnorePatterns(this.plugin.settings.syncIgnorePatterns).some((pattern) => matchesPattern(normalized, pattern));
  }

  private ensureFileSize(path: string, bytes: number): void {
    const maximum = Math.max(1, this.plugin.settings.syncMaxFileSizeMb) * 1024 * 1024;
    if (bytes > maximum) {
      throw new Error(`文件超过 ${this.plugin.settings.syncMaxFileSizeMb} MB 同步上限：${path}`);
    }
  }

  private commitMessage(): string {
    const device = this.plugin.settings.syncDeviceName.trim() || "Obsidian";
    return `Vault sync from ${device} at ${new Date().toISOString()}`;
  }

  private async api<T>(token: string, method: string, endpoint: string, body?: unknown): Promise<T> {
    const { owner, repository } = parseRepository(this.plugin.settings.syncRepository);
    const url = `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${endpoint}`;
    const response = await requestUrl({
      url,
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": API_VERSION,
        "User-Agent": "obsidian-viewer-sync",
      },
      contentType: "application/json",
      body: body === undefined ? undefined : JSON.stringify(body),
      throw: false,
    });
    if (response.status >= 200 && response.status < 300) return response.json as T;
    let detail = "";
    try {
      const parsed = response.json as { message?: string };
      detail = parsed?.message ? `：${parsed.message}` : "";
    } catch {
      detail = response.text ? `：${response.text.slice(0, 200)}` : "";
    }
    if (response.status === 401) throw new Error("GitHub token 无效或已经过期。");
    if (response.status === 403) throw new Error("GitHub token 缺少仓库 Contents 读写权限，或请求受到速率限制。");
    if (response.status === 404) throw new Error("找不到仓库、分支或 commit；请检查 token 授权范围和同步设置。");
    if (response.status === 409 || response.status === 422) throw new Error(`远端在同步期间发生变化，请重新同步${detail}`);
    throw new Error(`GitHub API 请求失败（HTTP ${response.status}）${detail}`);
  }

  private update(stage: GitHubSyncStage, message: string, current?: number, total?: number): void {
    this.onStatus({ stage, message, current, total });
  }
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

export async function gitBlobSha(data: ArrayBuffer): Promise<string> {
  const header = new TextEncoder().encode(`blob ${data.byteLength}\0`);
  const payload = new Uint8Array(header.byteLength + data.byteLength);
  payload.set(header, 0);
  payload.set(new Uint8Array(data), header.byteLength);
  const digest = await crypto.subtle.digest("SHA-1", payload);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseRepository(value: string): { owner: string; repository: string } {
  const match = value.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
  if (!match) throw new Error("仓库格式必须是 owner/repository。");
  return { owner: match[1]!, repository: match[2]! };
}

function parseIgnorePatterns(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

function matchesPattern(path: string, pattern: string): boolean {
  const normalized = normalizePath(pattern.replace(/^\//, ""));
  if (normalized.endsWith("/")) {
    const directory = normalized.slice(0, -1);
    return normalized.includes("/")
      ? path === directory || path.startsWith(normalized)
      : path.split("/").includes(directory);
  }
  if (!normalized.includes("*") && !normalized.includes("?")) {
    return normalized.includes("/")
      ? path === normalized || path.startsWith(`${normalized}/`)
      : path.split("/").includes(normalized);
  }
  const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

function sanitizeSegment(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "device";
}

function adapterPath(value: string): string {
  return normalizePath(value.replace(/^\/+/, ""));
}
