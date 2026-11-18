import http from "node:http";
import net from "node:net";
import { realpath, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { createHmac } from "node:crypto";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);
const key = readFileSync("/run/limix-desktop-token", "utf8");
const origin = new URL(process.env.LIMIX_DESKTOP_ORIGIN).origin;
const prefix =
  "/limix-desktop/" +
  createHmac("sha256", key).update("view-v1").digest("base64url") +
  "/";
const stateFile = "/var/lib/limix-desktop/aliases.json";
const aliases = new Map(
  existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : [],
);
const guest = {
  uid: 1000,
  gid: 1000,
  cwd: "/home/cua",
  env: {
    PATH: "/usr/local/bin:/usr/bin:/bin",
    HOME: "/home/cua",
    USER: "cua",
    DISPLAY: ":1",
    XDG_RUNTIME_DIR: "/run/user/1000",
    DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus",
  },
  timeout: 120000,
  maxBuffer: 8 * 1024 * 1024,
};
function save() {
  writeFileSync(stateFile + ".tmp", JSON.stringify([...aliases]), {
    mode: 0o600,
  });
  renameSync(stateFile + ".tmp", stateFile);
}
function reply(res, status, data) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}
async function payload(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 1048576) throw Error("too large");
  }
  return data ? JSON.parse(data) : {};
}
http
  .createServer(async (req, res) => {
    if (req.headers.authorization !== "Bearer " + key)
      return reply(res, 401, {});
    try {
      const url = new URL(req.url, "http://desktop");
      if (url.pathname === "/v1/sandboxes") {
        if (req.method === "GET")
          return reply(res, 200, { sandboxes: [...aliases.values()] });
        if (req.method === "POST") {
          const { name } = await payload(req);
          const requestKey = req.headers["idempotency-key"] ?? name;
          if (
            typeof requestKey !== "string" ||
            !requestKey.length ||
            requestKey.length > 256 ||
            (name !== undefined &&
              (typeof name !== "string" || !name.length || name.length > 256))
          )
            return reply(res, 400, {});
          const receipt = createHmac("sha256", key)
            .update(requestKey)
            .digest("hex");
          const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
          const id =
            "bx_" +
            Array.from(
              Buffer.from(receipt, "hex").subarray(0, 8),
              (byte) => alphabet[byte % alphabet.length],
            ).join("");
          const existing = aliases.get(id);
          if (existing)
            return existing.receipt === receipt
              ? reply(res, 200, { sandbox: existing })
              : reply(res, 409, {});
          const sandbox = { id, name: name ?? id, state: "running", receipt };
          aliases.set(id, sandbox);
          save();
          return reply(res, 201, { sandbox });
        }
      }
      if (
        /^\/v1\/sandboxes\/bx_[a-z0-9]{8}\/files\/(download-url|upload-url)$/.test(
          url.pathname,
        )
      )
        return reply(res, 501, {});
      const match = /^\/v1\/sandboxes\/(bx_[a-z0-9]{8})(?:\/([\w-]+))?$/.exec(
        url.pathname,
      );
      const sandbox = aliases.get(match?.[1]);
      if (!sandbox) return reply(res, 404, {});
      const action = match[2];
      if (!action && req.method === "DELETE") {
        aliases.delete(sandbox.id);
        save();
        return reply(res, 200, { ok: true });
      }
      if (!action && req.method === "PATCH") {
        const { name } = await payload(req);
        if (typeof name !== "string" || !name.length || name.length > 256)
          return reply(res, 400, {});
        sandbox.name = name;
        save();
      }
      if (
        (!action && ["GET", "PATCH"].includes(req.method)) ||
        (req.method === "POST" && ["resume", "stop"].includes(action))
      )
        return reply(res, 200, { sandbox });
      if (req.method === "POST" && action === "desktop") {
        const ready = await fetch("http://127.0.0.1:6901/vnc.html", {
          method: "HEAD", signal: AbortSignal.timeout(1500),
        }).then(response => response.ok, () => false);
        if (!ready) return reply(res, 202, { provisioning: true });
        return reply(res, 200, {
          desktopUrl:
            origin +
            prefix +
            "vnc.html?autoconnect=1&path=" +
            encodeURIComponent(prefix.slice(1) + "websockify"),
        });
      }
      if (req.method === "POST" && action === "commands") {
        const { command, detached } = await payload(req);
        if (detached)
          return reply(res, 501, {
            error: "Background commands are unavailable",
          });
        if (typeof command !== "string") return reply(res, 400, {});
        try {
          return reply(res, 200, {
            ...(await run("/bin/bash", ["-c", command], guest)),
            exitCode: 0,
          });
        } catch (e) {
          return reply(res, 200, {
            stdout: e.stdout || "",
            stderr: e.stderr || "",
            exitCode: Number.isInteger(e.code) ? e.code : 1,
            timedOut: !!e.killed,
          });
        }
      }
      if (req.method === "GET" && ["files", "artifacts"].includes(action)) {
        const path = url.searchParams.get("path");
        if (!path?.startsWith("/")) return reply(res, 400, {});
        const { stdout } = await run("/bin/cat", ["--", path], {
          ...guest,
          encoding: "buffer",
        });
        if (action === "files")
          return reply(res, 200, { content: stdout.toString("base64") });
        res.end(stdout);
        return;
      }
      return reply(res, 404, {});
    } catch {
      return reply(res, 400, { error: "Desktop request failed" });
    }
  })
  .listen(7000);

const assetRoot = "/usr/share/novnc";
const contentTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};
const view = http.createServer(async (req, res) => {
  if (req.method !== "GET" || !req.url.startsWith(prefix))
    return reply(res, 404, {});
  try {
    const file = await realpath(
      resolve(
        assetRoot,
        decodeURIComponent(req.url.slice(prefix.length).split("?")[0]),
      ),
    );
    const type = contentTypes[extname(file)];
    if (!file.startsWith(assetRoot + sep) || !type) return reply(res, 404, {});
    const data = await readFile(file);
    res.writeHead(200, {
      "content-type": type,
      "referrer-policy": "no-referrer",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(data);
  } catch {
    reply(res, 404, {});
  }
});
view.on("upgrade", (req, socket, head) => {
  if (
    req.url !== prefix + "websockify" ||
    req.headers.origin !== origin ||
    req.headers.upgrade?.toLowerCase() !== "websocket"
  )
    return socket.destroy();
  const upstream = net.connect(6901, "127.0.0.1", () => {
    upstream.write(
      "GET /websockify HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: " +
        req.headers["sec-websocket-key"] +
        "\r\n" +
        (req.headers["sec-websocket-protocol"]
          ? "Sec-WebSocket-Protocol: " +
            req.headers["sec-websocket-protocol"] +
            "\r\n"
          : "") +
        "\r\n",
    );
    upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
  upstream.on("close", () => socket.destroy());
});
view.listen(7001);
