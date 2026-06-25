import { test } from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../skills/excalidraw-diagrams/shot.mjs";

test("findChrome honors CHROME_BIN env override", () => {
  const prev = process.env.CHROME_BIN;
  process.env.CHROME_BIN = "/custom/path/to/chrome";
  try {
    assert.equal(findChrome(), "/custom/path/to/chrome");
  } finally {
    if (prev === undefined) delete process.env.CHROME_BIN; else process.env.CHROME_BIN = prev;
  }
});

test("findChrome returns a non-empty string or throws clearly", () => {
  const prev = process.env.CHROME_BIN;
  delete process.env.CHROME_BIN;
  try {
    const p = findChrome();
    assert.equal(typeof p, "string");
    assert.ok(p.length > 0);
  } catch (e) {
    assert.match(e.message, /chrome/i);
  } finally {
    if (prev !== undefined) process.env.CHROME_BIN = prev;
  }
});
