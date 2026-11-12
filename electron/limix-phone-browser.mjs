// Limix Bot: open the app in a phone's browser on the same Wi-Fi. When the person turns it on, the app's own server
// also listens on this network (OMB_LAN=1, the self-hosted `serve --lan` mode): only private-network connections are
// accepted, and a phone must sign in with a one-time pairing code before it can do anything.
import fs from "node:fs";
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

export function limixPhoneBrowserEnv(userData) {
  return limixPhoneBrowserOn(userData) ? { OMB_LAN: "1" } : {};
}
