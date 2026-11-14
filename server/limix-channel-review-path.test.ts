import { expect, it } from "vitest";
import { channelReviewSensitivePath } from "./limix-channel-review-path.ts";
it.each(["/api/team-library/catalog", "/api/limix/bots", "/api/limix/bots/refresh", "/api/limix/bots/research", "/api/limix/bots/logs", "/api/org-library", "/api/catalogs", "/api/research"]) ("allows template and unrelated routes %s", path => expect(channelReviewSensitivePath(path)).toBe(false));
it.each(["/api/search", "/api/session-search", "/api/workspace-backup", "/api/workspace-backup/export", "/api/threads/thread/export", "/api/bots/bot/activity", "/api/admin-activity.csv", "/api/logs"]) ("protects conversation routes %s", path => expect(channelReviewSensitivePath(path)).toBe(true));
