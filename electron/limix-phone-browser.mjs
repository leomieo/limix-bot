// Limix Bot: open the app in a phone's browser on the same Wi-Fi. When the person turns it on, the app's own server
// also listens on this network (OMB_LAN=1, the self-hosted `serve --lan` mode): only private-network connections are
// accepted, and a phone must sign in with a one-time pairing code before it can do anything.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const fileFor = (userData) => path.join(userData, "limix-phone-browser.json");

export function limixPhoneBrowserOn(userData) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(userData), "utf8"))?.lan === true;
  } catch {
    return false;
  }
}

export function setLimixPhoneBrowser(userData, on) {
  fs.writeFileSync(fileFor(userData), JSON.stringify({ lan: on === true }));
}

/** The app server's tunnel listener; the companion passes browser requests from the remote (4G) link to it. Same path
 * for the server and the companion: both are started by this process. */
export function limixWebSocketPath() {
  const key = crypto.createHash("sha256").update(`${os.userInfo().username}\0${process.execPath}`).digest("hex").slice(0, 12);
  return process.platform === "win32" ? `\\\\.\\pipe\\limix-web-${key}` : path.join(os.tmpdir(), `limix-web-${key}.sock`);
}

export function limixPhoneBrowserEnv(userData) {
  return { ...(limixPhoneBrowserOn(userData) ? { OMB_LAN: "1" } : {}), OMB_TUNNEL_SOCKET: limixWebSocketPath() };
}
