import { t } from "@/lib/i18n";
import { lx } from "@/lib/limix-text";

/** A conversation that came in through the Bot API (an outside app or a messaging channel): read here, answered there. */
export function ChannelConversationNotice({ onInternal }: { onInternal: () => void }) {
  return <div className="pointer-events-auto mx-5 mb-4 rounded-2xl border border-hairline/60 bg-raised p-4" data-testid="channel-conversation-notice">
    <p className="text-sm text-ink">{lx("Cuộc trò chuyện này đến từ bên ngoài qua Bot API (kênh nhắn tin hoặc ứng dụng khác).", "This conversation came in from outside through the Bot API (a messaging channel or another app).")}</p>
    <p className="mt-1 text-xs text-ink-secondary">{lx("Trả lời người nhắn ở kênh đó, ví dụ qua mô-đun Messaging Gateway. Muốn giao việc cho bot, mở chat nội bộ.", "Answer the sender in that channel, for example through the Messaging Gateway module. To give the bot work, open the internal chat.")}</p>
    <button type="button" onClick={onInternal} className="mt-2 rounded-full bg-control px-4 py-2 text-sm text-ink">{t("chat.channel.openInternal")}</button>
  </div>;
}
