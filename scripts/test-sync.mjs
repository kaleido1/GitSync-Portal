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

const localFile = (path, sha) => ({ path, sha, file: { path } });
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
    folders: [".obsidian/plugins/example-plugin", ".obsidian/plugins/obsidian-git", ".obsidian/plugins/obsidian-viewer"],
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
  ".obsidian/plugins/obsidian-viewer": {
    files: [".obsidian/plugins/obsidian-viewer/main.js", ".obsidian/plugins/obsidian-viewer/data.json"],
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
      read: async () => '["dataview"]',
      writeBinary: async (_path, data) => { protectedWrite = new TextDecoder().decode(data); },
    },
  } },
  manifest: { id: "obsidian-viewer" },
  settings: { syncIgnorePatterns: [
    ".DS_Store",
    ".obsidian/workspace*.json",
    ".obsidian/community-plugins*.json",
    ".obsidian/core-plugins*.json",
    ".obsidian/page-preview.json",
    ".obsidian/plugins/obsidian-viewer/data.json",
    ".obsidian/plugins/obsidian-git/data.json",
    ".obsidian/plugins/obsidian-git/obsidian_askpass.sh",
    ".obsidian/plugins/*/manifest.conflict-*",
  ].join("\n") },
};
const service = new GitHubSyncService(fakePlugin, () => {});
assert.deepEqual(await service.listAdapterFiles(), [
  ".gitignore",
  ".obsidian/app.json",
  ".obsidian/plugins/example-plugin/main.js",
  ".obsidian/plugins/example-plugin/manifest.json",
  ".obsidian/plugins/obsidian-git/main.js",
  ".obsidian/plugins/obsidian-viewer/main.js",
  "folder/.hidden.md",
  "folder/visible.md",
  "note.md",
]);
const protectedList = await service.ensureSelfEnabled();
assert.equal(protectedList, null);
assert.deepEqual(JSON.parse(protectedWrite), ["dataview", "obsidian-viewer"]);
assert.equal(service.isSelfCoreFile(".obsidian/community-plugins.json"), true);
assert.equal(service.isSelfCoreFile(".obsidian/plugins/obsidian-viewer/main.js"), true);
assert.equal(service.isSelfCoreFile(".obsidian/plugins/dataview/main.js"), false);

console.log("Git sync core tests passed.");
