import assert from "node:assert/strict";
import Module from "node:module";
import { buildSync } from "esbuild";

class Component {
  inputEl = {
    type: "",
    rows: 0,
    style: { height: "" },
    scrollHeight: 160,
    setCssProps(properties) { Object.assign(this.style, properties); return this; },
  };
  value = "";
  disabled = false;
  changeHandler = null;

  addOption() { return this; }
  onChange(callback) { this.changeHandler = callback; return this; }
  onClick() { return this; }
  setButtonText() { return this; }
  setCta() { return this; }
  setDestructive() { return this; }
  setDisabled(value) { this.disabled = value; return this; }
  setLimits() { return this; }
  setPlaceholder() { return this; }
  setValue(value) { this.value = value; return this; }
  async change(value) { await this.changeHandler?.(value); }
}

class FakeSetting {
  components = 0;
  lastComponent = null;

  addButton(callback) { return this.addComponent(callback); }
  addDropdown(callback) { return this.addComponent(callback); }
  addSlider(callback) { return this.addComponent(callback); }
  addText(callback) { return this.addComponent(callback); }
  addTextArea(callback) { return this.addComponent(callback); }
  addToggle(callback) { return this.addComponent(callback); }
  setClass() { return this; }

  addComponent(callback) {
    this.components++;
    this.lastComponent = new Component();
    callback(this.lastComponent);
    return this;
  }
}

const output = buildSync({
  entryPoints: ["src/settings.ts"],
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
      Notice: class Notice {},
      PluginSettingTab: class PluginSettingTab {
        constructor(app, plugin) {
          this.app = app;
          this.plugin = plugin;
        }
        update() {}
      },
      TFile: class TFile {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const testModule = new Module("settings-test");
testModule.filename = "settings-test.cjs";
testModule.paths = Module._nodeModulePaths(process.cwd());
testModule._compile(output, testModule.filename);
const { GitSyncPortalSettingTab } = testModule.exports;
Module._load = originalLoad;

const settings = {
  language: "auto",
  syncRepository: "owner/repository",
  syncBranch: "main",
  syncDeviceNameAuto: true,
  syncDeviceName: "Mac",
  syncOnStartup: false,
  syncOnSave: false,
  syncPeriodically: false,
  syncIntervalMinutes: 30,
  syncMaxFileSizeMb: 50,
  syncUseGitignore: true,
  syncGitignoreAffectsPull: false,
  syncIgnorePatterns: "",
  homeNote: "",
  openDashboardOnStartup: false,
  maxHistory: 100,
  history: [],
  fontSize: 17,
  lineHeight: 1.7,
  contentWidth: 900,
  paragraphSpacing: 1,
  quizProgress: {},
  lastSyncAt: 0,
  lastSyncSummary: "",
};
const app = {
  vault: { configDir: ".obsidian" },
  workspace: { getActiveFile: () => null },
  plugins: {
    enabledPlugins: new Set(),
    manifests: {},
    getPlugin: () => undefined,
  },
};
let gitignoreContent = ".DS_Store\n.obsidian/workspace*.json\n.trash/";
const gitignoreWrites = [];
const plugin = {
  settings,
  t: (key) => key,
  getLanguageOptions: () => [["auto", "System default"], ["en", "English"]],
  getGitHubToken: () => "",
  setGitHubToken: () => {},
  getCurrentDeviceName: () => "Mac",
  formatDateTime: () => "Never",
  saveSettings: async () => {},
  readGitignore: async () => gitignoreContent,
  writeGitignore: async (value) => { gitignoreWrites.push(value); },
  testGitHubConnection: async () => "Connected",
  syncNow: async () => {},
  setHomeNote: async () => {},
  clearHistory: async () => {},
};

const tab = new GitSyncPortalSettingTab(app, plugin);
const definitions = tab.getSettingDefinitions();
assert.equal(definitions.length, 5);
assert.ok(definitions.every((definition) => definition.type === "group"));
assert.deepEqual(definitions.map((definition) => definition.heading), ["appName", "syncSection", "homeNote", "readingDisplay", "dataManagement"]);

const items = definitions.flatMap((definition) => definition.items ?? []);
assert.ok(items.length >= 20);
assert.ok(items.every((item) => typeof item.name === "string" && item.name.length > 0));
assert.equal(typeof tab.display, "undefined");
assert.equal(items.some((item) => item.name === "obsidianGitWarning"), false, "the warning must not show when Obsidian Git is absent or disabled");

app.plugins = {
  enabledPlugins: new Set(["obsidian-git"]),
  manifests: { "obsidian-git": {} },
  getPlugin: (id) => id === "obsidian-git" ? {} : undefined,
};
const enabledGitItems = new GitSyncPortalSettingTab(app, plugin)
  .getSettingDefinitions()
  .flatMap((definition) => definition.items ?? []);
assert.equal(enabledGitItems.some((item) => item.name === "obsidianGitWarning"), true, "the warning should show only when Obsidian Git is installed and enabled");
app.plugins = {
  enabledPlugins: new Set(),
  manifests: {},
  getPlugin: () => undefined,
};

for (const item of items) {
  if (typeof item.render === "function") item.render(new FakeSetting(), {});
}

const ignoredPathsItem = items.find((item) => item.name === "ignoredPaths");
settings.syncUseGitignore = true;
settings.syncIgnorePatterns = "local-only.md\nprivate/";
const gitignoreSetting = new FakeSetting();
ignoredPathsItem.render(gitignoreSetting, {});
await Promise.resolve();
assert.equal(gitignoreSetting.lastComponent.value, gitignoreContent, "enabled mode should show the real .gitignore");
assert.equal(gitignoreSetting.lastComponent.inputEl.rows, 6, "the editor should start large enough to show all lines");
await gitignoreSetting.lastComponent.change(".DS_Store\nnew-ignore/");
assert.deepEqual(gitignoreWrites, [".DS_Store\nnew-ignore/"], "enabled mode should write the root .gitignore");
assert.equal(settings.syncIgnorePatterns, "local-only.md\nprivate/", "editing .gitignore must preserve the local-only policy");

settings.syncUseGitignore = false;
const localRuleSetting = new FakeSetting();
ignoredPathsItem.render(localRuleSetting, {});
assert.equal(localRuleSetting.lastComponent.value, "local-only.md\nprivate/", "disabled mode should show the local-only policy");
assert.equal(localRuleSetting.lastComponent.disabled, false, "disabled mode must remain editable");
await localRuleSetting.lastComponent.change("local-only.md\ncache/");
assert.equal(settings.syncIgnorePatterns, "local-only.md\ncache/", "disabled mode should update the local-only policy");
assert.equal(gitignoreWrites.length, 1, "disabled mode must not modify .gitignore");

gitignoreContent = "from-gitignore/\n.DS_Store";
settings.syncUseGitignore = true;
const restoredGitignoreSetting = new FakeSetting();
ignoredPathsItem.render(restoredGitignoreSetting, {});
await Promise.resolve();
assert.equal(restoredGitignoreSetting.lastComponent.value, gitignoreContent, "re-enabling should restore .gitignore contents");

console.log(`Declarative settings test passed for ${items.length} searchable settings.`);
