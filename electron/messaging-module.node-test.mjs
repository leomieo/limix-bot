// Limix Bot has no Telegram / Zalo / Discord gateway of its own: nothing ships it, starts it, routes to it or opens it, and
// the Bot API knows no channel, owner lane or channel unlock. Telegram and the like are Apps (connected apps) instead.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const gone = (rel) => !existsSync(new URL(`../${rel}`, import.meta.url));

test("the desktop app and the server image neither ship nor start a messaging gateway", () => {
  assert.doesNotMatch(read("electron-builder.yml"), /limix-gateway|limix\/gateway|messaging-gateway/u);
  assert.doesNotMatch(read("Dockerfile"), /limix-gateway|limix\/gateway|messaging-gateway/u);
  assert.doesNotMatch(read("deploy/managed-beta/compose.yaml"), /LIMIX_GATEWAY_SIDECAR/u);
  assert.doesNotMatch(read("server/cloud-home-start.ts"), /LIMIX_GATEWAY_SIDECAR/u);
  for (const rel of ["electron/limix-gateway.mjs", "server/limix-gateway-sidecar.ts", "server/limix-channel-actions.ts", "src/components/ChannelReplyComposer.tsx",
    "limix/gateway", "limix/modules/messaging-gateway", "server/limix-owner-lane.ts", "server/limix-channel-review.ts", "server/limix-channel-review-path.ts",
    "server/limix-channel-identity.ts", "server/limix-channel-media.ts", "src/components/LimixChannelReview.tsx", "src/components/ChannelConversationNotice.tsx"]) {
    assert.ok(gone(rel), rel);
  }
});

test("no menu, window, IPC, proxy route, unlock or reply box reaches a channel", () => {
  assert.doesNotMatch(read("electron/main.mjs"), /limix-gateway|createLimixGateway|LIMIX_OWNER_LANE_TOKEN|limix-account:review/u);
  assert.doesNotMatch(read("electron/preload.cjs"), /limix-gateway|limixGateway|limix-account:review/u);
  assert.doesNotMatch(read("src/components/SidebarProfileMenu.tsx"), /limixGateway/u);
  assert.doesNotMatch(read("src/components/ChatView.tsx"), /ChannelReplyComposer|ChannelConversationNotice/u);
  const server = read("server/index.ts") + read("server/routes/bot-skills.ts") + read("server/bot-api-host.ts");
  assert.doesNotMatch(server, /limix-gateway-sidecar|\/api\/limix\/gateway|channelActionRoute|channel-review|limix-owner-lane|limix-channel/u);
});
