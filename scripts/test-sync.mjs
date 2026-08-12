import assert from "node:assert/strict";
import Module from "node:module";
import { buildSync } from "esbuild";

const output = buildSync({
  entryPoints: ["src/github-sync.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["obsidian"],
}).outputFiles[0].text;

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "obsidian") {
    return {
      TFile: class TFile {},
      arrayBufferToBase64: () => "",
      base64ToArrayBuffer: () => new ArrayBuffer(0),
      normalizePath: (value) => value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/"),
      requestUrl: async () => { throw new Error("network is not used by unit tests"); },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const testModule = new Module("github-sync-test");
testModule.filename = "github-sync-test.cjs";
testModule.paths = Module._nodeModulePaths(process.cwd());
testModule._compile(output, testModule.filename);
const { GitHubSyncService, createReconcilePlan, gitBlobSha } = testModule.exports;
Module._load = originalLoad;

const buffer = (value) => new TextEncoder().encode(value).buffer;
assert.equal(await gitBlobSha(buffer("")), "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
assert.equal(await gitBlobSha(buffer("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a");

const localFile = (path, sha, mtime = 1) => ({ path, sha, mtime, file: { path } });
const remoteFile = (path, sha) => ({ path, sha, mode: "100644", size: 1 });
const map = (entries) => new Map(entries);

const base = map([
  ["same.md", remoteFile("same.md", "A")],
  ["local.md", remoteFile("local.md", "B")],
  ["remote.md", remoteFile("remote.md", "C")],
  ["both.md", remoteFile("both.md", "D")],
  ["deleted-local.md", remoteFile("deleted-local.md", "E")],
  ["deleted-remote.md", remoteFile("deleted-remote.md", "F")],
  ["local-delete.md", remoteFile("local-delete.md", "G")],
  ["remote-delete.md", remoteFile("remote-delete.md", "H")],
]);
const local = map([
  ["same.md", localFile("same.md", "A")],
  ["local.md", localFile("local.md", "B2")],
  ["remote.md", localFile("remote.md", "C")],
  ["both.md", localFile("both.md", "D2")],
  ["deleted-remote.md", localFile("deleted-remote.md", "F2")],
  ["remote-delete.md", localFile("remote-delete.md", "H")],
  ["local-only.md", localFile("local-only.md", "L")],
]);
const remote = map([
  ["same.md", remoteFile("same.md", "A")],
  ["local.md", remoteFile("local.md", "B")],
  ["remote.md", remoteFile("remote.md", "C2")],
  ["both.md", remoteFile("both.md", "D3")],
  ["deleted-local.md", remoteFile("deleted-local.md", "E2")],
  ["local-delete.md", remoteFile("local-delete.md", "G")],
  ["remote-only.md", remoteFile("remote-only.md", "R")],
]);

const plan = createReconcilePlan(local, remote, base);
assert.deepEqual([...plan.upload.keys()], ["local-delete.md", "local-only.md", "local.md"]);
assert.equal(plan.upload.get("local-delete.md"), null);
assert.deepEqual(plan.pull.map((entry) => entry.path), ["deleted-local.md", "remote-delete.md", "remote-only.md", "remote.md"]);
assert.equal(plan.pull.find((entry) => entry.path === "remote-delete.md")?.remote, null);
assert.deepEqual(plan.conflicts.map((entry) => entry.path), ["both.md", "deleted-remote.md"]);

const first = createReconcilePlan(
  map([["local.md", localFile("local.md", "L")], ["conflict.md", localFile("conflict.md", "LC")]]),
  map([["remote.md", remoteFile("remote.md", "R")], ["conflict.md", remoteFile("conflict.md", "RC")]]),
  null,
);
assert.deepEqual([...first.upload.keys()], ["local.md"]);
assert.deepEqual(first.pull.map((entry) => entry.path), ["remote.md"]);
assert.deepEqual(first.conflicts.map((entry) => entry.path), ["conflict.md"]);

const listings = {
  "/": {
    files: ["/.gitignore", "/note.md", "/.DS_Store"],
    folders: ["/.git", "/.obsidian", "/.trash", "/folder"],
  },
  ".obsidian": {
    files: [
      ".obsidian/app.json",
      ".obsidian/community-plugins.json",
      ".obsidian/core-plugins.json",
      ".obsidian/page-preview.json",
      ".obsidian/workspace.json",
      ".obsidian/workspace-mobile.json",
      ".obsidian/workspace-mobile.conflict-ios-20260810T160059Z.json",
    ],
    folders: [".obsidian/plugins"],
  },
  ".obsidian/plugins": {
    files: [],
    folders: [".obsidian/plugins/example-plugin", ".obsidian/plugins/obsidian-git", ".obsidian/plugins/gitsync-portal"],
  },
  ".obsidian/plugins/example-plugin": {
    files: [
      ".obsidian/plugins/example-plugin/main.js",
      ".obsidian/plugins/example-plugin/manifest.conflict-ios-20260810T160059Z.json",
      ".obsidian/plugins/example-plugin/manifest.json",
    ],
    folders: [],
  },
  ".obsidian/plugins/obsidian-git": {
    files: [
      ".obsidian/plugins/obsidian-git/data.json",
      ".obsidian/plugins/obsidian-git/main.js",
      ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
    ],
    folders: [],
  },
  ".obsidian/plugins/gitsync-portal": {
    files: [
      ".obsidian/plugins/gitsync-portal/main.js",
      ".obsidian/plugins/gitsync-portal/data.json",
      ".obsidian/plugins/gitsync-portal/data.conflict-ios-20260811T132236Z.json",
      ".obsidian/plugins/gitsync-portal/local-sync-state.json",
      ".obsidian/plugins/gitsync-portal/sync-state.json",
    ],
    folders: [],
  },
  folder: {
    files: ["folder/.hidden.md", "folder/visible.md"],
    folders: [],
  },
};
let protectedWrite = null;
const fakePlugin = {
  app: { vault: {
    configDir: ".obsidian",
    adapter: {
      list: async (path) => listings[path] ?? { files: [], folders: [] },
      read: async () => '["dataview","gitsync-port","obsidian-viewer"]',
      writeBinary: async (_path, data) => { protectedWrite = new TextDecoder().decode(data); },
    },
  } },
  manifest: { id: "gitsync-portal" },
  t: (key, values = {}) => `${key}${Object.keys(values).length ? `:${JSON.stringify(values)}` : ""}`,
  settings: { syncIgnorePatterns: [
    ".DS_Store",
    ".obsidian/workspace*.json",
    ".obsidian/page-preview.json",
    ".obsidian/plugins/gitsync-portal/local-sync-state.json",
    ".obsidian/plugins/gitsync-portal/*.conflict-*",
    ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
    ".obsidian/plugins/*/manifest.conflict-*",
  ].join("\n") },
};
const service = new GitHubSyncService(fakePlugin, () => {});
assert.deepEqual(await service.listAdapterFiles(), [
  ".gitignore",
  ".obsidian/app.json",
  ".obsidian/community-plugins.json",
  ".obsidian/core-plugins.json",
  ".obsidian/plugins/example-plugin/main.js",
  ".obsidian/plugins/example-plugin/manifest.json",
  ".obsidian/plugins/gitsync-portal/data.json",
  ".obsidian/plugins/gitsync-portal/main.js",
  ".obsidian/plugins/gitsync-portal/sync-state.json",
  ".obsidian/plugins/obsidian-git/data.json",
  ".obsidian/plugins/obsidian-git/main.js",
  "folder/.hidden.md",
  "folder/visible.md",
  "note.md",
]);
const protectedList = await service.ensureSelfEnabled();
assert.equal(protectedList.path, ".obsidian/community-plugins.json");
assert.deepEqual(JSON.parse(protectedWrite), ["dataview", "gitsync-portal"]);
assert.equal(service.isSelfCoreFile(".obsidian/community-plugins.json"), true);
assert.equal(service.isSelfCoreFile(".obsidian/plugins/gitsync-portal/main.js"), true);
assert.equal(service.isSelfCoreFile(".obsidian/plugins/dataview/main.js"), false);

const retryPlugin = {
  settings: { syncBranch: "main", syncRepository: "owner/repo", lastSyncedCommit: "", syncDeviceName: "test" },
  getGitHubToken: () => "token",
  t: (key, values = {}) => `${key}${Object.keys(values).length ? `:${JSON.stringify(values)}` : ""}`,
};
const retryStatuses = [];
const retryService = new GitHubSyncService(retryPlugin, (status) => retryStatuses.push(status.message));
retryService.getRepository = async () => ({ default_branch: "main", full_name: "owner/repo" });
let retryAttempts = 0;
retryService.syncAttempt = async () => {
  retryAttempts++;
  if (retryAttempts === 1) {
    const error = new Error("remote moved");
    error.name = "RemoteChangedDuringSyncError";
    throw error;
  }
  return { branch: "main", commitSha: "new", pulled: 0, pushed: 1, deleted: 0, conflicts: 0, changed: true };
};
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback) => {
  callback();
  return 0;
};
let retryResult;
try {
  retryResult = await retryService.sync();
} finally {
  globalThis.setTimeout = originalSetTimeout;
}
assert.equal(retryAttempts, 2);
assert.equal(retryResult.commitSha, "new");
assert.ok(retryStatuses.some((message) => message.includes("statusRemoteRetry")));

const remoteSnapshot = (commitSha, files = []) => ({
  commitSha,
  treeSha: `${commitSha}-tree`,
  files: new Map(files.map((file) => [file.path, file])),
});
const rebaseService = new GitHubSyncService(retryPlugin, () => {});
let refPatchAttempts = 0;
let baseTrees = [];
rebaseService.getHead = async () => remoteSnapshot("latest", [remoteFile("changed.md", "old"), remoteFile("other.md", "changed")]);
rebaseService.api = async (_token, method, endpoint, body) => {
  if (endpoint === "/git/trees") {
    baseTrees.push(body.base_tree);
    return { sha: `${body.base_tree}-new` };
  }
  if (endpoint === "/git/commits") return { sha: `${body.tree}-commit`, tree: { sha: body.tree } };
  if (endpoint.startsWith("/git/refs/heads/")) {
    refPatchAttempts++;
    if (refPatchAttempts === 1) {
      const error = new Error("remote moved");
      error.name = "RemoteChangedDuringSyncError";
      throw error;
    }
    return { object: { sha: body.sha } };
  }
  throw new Error(`unexpected api call: ${method} ${endpoint}`);
};
const rebaseCommit = await rebaseService.pushEntriesWithRemoteRetry(
  "token",
  "main",
  remoteSnapshot("planned", [remoteFile("changed.md", "old")]),
  [{ path: "changed.md", mode: "100644", type: "blob", sha: "local" }],
);
assert.equal(refPatchAttempts, 2);
assert.deepEqual(baseTrees, ["planned-tree", "latest-tree"]);
assert.equal(rebaseCommit, "latest-tree-new-commit");

const pluginSettingsPlugin = {
  settings: { ...retryPlugin.settings, lastSyncedCommit: "base" },
  getGitHubToken: () => "token",
  t: retryPlugin.t,
  app: { vault: { adapter: { exists: async () => true } } },
};
const pluginSettingsService = new GitHubSyncService(pluginSettingsPlugin, () => {});
pluginSettingsService.getHead = async () => remoteSnapshot("remote", [
  remoteFile(".obsidian/plugins/example/data.json", "remote"),
]);
pluginSettingsService.tryGetSnapshot = async () => remoteSnapshot("base", [
  remoteFile(".obsidian/plugins/example/data.json", "base"),
]);
pluginSettingsService.getLocalSnapshot = async () => map([
  [".obsidian/plugins/example/data.json", localFile(".obsidian/plugins/example/data.json", "local")],
]);
pluginSettingsService.getRemoteModifiedAt = async () => 0;
pluginSettingsService.createRemoteConflictCopy = async (_token, remote) => localFile(`${remote.path}.conflict-test.json`, "remote-copy");
pluginSettingsService.ensureSelfEnabled = async () => null;
pluginSettingsService.readLocalBinary = async (path) => buffer(path);
pluginSettingsService.api = async (_token, method, endpoint) => {
  if (method === "POST" && endpoint === "/git/blobs") return { sha: "blob-sha" };
  throw new Error(`unexpected api call: ${method} ${endpoint}`);
};
let pluginSettingsPushes = 0;
pluginSettingsService.pushEntriesWithRemoteRetry = async (_token, _branch, _remote, entries) => {
  pluginSettingsPushes++;
  assert.ok(entries.some((entry) => entry.path === ".obsidian/plugins/example/data.json"));
  return "plugin-settings-upload";
};
const pluginSettingsResult = await pluginSettingsService.syncAttempt("token", "main");
assert.equal(pluginSettingsPushes, 1);
assert.equal(pluginSettingsResult.pushed, 2);
assert.equal(pluginSettingsResult.commitSha, "plugin-settings-upload");

const viewerStateService = new GitHubSyncService(pluginSettingsPlugin, () => {});
viewerStateService.getHead = async () => remoteSnapshot("remote", [
  remoteFile(".obsidian/plugins/gitsync-portal/sync-state.json", "remote"),
]);
viewerStateService.tryGetSnapshot = async () => remoteSnapshot("base", [
  remoteFile(".obsidian/plugins/gitsync-portal/sync-state.json", "base"),
]);
viewerStateService.getLocalSnapshot = async () => map([
  [".obsidian/plugins/gitsync-portal/sync-state.json", localFile(".obsidian/plugins/gitsync-portal/sync-state.json", "local")],
]);
viewerStateService.getRemoteModifiedAt = async () => 0;
viewerStateService.createRemoteConflictCopy = async (_token, remote) => localFile(`${remote.path}.conflict-test.json`, "remote-copy");
viewerStateService.ensureSelfEnabled = async () => null;
viewerStateService.readLocalBinary = async (path) => buffer(path);
viewerStateService.api = async (_token, method, endpoint) => {
  if (method === "POST" && endpoint === "/git/blobs") return { sha: "blob-sha" };
  throw new Error(`unexpected api call: ${method} ${endpoint}`);
};
let viewerStatePushes = 0;
viewerStateService.pushEntriesWithRemoteRetry = async (_token, _branch, _remote, entries) => {
  viewerStatePushes++;
  assert.ok(entries.some((entry) => entry.path === ".obsidian/plugins/gitsync-portal/sync-state.json"));
  return "state-upload";
};
const viewerStateResult = await viewerStateService.syncAttempt("token", "main");
assert.equal(viewerStatePushes, 1);
assert.equal(viewerStateResult.pushed, 2);
assert.equal(viewerStateResult.commitSha, "state-upload");

console.log("Git sync core tests passed.");
