import { api } from "@/state/api";
import { MESSAGE_PAGE_SIZE, type Message } from "@/state/store";
import { optimisticMessageId } from "@/state/optimistic-send";
import { visibleMessages } from "@/state/snapshot-navigation";
import { formatTranscriptMarkdown, type ExportTranscriptOptions } from "./export-transcript";

interface ConversationTranscriptOptions extends ExportTranscriptOptions {
  threadId: string;
  hasMore?: boolean;
  activeLeafId?: string | null;
}

async function loadFullThread(threadId: string): Promise<Message[]> {
  const pages: Message[][] = [];
  const cursors = new Set<string>();
  let before = "";
  for (;;) {
    const query = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
    if (before) query.set("before", before);
    const page = await api<{ messages: Message[]; hasMore?: boolean }>(
      `/api/threads/${encodeURIComponent(threadId)}/messages?${query}`,
    );
    pages.push(page.messages);
    if (!page.hasMore) return pages.reverse().flat();
    before = page.messages[0]?.id ?? "";
    if (!before || cursors.has(before)) throw new Error("Conversation history could not be loaded");
    cursors.add(before);
  }
}

/** An export reads the whole selected branch without filling the UI's bounded message cache. */
export function conversationTranscript({ threadId, hasMore, activeLeafId, ...options }: ConversationTranscriptOptions): string | Promise<string> {
  if (!hasMore) return formatTranscriptMarkdown(options);
  return loadFullThread(threadId).then((history) => {
    // Keep the clicked rows, including streamed text, while filling their earlier history.
    // A server-confirmed send replaces only its actual optimistic identity.
    const confirmed = new Map<string, string>();
    for (const message of history) {
      if (message.sendId && message.id !== optimisticMessageId(message.sendId)) confirmed.set(message.sendId, message.id);
    }
    const aliases = new Map<string, string>();
    for (const message of options.messages) {
      if (message.sendId && message.id === optimisticMessageId(message.sendId)) {
        const id = confirmed.get(message.sendId);
        if (id) aliases.set(message.id, id);
      }
    }
    const held = new Map(options.messages.filter((message) => !aliases.has(message.id)).map((message) => {
      const parentId = message.parentId ? aliases.get(message.parentId) : undefined;
      return [message.id, parentId ? { ...message, parentId } : message] as const;
    }));
    const loaded = new Set(history.map((message) => message.id));
    const messages = [...history.map((message) => held.get(message.id) ?? message),
      ...[...held.values()].filter((message) => !loaded.has(message.id))];
    const leaf = activeLeafId ? aliases.get(activeLeafId) ?? activeLeafId : activeLeafId;
    if (leaf && !messages.some((message) => message.id === leaf)) {
      throw new Error("The selected conversation branch is no longer available");
    }
    return formatTranscriptMarkdown({ ...options, messages: visibleMessages({ messages, activeLeafId: leaf }) });
  });
}
