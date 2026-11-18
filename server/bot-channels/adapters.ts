import type { RequestAuth } from "../request-auth.ts";
import { discordAdapter } from "./discord.ts";
import type { ChannelAdapter, ChannelKind, ChannelLogin } from "./engine.ts";
import { facebookAdapter } from "./facebook.ts";
import { messengerBridge } from "./messenger.ts";
import { telegramAdapter } from "./telegram.ts";
import { zaloAdapter, zaloLogin } from "./zalo.ts";

export function botChannelParts(manageRefusal: (auth: RequestAuth, botId: string) => string | null) {
  const messenger = messengerBridge({ manageRefusal });
  const adapters: ChannelAdapter[] = [telegramAdapter(), discordAdapter(), zaloAdapter(), facebookAdapter(), messenger.adapter];
  const logins: Partial<Record<ChannelKind, ChannelLogin>> = { zalo: zaloLogin() };
  return { adapters, logins, bridgeRoutes: messenger.routes };
}
