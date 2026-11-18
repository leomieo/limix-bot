import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { changedRows, previewOf, READ_LAST } from "./messenger-personal.mjs";

test("a row counts as new only when someone else's message changed its preview, not when its time ticks", () => {
  assert.equal(previewOf("Còn hàng không ạ · 5 phút"), "Còn hàng không ạ");
  assert.equal(previewOf("Ok · 2m"), "Ok");
  const before = new Map([["1", "Còn hàng không ạ"], ["2", "Bạn: dạ còn"]]);
  const rows = [
    { thread: "1", name: "Lan", preview: "Còn hàng không ạ · 6 phút" },
    { thread: "2", name: "Hoa", preview: "Giá bao nhiêu · 1 phút" },
    { thread: "3", name: "Minh", preview: "Chào shop · Vừa xong" },
    { thread: "4", name: "Tú", preview: "You: thanks · 1m" },
  ];
  assert.deepEqual(changedRows(before, rows).map((row) => row.thread), ["2", "3"]);
});

test("recognizes a file-only Messenger bubble and keeps its original name", () => {
  const link = {
    href: "https://cdn.fbsbx.com/attachment/list.csv",
    innerText: "list.csv",
    hasAttribute: (name) => name === "download",
    getAttribute: () => "",
    getBoundingClientRect: () => ({ left: 10, right: 180 }),
  };
  const row = { querySelectorAll: (selector) => selector === "a[href]" ? [link] : [] };
  const main = { getBoundingClientRect: () => ({ left: 0, width: 800 }), querySelectorAll: () => [row] };
  const document = { querySelector: () => main };
  const message = runInNewContext(READ_LAST, { document, URL });
  assert.equal(message.fileUrl, link.href);
  assert.equal(message.fileName, "list.csv");
  assert.equal(message.mine, false);
});
