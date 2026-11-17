// The Telegram / Zalo / Discord gateway is a separate module: nothing in the desktop app, the server or the server image
// ships it, starts it, routes to it or opens it.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

test("the desktop app and the server image do not ship or start the messaging gateway", () => {
  assert.doesNotMatch(read("electron-builder.yml"), /limix-gateway|limix\/gateway|messaging-gateway/u);
  assert.doesNotMatch(read("Dockerfile"), /limix-gateway|limix\/gateway|messaging-gateway/u);
  assert.doesNotMatch(read("deploy/managed-beta/compose.yaml"), /LIMIX_GATEWAY_SIDECAR/u);
  assert.doesNotMatch(read("server/cloud-home-start.ts"), /LIMIX_GATEWAY_SIDECAR/u);
  for (const gone of ["electron/limix-gateway.mjs", "server/limix-gateway-sidecar.ts", "server/limix-channel-actions.ts", "src/components/ChannelReplyComposer.tsx", "limix/gateway"]) {
    assert.equal(existsSync(new URL(`../${gone}`, import.meta.url)), false, gone);
  }
  assert.ok(existsSync(new URL("../limix/modules/messaging-gateway/src/main.mjs", import.meta.url)), "the module keeps its own entry");
});

test("no menu, window, IPC, proxy route or reply box reaches a gateway", () => {
  assert.doesNotMatch(read("electron/main.mjs"), /limix-gateway|createLimixGateway/u);
  assert.doesNotMatch(read("electron/preload.cjs"), /limix-gateway|limixGateway/u);
  assert.doesNotMatch(read("src/components/SidebarProfileMenu.tsx"), /limixGateway/u);
  assert.doesNotMatch(read("src/components/ChatView.tsx"), /ChannelReplyComposer/u);
  const server = read("server/index.ts") + read("server/routes/bot-skills.ts");
  assert.doesNotMatch(server, /limix-gateway-sidecar|\/api\/limix\/gateway|channelActionRoute|\/api\/limix\/channel-action/u);
});

test("the owner's secret is only ever the one the desktop app makes, never one a server invents for a connector", () => {
  const lane = read("server/limix-owner-lane.ts");
  assert.doesNotMatch(lane, /LIMIX_GATEWAY_SIDECAR|randomBytes/u);
  assert.match(read("server/limix-channel-review.ts"), /limixOwnerCall/u, "channel history still opens only for the owner");
});
