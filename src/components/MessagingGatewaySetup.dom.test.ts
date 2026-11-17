import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { expect, it } from "vitest";
const page = readFileSync(new URL("../../limix/modules/messaging-gateway/src/web/ui.html", import.meta.url), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(page)![1];
it("keeps setup options folded and retains a link code across renders until ownership is verified", async () => {
  const win = new Window({ url: "http://127.0.0.1:8790/" });
  try {
    win.document.write(page.replace(/<script>[\s\S]*?<\/script>/, ""));
    win.fetch = (async (url: unknown) => new win.Response(JSON.stringify(String(url).endsWith("/link-code") ? { code: "TEST29" } : { connections: [], pairing: [], activity: [], bots: [] }))) as typeof win.fetch;
    win.eval(script + '\nwindow.setupFixture = { setOwners: (owners) => { S.connections = [{ id: "fixture", ownerIds: owners }]; }, prepareLinkCode, markup: () => linkCodeMarkup(conn("fixture")) };');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(win.document.querySelectorAll("#addForm details:not([open])").length).toBe(2);
    const setup = (win as unknown as { setupFixture: { setOwners: (owners: string[]) => void; prepareLinkCode: (id: string) => Promise<void>; markup: () => string } }).setupFixture;
    setup.setOwners([]);
    await setup.prepareLinkCode("fixture");
    expect(setup.markup()).toContain("/link TEST29");
    expect(setup.markup()).toContain("/link TEST29");
    setup.setOwners(["owner"]);
    expect(setup.markup()).toBe("");
  } finally { await win.happyDOM.close(); }
});
