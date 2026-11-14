import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = {
  'darwin-arm64': ['aarch64-apple-darwin', '353d5f1b4fd2715e7053f12f068435d5bbad16b91e057006b5d01e0925709a7e', '743f85035a1996ecb350659e01cd9faea9709829be09b1b4b03c73eaf3c9cd73'],
  'darwin-x64': ['x86_64-apple-darwin', '37c38fda76fec1fbf310adcbafb7f0d96af13b5511bf8ea954c3aa8eec185734', 'b0f52b0e3945b4107d89024ea38e625683011fbfc05a0d98f9fa2d6dcee28c66'],
  'linux-x64': ['x86_64-unknown-linux-gnu', 'ce4f6d0a6cfdb3bed6e44c2f9affd85943c76a42e25ad3a259002f31d6fb8a20', 'f68d291c75783122dad58ab77def0e13f3233f358731db5d6d7e8715603b928f'],
};
if (!['darwin', 'linux'].includes(process.platform)) throw new Error('Run on a macOS or Linux build runner');
const targets = process.platform === 'darwin' ? ['darwin-arm64', 'darwin-x64'] : ['linux-x64'];
for (const target of targets) {
  const [triple, pythonHash, uvHash] = assets[target];
  const destination = join(root, 'limix-runtime', ...(process.platform === 'darwin' ? [target.split('-')[1]] : []));
  mkdirSync(destination, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'limix-runtime-build-'));
  try {
    for (const [url, expected, name] of [
      [`https://github.com/astral-sh/python-build-standalone/releases/download/20261026/cpython-3.12.16%2B20261026-${triple}-install_only_stripped.tar.gz`, pythonHash, 'python'],
      [`https://github.com/astral-sh/uv/releases/download/0.13.5/uv-${triple}.tar.gz`, uvHash, 'uv'],
    ]) {
      const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error(`Runtime download ${target}/${name}: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Runtime checksum mismatch: ${target}/${name}`);
      const archive = join(scratch, `${name}.tgz`), extracted = join(scratch, name);
      writeFileSync(archive, bytes); mkdirSync(extracted);
      execFileSync('tar', ['-xzf', archive, '-C', extracted]);
      if (name === 'python') cpSync(join(extracted, 'python'), join(destination, 'python'), { recursive: true, verbatimSymlinks: true });
      else cpSync(join(extracted, `uv-${triple}`), join(destination, 'uv'), { recursive: true, verbatimSymlinks: true });
    }
    if (target === `${process.platform}-${process.arch}`) {
      execFileSync(join(destination, 'python', 'bin', 'python3'), ['--version'], { stdio: 'inherit' });
      execFileSync(join(destination, 'uv', 'uv'), ['--version'], { stdio: 'inherit' });
    }
    console.log(`Prepared checksummed Python/uv: ${target}`);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  if (target === `${process.platform}-${process.arch}`) {
    execFileSync(join(destination, 'python', 'bin', 'python3'), ['--version'], { stdio: 'inherit' });
    execFileSync(join(destination, 'uv', 'uv'), ['--version'], { stdio: 'inherit' });
  }
}
