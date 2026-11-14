import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import { afterEach, expect, it, vi } from "vitest";

const page = readFileSync(new URL("../../limix/gateway/src/web/ui.html", import.meta.url), "utf8");
const script = /<script>([\s\S]*?)<\/script>/.exec(page)![1];
const windows: Window[] = [];
afterEach(async () => {
  await Promise.all(windows.splice(0).map((win) => win.happyDOM.close()));
});

async function fixture(write?: (text: string) => Promise<void>, legacy?: () => boolean, pending?: (expire: () => void) => void) {
  const win = new Window({ url: "http://127.0.0.1:8790/" });
  windows.push(win);
  win.document.write(page.replace(/<script>[\s\S]*?<\/script>/, ""));
  Object.defineProperty(win.navigator, "clipboard", { configurable: true, value: write ? { writeText: write } : undefined });
  Object.defineProperty(win.document, "execCommand", { configurable: true, value: legacy });
  if (pending) {
    const setTimer = win.setTimeout.bind(win);
    win.setTimeout = ((callback: () => void, ms: number) => {
      if (ms === 3000) { pending(callback); return 0; }
      return setTimer(callback, ms);
    }) as typeof win.setTimeout;
  }
  win.fetch = vi.fn(async () => new win.Response(JSON.stringify({ connections: [], pairing: [], activity: [], bots: [] }))) as typeof win.fetch;
  win.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const main = win.document.querySelector("#main")!;
  main.innerHTML = '<div class="code"><span>/link TEST29</span><button data-act="copy" data-text="/link TEST29">Copy</button></div>';
  const button = main.querySelector("button")!;
  return { win, button, toast: () => win.document.querySelector("#toast")!.textContent };
}

async function click(button: { click(): void; disabled: boolean }) {
  button.click();
  for (let i = 0; i < 20 && button.disabled; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  expect(button.disabled).toBe(false);
}

it("waits for the clipboard before reporting success and copies the full command", async () => {
  let finish!: () => void;
  const write = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  const { button, toast } = await fixture(write);
  button.click();
  expect(write).toHaveBeenCalledWith("/link TEST29");
  expect(toast()).not.toBe("Đã sao chép.");
  expect(button.disabled).toBe(true);
  finish();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(toast()).toBe("Đã sao chép.");
  expect(button.disabled).toBe(false);
});

it.each(["denied", "absent"])("uses the selected-text fallback when web clipboard is %s", async (mode) => {
  let copied = "";
  const legacy = vi.fn(() => {
    copied = String(win.document.querySelector("textarea")?.value);
    return true;
  });
  const { win, button, toast } = await fixture(mode === "denied" ? () => Promise.reject(new Error("NotAllowedError")) : undefined, legacy);
  await click(button);
  expect(copied).toBe("/link TEST29");
  expect(toast()).toBe("Đã sao chép.");
  expect(win.document.querySelector("textarea")).toBeNull();
});

it("reports failure and selects the visible code if both copy methods fail", async () => {
  const { win, button, toast } = await fixture(() => Promise.reject(new Error("NotAllowedError")), () => false);
  await click(button);
  expect(toast()).toContain("Không thể sao chép tự động");
  expect(toast()).not.toBe("Đã sao chép.");
  expect(win.getSelection()?.toString()).toBe("/link TEST29");
  expect(win.document.querySelector("textarea")).toBeNull();
});

it("recovers from a clipboard request that never settles and permits retry", async () => {
  let expire!: () => void;
  const { button, toast } = await fixture(() => new Promise(() => {}), () => false, (callback) => { expire = callback; });
  button.click();
  expect(button.disabled).toBe(true);
  expire();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(button.disabled).toBe(false);
  expect(toast()).toContain("Không thể sao chép tự động");
});
