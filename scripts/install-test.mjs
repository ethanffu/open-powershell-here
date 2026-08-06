/**
 * `npm run install:test` — copy the built plugin into the project-local test
 * vault (.test-vault), so it can be manually loaded without touching any
 * real vault. Only main.js, manifest.json and styles.css (when present) are
 * copied. .test-vault/ is gitignored and holds no real notes.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = join(root, '.test-vault', '.obsidian', 'plugins', 'vault-powershell');

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
  console.log(`copied ${file} -> .test-vault/.obsidian/plugins/vault-powershell/${file}`);
}

console.log('\nTest vault ready: ' + join(root, '.test-vault'));
console.log('Open this folder as a vault in Obsidian and enable the plugin to test.');
