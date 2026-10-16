/**
 * Tests for launchGame.ts helpers (pure functions only — no Raycast API needed).
 * Run with: node --experimental-strip-types --test tests/launchGame.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { steamStoreUrl } from "../src/libraryModel.ts";

describe("steamStoreUrl", () => {
  it("generates correct Steam store URL", () => {
    assert.equal(steamStoreUrl("1086940"), "https://store.steampowered.com/app/1086940");
  });

  it("works for any appid string", () => {
    assert.equal(steamStoreUrl("730"), "https://store.steampowered.com/app/730");
  });
});
