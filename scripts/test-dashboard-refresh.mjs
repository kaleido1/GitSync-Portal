import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("main.ts", "utf8");
const dashboardView = fs.readFileSync("src/viewer-view.ts", "utf8");

assert.match(source, /workspace\.on\("file-open",[\s\S]*?scheduleDashboardRefresh\(\)/, "file-open must refresh the Dashboard");
assert.match(source, /workspace\.on\("active-leaf-change",[\s\S]*?scheduleDashboardRefresh\(\)/, "changing active notes must refresh the Dashboard");
assert.match(source, /async openHomeNote\(\)[\s\S]*?await this\.openFile\(file\)/, "Open home must use the shared file-open path");
assert.match(source, /async openFile\(file: TFile\)[\s\S]*?scheduleDashboardRefresh\(\)/, "Dashboard file opens must request a refresh");
assert.match(dashboardView, /if \(this\.activeTab === "home"\) \{\s*this\.renderActiveNote\(root\);/, "the refreshed home view must render the Current note card");

console.log("Current note card refresh regression checks passed.");
