import assert from "node:assert/strict";
import { test } from "node:test";

import { calledIn, stripCall } from "../src/router.mjs";

const conn = { name: "Limix", botIdentity: { username: "bot.yFJwJTIR", name: "Limix" } };

test("a group message calls the bot by @name or @username", () => {
  assert.equal(calledIn(conn, "@Limix giá bao nhiêu?"), true);
  assert.equal(calledIn(conn, "hỏi @bot.yfjwjtir cái này"), true);
  assert.equal(calledIn(conn, "mọi người ơi"), false);
  assert.equal(stripCall(conn, "@Limix  giá bao nhiêu?"), "giá bao nhiêu?");
});
