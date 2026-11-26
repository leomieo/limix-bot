// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { SkillLibraryTabs } from "./SkillLibraryTabs";

it("opens the catalog first and preserves a local draft across mouse and keyboard navigation", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(SkillLibraryTabs, {
      catalog: "catalog", bundled: "bundled", tools: "tools", children: createElement("textarea"),
    })));
    const tabs = host.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const current = () => host.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden])');
    expect(current()).toHaveLength(1);
    expect(current()[0].textContent).toBe("catalog");
    flushSync(() => tabs[2].click());
    current()[0].querySelector("textarea")!.value = "draft";
    const key = (tab: HTMLButtonElement, key: string) => flushSync(() => {
      tab.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
    key(tabs[2], "End");
    expect(document.activeElement).toBe(tabs[3]);
    expect(current()[0].textContent).toBe("tools");
    key(tabs[3], "ArrowRight");
    expect(document.activeElement).toBe(tabs[0]);
    flushSync(() => tabs[1].click());
    expect(current()[0].textContent).toBe("bundled");
    flushSync(() => tabs[2].click());
    expect(current()[0].querySelector("textarea")!.value).toBe("draft");
    expect(current()[0].id).toBe(tabs[2].getAttribute("aria-controls"));
  } finally {
    flushSync(() => root.unmount());
    host.remove();
  }
});
