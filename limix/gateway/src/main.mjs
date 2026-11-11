import { exec } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Gateway } from "./gateway.mjs";
import { PairingStore } from "./pairing.mjs";
import { SecretStore } from "./secrets.mjs";
import { Store } from "./store.mjs";
import { ensureDir } from "./util/files.mjs";
import { redact } from "./util/redact.mjs";
import { createApp } from "./web/server.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(process.env.LIMIX_DATA_DIR || join(root, "data"));
const port = Number(process.env.LIMIX_PORT || 8790);

ensureDir(dataDir);
const store = new Store(dataDir);
const secrets = new SecretStore(dataDir);
const pairing = new PairingStore(dataDir);
const gateway = new Gateway({ store, secrets, pairing });
const { server } = createApp({
  store, secrets, pairing, gateway, port,
  onShutdown: () => shutdown(),
  launcherToken: process.env.LIMIX_LAUNCHER_TOKEN || "",
});

process.on("unhandledRejection", (error) => console.error("[limix]", redact(error?.message ?? error)));

server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`Limix Bot đang chạy: ${url}`);
  console.log("Giữ cửa sổ này mở để bot tiếp tục trả lời. Nhấn Ctrl+C để dừng.");
  gateway.startAll();
  if (process.env.LIMIX_NO_BROWSER !== "1" && process.platform === "win32") exec(`start "" "${url}"`);
});

server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `Cổng ${port} đang bận — có thể Limix đã chạy rồi.` : redact(error.message));
  process.exit(1);
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("Đang dừng Limix…");
  await gateway.stopAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
