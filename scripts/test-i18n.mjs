import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import Module from "node:module";

const output = buildSync({
  entryPoints: ["src/i18n.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  target: "node20",
}).outputFiles[0].text;

const testModule = new Module("i18n-test");
testModule.filename = "i18n-test.cjs";
testModule.paths = Module._nodeModulePaths(process.cwd());
testModule._compile(output, testModule.filename);
const { LANGUAGE_OPTIONS, resolveLanguage, translate } = testModule.exports;

assert.equal(Object.keys(LANGUAGE_OPTIONS).length, 23);
assert.equal(resolveLanguage("auto", "zh-Hans"), "zh");
assert.equal(resolveLanguage("auto", "zh-HK"), "zh-TW");
assert.equal(resolveLanguage("auto", "pt-BR"), "pt-BR");
assert.equal(resolveLanguage("auto", "de-DE"), "de");
assert.equal(resolveLanguage("auto", "xx-YY"), "en");
assert.equal(translate("es", "language"), "Idioma");
assert.equal(translate("de", "language"), "Sprache");
assert.equal(translate("it", "language"), "Lingua");
assert.equal(translate("fr", "appName"), "GitSync Port");
assert.equal(translate("zh", "notesCount", { count: 12 }), "12 篇笔记");
assert.equal(translate("en", "statusPushing", { path: "note.md" }), "Uploading local change: note.md");

for (const language of Object.keys(LANGUAGE_OPTIONS)) {
  const resolved = language === "auto" ? "en" : language;
  assert.ok(translate(resolved, "appName").length > 0);
  assert.ok(!translate(resolved, "searchResults", { count: 3 }).includes("{count}"));
}

console.log(`Localization tests passed for ${Object.keys(LANGUAGE_OPTIONS).length - 1} selectable languages plus system default.`);
