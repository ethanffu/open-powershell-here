/**
 * `npm run install:test` — copy the built plugin into the project-local test
 * vault (.test-vault), so it can be manually loaded without touching any
 * real vault. Only main.js, manifest.json and styles.css (when present) are
 * copied. Also registers the plugin in .test-vault/.obsidian/community-
 * plugins.json (Obsidian's enabled-plugin list) so the plugin loads
 * automatically when the test vault is opened — no manual enable needed
 * even after the test vault is recreated. .test-vault/ is gitignored and
 * holds no real notes.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const obsidianDir = join(root, '.test-vault', '.obsidian');
const targetDir = join(obsidianDir, 'plugins', 'open-powershell-here');

const artifacts = ['main.js', 'manifest.json', 'styles.css'];

for (const file of artifacts) {
  const src = join(root, file);
  if (!existsSync(src)) {
    if (file === 'main.js') {
      console.error('main.js is missing. Run `npm run build` first.');
      process.exit(1);
    }
    continue; // styles.css is optional — no CSS means no file.
  }
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(src, join(targetDir, file));
  console.log(`copied ${file} -> .test-vault/.obsidian/plugins/open-powershell-here/${file}`);
}

// Register the plugin in Obsidian's enabled-plugins list so it is loaded
// automatically on vault open (idempotent).
const pluginsJson = join(obsidianDir, 'community-plugins.json');
let enabled = [];
if (existsSync(pluginsJson)) {
  try {
    const parsed = JSON.parse(readFileSync(pluginsJson, 'utf8'));
    if (Array.isArray(parsed)) {
      enabled = parsed;
    }
  } catch {
    enabled = [];
  }
}
if (!enabled.includes('open-powershell-here')) {
  enabled.push('open-powershell-here');
  mkdirSync(obsidianDir, { recursive: true });
  writeFileSync(pluginsJson, JSON.stringify(enabled, null, 2));
  console.log('registered open-powershell-here in .test-vault/.obsidian/community-plugins.json');
} else {
  console.log('open-powershell-here already enabled in .test-vault/.obsidian/community-plugins.json');
}

console.log('\nTest vault ready: ' + join(root, '.test-vault'));
console.log('Open this folder as a vault in Obsidian; the plugin should load automatically.');
