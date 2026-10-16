/**
 * Tests for libraryDb.ts path resolution (pure functions only).
 * Run with: node --experimental-strip-types --test tests/libraryDb.test.mjs
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";

// Import the pure resolver — no @raycast/api dependency
import { resolveDbPath, windowsDbCandidates } from "../src/libraryDb.ts";

describe("resolveDbPath", () => {
  it("returns the custom path when explicitly provided", () => {
    const custom = "C:\\custom\\path\\achieveme.db";
    assert.equal(resolveDbPath(custom), custom);
  });

  it("ignores blank custom path and falls back to auto-detect", () => {
    const result = resolveDbPath("   ");
    assert.ok(result.endsWith("achieveme.db"), "should end with achieveme.db");
  });

  it("always returns an absolute path", () => {
    assert.ok(path.isAbsolute(resolveDbPath()), "DB path must be absolute");
  });

  it("contains 'achieveme' in the path", () => {
    assert.ok(resolveDbPath().includes("achieveme"), "path should include 'achieveme'");
  });
});

describe("windowsDbCandidates", () => {
  let savedAppdata;
  let savedLocalAppdata;

  beforeEach(() => {
    savedAppdata = process.env.APPDATA;
    savedLocalAppdata = process.env.LOCALAPPDATA;
  });

  afterEach(() => {
    if (savedAppdata === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = savedAppdata;

    if (savedLocalAppdata === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = savedLocalAppdata;
  });

  it("includes APPDATA-based path when env var is set", () => {
    process.env.APPDATA = "C:\\Users\\Test\\AppData\\Roaming";
    const candidates = windowsDbCandidates();
    assert.ok(
      candidates.some((c) => c.startsWith("C:\\Users\\Test\\AppData\\Roaming")),
      "should include APPDATA-based path"
    );
  });

  it("always includes a homedir-based fallback", () => {
    delete process.env.APPDATA;
    const candidates = windowsDbCandidates();
    const home = os.homedir();
    assert.ok(
      candidates.some((c) => c.startsWith(home)),
      "should include homedir-based fallback"
    );
  });

  it("returns only absolute paths", () => {
    const candidates = windowsDbCandidates();
    for (const c of candidates) {
      assert.ok(path.isAbsolute(c), `candidate must be absolute: ${c}`);
    }
  });

  it("returns no duplicates", () => {
    process.env.APPDATA = "C:\\Users\\Test\\AppData\\Roaming";
    const candidates = windowsDbCandidates();
    const unique = new Set(candidates);
    assert.equal(candidates.length, unique.size, "no duplicate paths");
  });

  it("all candidates end with achieveme.db", () => {
    const candidates = windowsDbCandidates();
    for (const c of candidates) {
      assert.ok(c.endsWith("achieveme.db"), `each candidate should end with achieveme.db: ${c}`);
    }
  });
});
