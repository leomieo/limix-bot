import assert from "node:assert/strict";

async function checkDesktop() {
  const base = process.env.OMB_CLOUD_BOAT_URL + "/sandboxes";
  const authorization = "Bearer " + process.env.OMB_CLOUD_BOAT_TOKEN;
  async function post(url, data, headers = {}) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization,
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(data),
    });
    assert(response.ok);
    return response.json();
  }
  assert.equal((await fetch(base)).status, 401);
  const first = (
    await post(base, { noEnv: true }, { "idempotency-key": "fixture-first" })
  ).sandbox;
  const second = (await post(base, { name: "fixture-second" })).sandbox;
  assert.match(first.id, /^bx_[23456789abcdefghjkmnpqrstuvwxyz]{8}$/);
  assert.notEqual(first.id, second.id);
  assert.equal(
    (await post(base, { noEnv: true }, { "idempotency-key": "fixture-first" }))
      .sandbox.id,
    first.id,
  );
  const exec = (id, command) =>
    post(base + "/" + id + "/commands", { command });
  assert.equal(
    (
      await exec(
        first.id,
        "echo fixture > /home/cua/shared-test && xdotool mousemove 40 70 click 1 && xdotool type fixture && scrot -o /tmp/frame.jpg",
      )
    ).exitCode,
    0,
  );
  assert.equal(
    (await exec(second.id, "cat /home/cua/shared-test")).stdout.trim(),
    "fixture",
  );
  const frame = await fetch(
    base + "/" + second.id + "/artifacts?path=/tmp/frame.jpg",
    { headers: { authorization } },
  );
  assert(frame.ok);
  assert(
    Buffer.from(await frame.arrayBuffer())
      .subarray(0, 2)
      .equals(Buffer.from([255, 216])),
  );
  const url = new URL(
    (await post(base + "/" + first.id + "/desktop?vnc=1", {})).desktopUrl,
  );
  const edge = "http://127.0.0.1:8080";
  const { request } = await import("node:http");
  const { randomBytes } = await import("node:crypto");
  await new Promise((resolve, reject) => {
    const req = request(
      edge + url.pathname,
      { headers: { host: url.host } },
      (res) => {
        res.setEncoding("utf8");
        let text = "";
        res.on("data", (s) => {
          text += s;
        });
        res.on("end", () =>
          res.statusCode === 200 && /noVNC/i.test(text)
            ? resolve()
            : reject(Error("Viewer unavailable: " + res.statusCode)),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
  await new Promise((resolve, reject) => {
    const req = request(edge + "/" + url.searchParams.get("path"), {
      headers: {
        host: url.host,
        origin: url.origin,
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": 13,
        "sec-websocket-key": randomBytes(16).toString("base64"),
      },
    });
    req.setTimeout(10000, () => req.destroy(Error("WebSocket timeout")));
    req.on("error", reject);
    req.on("response", (res) => {
      res.resume();
      reject(Error("WebSocket refused: " + res.statusCode));
    });
    req.on("upgrade", (res, socket) => {
      socket.destroy();
      resolve();
    });
    req.end();
  });
}

await checkDesktop();
