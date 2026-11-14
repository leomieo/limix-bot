import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';

const [executableInput, resourcesInput] = process.argv.slice(2);
if (!executableInput || !resourcesInput) throw new Error('Pass packaged executable and resources paths');
const executable = resolve(executableInput), resources = resolve(resourcesInput);
for (const file of ['server/index.js', 'ui/index.html', 'app-update.yml', 'skills/rea-video/SKILL.md', 'limix-runtime/python/bin/python3', 'limix-runtime/uv/uv']) {
  if (!existsSync(join(resources, file))) throw new Error(`Missing packaged resource: ${file}`);
}
const reserve = async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
};
const port = await reserve(), webhook = await reserve(), fixture = mkdtempSync(join(tmpdir(), 'limix-packaged-'));
const child = spawn(executable, [join(resources, 'server', 'index.js')], { env: {
  ...process.env, ELECTRON_RUN_AS_NODE: '1', HOME: fixture, USERPROFILE: fixture,
  OMB_DATA_DIR: join(fixture, 'data'), OMB_PORT: String(port), OMB_WEBHOOK_PORT: String(webhook),
}, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; let exited = false;
child.stdout.on('data', data => { output = (output + data).slice(-12000); });
child.stderr.on('data', data => { output = (output + data).slice(-12000); });
child.on('exit', () => { exited = true; });
const closed = new Promise(resolve => child.once('close', resolve));
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (exited) break;
    try { const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error(`Packaged server did not become healthy: ${output}`);
  console.log(`PASS packaged Electron server health: ${process.platform}-${process.arch}`);
} finally {
  child.kill('SIGTERM');
  const hardStop = setTimeout(() => child.kill('SIGKILL'), 10000);
  await closed; clearTimeout(hardStop);
  rmSync(fixture, { recursive: true, force: true });
}
