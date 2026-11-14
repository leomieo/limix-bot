import assert from "node:assert/strict";
import test from "node:test";
import { configureGatewayPermissions } from "./limix-gateway.mjs";

const URL_ = "http://127.0.0.1:8790/";

function fixture() {
  let check, request;
  const contents = {
    getURL: () => URL_,
    session: {
      setPermissionCheckHandler: (handler) => { check = handler; },
      setPermissionRequestHandler: (handler) => { request = handler; },
    },
  };
  configureGatewayPermissions(contents, URL_);
  return { contents, check, request };
}

test("gateway grants only clipboard writes from its own main frame", () => {
  const { contents, check, request } = fixture();
  const details = { isMainFrame: true, requestingUrl: URL_ };
  assert.equal(check(contents, "clipboard-sanitized-write", URL_, details), true);
  let granted;
  request(contents, "clipboard-sanitized-write", (value) => { granted = value; }, details);
  assert.equal(granted, true);
  for (const permission of ["clipboard-read", "deprecated-sync-clipboard-read", "media", "notifications", "geolocation", "unknown"]) {
    assert.equal(check(contents, permission, URL_, details), false);
    request(contents, permission, (value) => { granted = value; }, details);
    assert.equal(granted, false);
  }
});

test("gateway refuses other windows, origins, frames and navigation away", () => {
  const { contents, check, request } = fixture();
  for (const url of ["http://127.0.0.1:8791/", "http://127.0.0.1:8790.evil.example/", "https://example.com/", "about:blank", "", undefined]) {
    const details = { isMainFrame: true, requestingUrl: url };
    assert.equal(check(contents, "clipboard-sanitized-write", url, details), false);
    request(contents, "clipboard-sanitized-write", (value) => assert.equal(value, false), details);
  }
  for (const details of [{}, { isMainFrame: false }]) {
    assert.equal(check(contents, "clipboard-sanitized-write", URL_, details), false);
  }
  assert.equal(check({}, "clipboard-sanitized-write", URL_, { isMainFrame: true }), false);
  contents.getURL = () => "https://example.com/";
  assert.equal(check(contents, "clipboard-sanitized-write", URL_, { isMainFrame: true }), false);
});
