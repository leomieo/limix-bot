export * from "../../shared/ready-bots";
import { readyBotCopy as originalCopy, type ReadyBot } from "../../shared/ready-bots";
import { activeLocale, tFromServer } from "./i18n";
import { industryTemplate } from "../../shared/industry-templates";

export function readyBotCopy(bot: ReadyBot) {
  const industry = industryTemplate(bot.id, activeLocale());
  if (industry) return originalCopy(industry);
  const base = originalCopy(bot);
  const key = `readyBots.bot.${bot.id}`;
  return {
    title: tFromServer(`${key}.title`, base.title),
    description: tFromServer(`${key}.description`, base.description),
    tryAsking: tFromServer(`${key}.try`, base.tryAsking),
  };
}
