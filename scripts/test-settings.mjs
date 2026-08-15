import assert from "node:assert/strict";
import Module from "node:module";
import { buildSync } from "esbuild";

class Component {
  inputEl = { type: "" };

  addOption() { return this; }
  onChange() { return this; }
  onClick() { return this; }
  setButtonText() { return this; }
  setCta() { return this; }
  setDestructive() { return this; }
  setDisabled() { return this; }
  setLimits() { return this; }
  setPlaceholder() { return this; }
  setValue() { return this; }
}

class FakeSetting {
  components = 0;

  addButton(callback) { return this.addComponent(callback); }
  addDropdown(callback) { return this.addComponent(callback); }
  addSlider(callback) { return this.addComponent(callback); }
  addText(callback) { return this.addComponent(callback); }
  addTextArea(callback) { return this.addComponent(callback); }
  addToggle(callback) { return this.addComponent(callback); }
  setClass() { return this; }

  addComponent(callback) {
    this.components++;
    callback(new Component());
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
};
const plugin = {
  settings,
  t: (key) => key,
  getLanguageOptions: () => [["auto", "System default"], ["en", "English"]],
  getGitHubToken: () => "",
  setGitHubToken: () => {},
  getCurrentDeviceName: () => "Mac",
  formatDateTime: () => "Never",
  saveSettings: async () => {},
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

for (const item of items) {
  if (typeof item.render === "function") item.render(new FakeSetting(), {});
}

console.log(`Declarative settings test passed for ${items.length} searchable settings.`);
