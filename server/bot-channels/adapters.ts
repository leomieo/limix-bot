import { discordAdapter } from "./discord.ts";
import type { ChannelAdapter, ChannelKind, ChannelLogin } from "./engine.ts";
import { facebookAdapter } from "./facebook.ts";
import { telegramAdapter } from "./telegram.ts";
import { zaloAdapter, zaloLogin } from "./zalo.ts";

export const botChannelAdapters = (): ChannelAdapter[] => [telegramAdapter(), discordAdapter(), zaloAdapter(), facebookAdapter()];
export const botChannelLogins = (): Partial<Record<ChannelKind, ChannelLogin>> => ({ zalo: zaloLogin() });
