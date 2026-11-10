// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

test("offline caching bounds concurrent requests as the repertoire grows", async () => {
  const handlers = new Map();
  let active = 0;
  let maximum = 0;
  let fetched = 0;
  let stored = 0;
  let result;
  runInNewContext(readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"), {
    self: { location: { origin: "https://example.org" }, addEventListener: (name, handler) => handlers.set(name, handler) },
    URL, Request,
    caches: { open: async () => ({ match: async () => null, put: async () => { stored += 1; } }) },
    fetch: async () => {
      active += 1;
      fetched += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setImmediate(resolve));
      active -= 1;
      return { ok: true, type: "basic" };
    },
  });
  let work;
  const urls = Array.from({ length: 100 }, (_, index) => `https://example.org/page-${index}/`);
  handlers.get("message")({ data: { type: "CACHE_URLS", urls: [...urls, urls[0], "https://remote.example/font.ttf"] }, ports: [{ postMessage: (message) => { result = message; } }], waitUntil: (promise) => { work = promise; } });
  await work;
  assert.equal(maximum, 8);
  assert.equal(fetched, 100);
  assert.equal(stored, 100);
  assert.equal(result.complete, true);
});
