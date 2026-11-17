import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
const root = process.argv[2];
if (!root) throw new Error('Pass the release directory');
// Windows and Linux publish first; macOS joins the same release when its slower build is done.
const platforms = new Set((process.argv[3] ?? 'windows,linux,macos').split(','));
const STABLE = { windows: ['LimixBot-setup.exe'], macos: ['LimixBot-Apple-Silicon.dmg', 'LimixBot-Intel.dmg'], linux: ['LimixBot-Linux-x64.AppImage', 'LimixBot-Linux-x64.deb'] };
const FEEDS = { windows: 'latest.yml', macos: 'latest-mac.yml', linux: 'latest-linux.yml' };
for (const platform of platforms) if (!STABLE[platform]) throw new Error(`Unknown platform: ${platform}`);
const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version;
for (const stable of [...platforms].flatMap((platform) => STABLE[platform])) {
  if (!existsSync(join(root, stable))) throw new Error(`Missing platform artifact: ${stable}`);
}
for (const name of [...platforms].map((platform) => FEEDS[platform])) {
  const feed = parse(readFileSync(join(root, name), 'utf8'));
  if (feed.version !== version || !feed.files?.length) throw new Error(`Wrong feed version: ${name}`);
  for (const file of feed.files) {
    const filename = decodeURIComponent(file.url);
    if (basename(filename) !== filename) throw new Error('Invalid feed file path');
    const bytes = readFileSync(join(root, filename));
    if (bytes.length !== file.size || createHash('sha512').update(bytes).digest('base64') !== file.sha512) throw new Error(`Invalid updater artifact: ${filename}`);
  }
  if (name === 'latest-mac.yml' && (!feed.files.some(file => /arm64.*\.zip$/.test(file.url)) || !feed.files.some(file => !/arm64/.test(file.url) && file.url.endsWith(".zip")))) throw new Error('macOS feed must include both Apple Silicon and Intel ZIPs');
}
console.log(`PASS release ${version}: ${[...platforms].join(', ')} feeds/hashes`);
