import fs from "node:fs";

const expectedTag = process.argv[2]?.trim();
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
const mainBundle = fs.readFileSync("main.js", "utf8");

if (manifest.id !== "gitsync-portal" || manifest.name !== "GitSync Portal") {
  throw new Error(`unexpected plugin identity: ${manifest.id} / ${manifest.name}`);
}

if (packageJson.name !== manifest.id || packageJson.repository?.url !== "https://github.com/kaleido1/GitSync-Portal.git") {
  throw new Error("package metadata does not match GitSync Portal");
}

if (manifest.version !== packageJson.version) {
  throw new Error(`manifest version ${manifest.version} does not match package version ${packageJson.version}`);
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  throw new Error(`versions.json does not map ${manifest.version} to ${manifest.minAppVersion}`);
}

if (expectedTag && manifest.version !== expectedTag) {
  throw new Error(`manifest version ${manifest.version} does not match release tag ${expectedTag}`);
}

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error(`missing release asset: ${file}`);
  }
}

for (const marker of ["GitSync Portal", "gitsync-portal", "gitsync-port-github-token", "obsidian-viewer-github-token"]) {
  if (!mainBundle.includes(marker)) throw new Error(`main.js is missing identity or migration marker: ${marker}`);
}

console.log(`Release assets verified for ${manifest.version}.`);
