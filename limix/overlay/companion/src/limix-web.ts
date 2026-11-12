// Limix Bot: the remote (4G) link opens the app's web page in a phone's browser. The Cloudflare tunnel ends at this
// companion's private origin, which speaks only to the native phone app; requests from a browser are passed on, as
// they are, to the app server's tunnel listener (LIMIX_WEB_ORIGIN = its OMB_TUNNEL_SOCKET). That listener treats every
// request as remote: nothing works there before the browser signs in with a one-time pairing code.
import { request, type IncomingMessage, type ServerResponse } from "node:http";
import { connect } from "node:net";
import type { Duplex } from "node:stream";

const WEB = process.env.LIMIX_WEB_ORIGIN?.trim() || null;

/** A browser (page, script, its WebSocket), not the native app: the app always sends a bearer token, except to pair. */
export function isLimixWebRequest(req: IncomingMessage): boolean {
  if (!WEB) return false;
  const path = (req.url ?? "/").split("?")[0] ?? "/";
  const method = req.method ?? "GET";
  if (req.headers.origin) return true;
  if (req.headers.authorization) return false;
  if (method === "POST" && path === "/api/pair") return false;
  if (method === "GET" && path === "/api/health") return false;
  if (path.startsWith("/v1/")) return false;
  return true;
}

export function forwardToLimixWeb(req: IncomingMessage, res: ServerResponse): void {
  const upstream = request({ socketPath: WEB!, path: req.url ?? "/", method: req.method ?? "GET", headers: req.headers }, (reply) => {
    res.writeHead(reply.statusCode ?? 502, reply.headers);
    reply.pipe(res);
  });
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Limix Bot chưa sẵn sàng. Thử lại sau vài giây.");
  });
  req.pipe(upstream);
}

export function forwardUpgradeToLimixWeb(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  const upstream = connect(WEB!, () => {
    const lines = [`${req.method ?? "GET"} ${req.url ?? "/"} HTTP/1.1`];
    for (let i = 0; i + 1 < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}
