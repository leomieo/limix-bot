import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** The UI may be extracted after the executable during a Windows update. */
export function installedUiReady(resourcesPath) {
  try {
    const ui = join(resourcesPath, "ui");
    const html = readFileSync(join(ui, "index.html"), "utf8");
    if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) return false;
    const assets = [...html.matchAll(/(?:src|href)=["'](?:\.\/|\/)?(assets\/[^"'?#]+)(?:[?#][^"']*)?["']/g)];
    return assets.every(([, asset]) => !asset.split("/").includes("..") && statSync(join(ui, asset)).size > 0);
  } catch {
    return false;
  }
}

export async function waitForInstalledUi({
  resourcesPath, timeoutMs = 300_000, intervalMs = 500, onWaiting = () => {},
  cancelled = () => false, ready = () => installedUiReady(resourcesPath),
  now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (ready()) return true;
  if (timeoutMs <= 0 || cancelled()) return false;
  onWaiting();
  const deadline = now() + timeoutMs;
  while (!cancelled() && now() < deadline) {
    await sleep(Math.min(intervalMs, deadline - now()));
    // Wait for two successful reads so partially extracted assets do not pass.
    if (ready()) {
      await sleep(intervalMs);
      if (!cancelled() && ready()) return true;
    }
  }
  return false;
}
