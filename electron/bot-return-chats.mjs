const CHATS = "/api/cloud-send/chats";
const THREAD = /^[\w-]{1,200}$/u;
const ATTACHMENT = /^[A-Za-z0-9-]{1,80}\.[A-Za-z0-9]{1,10}$/u;

async function copyAttachments(cloud, local, names) {
  const checked = await local.call("POST", `${CHATS}/attachments`, { names });
  if (!checked.ok || !Array.isArray(checked.body?.missing)) throw new Error("This computer could not check the chat attachments.");
  for (const name of checked.body.missing) {
    if (!names.includes(name)) throw new Error("This computer returned an invalid attachment name.");
    const route = `${CHATS}/attachment/${name}`;
    const file = await cloud.fetch(route);
    if (!file.ok) {
      await file.body?.cancel();
      if (file.status === 404) continue;
      throw new Error("My Cloud could not download a chat attachment.");
    }
    if (!(await local.receiveAttachment(route, file)).ok) throw new Error("This computer could not save a chat attachment.");
  }
}

export async function copyReturnedChats(cloud, local, botId) {
  const listed = await cloud.call("GET", `${CHATS}?bot=${encodeURIComponent(botId)}`);
  const data = listed.body;
  if (!listed.ok || data?.v !== 1 || typeof data.dataDir !== "string" || !Array.isArray(data.conversations)) {
    throw new Error("My Cloud could not list this bot's conversations.");
  }
  const conversations = data.conversations.filter((head) => head?.bot === botId);
  if (conversations.some((head) => head.busy || !THREAD.test(head.threadId ?? "")
    || !Number.isSafeInteger(head.last) || head.last <= 0 || typeof head.lastId !== "string")) {
    throw new Error("My Cloud could not finish preparing this bot's conversations. Try again.");
  }
  for (const head of conversations) {
    const { threadId } = head;
    let after = 0, id = "";
    while (after < head.last) {
      const got = await cloud.call("GET", `${CHATS}/rows?thread=${threadId}&after=${after}&id=${encodeURIComponent(id)}`);
      const page = got.body;
      if (!got.ok || page?.v !== 1 || page.bot !== botId || page.threadId !== threadId || page.restarted
        || !Array.isArray(page.rows) || !page.rows.length || !Number.isSafeInteger(page.last) || page.last <= after
        || page.last > head.last || typeof page.lastId !== "string" || page.rows.at(-1)?.id !== page.lastId
        || (page.last === head.last ? page.more || page.lastId !== head.lastId : !page.more)) {
        throw new Error("My Cloud could not finish downloading a conversation. Try again.");
      }
      const names = [...new Set((page.attachments ?? []).filter((name) => typeof name === "string" && ATTACHMENT.test(name)))];
      for (let i = 0; i < names.length; i += 2000) await copyAttachments(cloud, local, names.slice(i, i + 2000));
      const task = page.task ?? { threadId, createdAt: page.rows[0].at };
      const added = await local.call("POST", CHATS, { v: 1, dataDir: data.dataDir,
        conversations: [{ bot: botId, threadId, task, rows: page.rows, leaf: page.leaf, sent: false }] });
      if (!added.ok || !added.body?.accepted?.includes(threadId)) {
        throw new Error("This computer could not add a conversation. Try again.");
      }
      after = page.last;
      id = page.lastId;
    }
  }
}
