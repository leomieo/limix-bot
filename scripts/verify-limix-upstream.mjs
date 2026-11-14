import { spawnSync } from "node:child_process";

const files = [
  "server/attachments.test.ts", "server/turn-images.test.ts",
  "server/drivers/acp/copilot.test.ts", "server/drivers/acp/opencode-go.test.ts",
  "server/runtime-coordinator.test.ts", "server/plan-usage.test.ts", "server/limit-resets.test.ts",
  "server/request-auth.test.ts", "server/bot-visibility.test.ts", "server/store-reorder-groups.test.ts",
  "shared/bot-order.test.ts", "src/state/store.test.ts", "src/state/read-in-flight.test.ts",
  "src/lib/attach-notice.test.ts", "src/lib/composer-attachments.test.ts", "src/lib/intake-files.test.ts",
  "src/lib/sidebar-room-drop.test.ts", "src/components/SidebarRoomDrag.test.ts",
  "src/components/MarkdownFilePreview.dom.test.ts", "src/components/ModelPicker.usage.test.ts",
  "src/components/ChatMoreMenu.test.ts", "server/engine-limits.e2e.test.ts",
];

function verify(args) {
  const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

verify(files);
verify(["server/index.test.ts", "-t", "stores the room order|streams shared documents safely"]);
