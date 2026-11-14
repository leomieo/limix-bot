import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
const root = process.argv[2];
if (!root) throw new Error('Pass the release directory');
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
for (const stable of ['LimixBot-setup.exe', 'LimixBot-Apple-Silicon.dmg', 'LimixBot-Intel.dmg', 'LimixBot-Linux-x64.AppImage', 'LimixBot-Linux-x64.deb']) {
  if (!existsSync(join(root, stable))) throw new Error(`Missing platform artifact: ${stable}`);
}
for (const name of ['latest.yml', 'latest-mac.yml', 'latest-linux.yml']) {
  const feed = parse(readFileSync(join(root, name), 'utf8'));
  if (feed.version !== version || !feed.files?.length) throw new Error(`Wrong feed version: ${name}`);
  for (const file of feed.files) {
    const filename = decodeURIComponent(file.url);
    if (basename(filename) !== filename) throw new Error('Invalid feed file path');
    const bytes = readFileSync(join(root, filename));
    if (bytes.length !== file.size || createHash('sha512').update(bytes).digest('base64') !== file.sha512) throw new Error(`Invalid updater artifact: ${filename}`);
  }
  if (name === 'latest-mac.yml' && (!feed.files.some(file => /arm64.*\.zip$/.test(file.url)) || !feed.files.some(file => !/arm64/.test(file.url) && /\.zip$/.test(file.url)))) throw new Error('macOS feed must include both Apple Silicon and Intel ZIPs');
}
console.log(`PASS release ${version}: Windows, macOS arm64/x64 and Linux feeds/hashes`);
