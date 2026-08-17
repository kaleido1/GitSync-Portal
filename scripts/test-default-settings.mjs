import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("main.ts", "utf8");
const defaults = source.match(/const DEFAULT_SETTINGS: ViewerSettings = \{[\s\S]*?\n\};/)?.[0];

assert.ok(defaults, "DEFAULT_SETTINGS must remain defined in main.ts");
assert.match(defaults, /syncRepository: "",/, "new installations must start without a GitHub repository");
assert.doesNotMatch(defaults, /kaleido1\/Class-Notes/, "a personal repository must never be a plugin default");
assert.match(defaults, /syncUseGitignore: true,/, "new installations should support .gitignore for uploads");
assert.match(defaults, /syncGitignoreAffectsPull: false,/, ".gitignore should not affect pulls by default");

console.log("Default settings test passed: GitHub repository starts blank.");
