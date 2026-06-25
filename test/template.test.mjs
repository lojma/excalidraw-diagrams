import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tpl = readFileSync(
  fileURLToPath(new URL("../skills/excalidraw-diagrams/template.html", import.meta.url)),
  "utf8"
);

test("template has the substitution tokens (mermaid + json modes)", () => {
  assert.ok(tpl.includes("__TITLE__"), "missing __TITLE__");
  assert.ok(tpl.includes("__MODE__"), "missing __MODE__");
  assert.ok(tpl.includes("__MERMAID__"), "missing __MERMAID__");
  assert.ok(tpl.includes("__ELEMENTS__"), "missing __ELEMENTS__");
  assert.ok(tpl.includes("__IMAGES__"), "missing __IMAGES__");
  assert.ok(tpl.includes("__FILES__"), "missing __FILES__");
  assert.ok(tpl.includes("__STYLE__"), "missing __STYLE__");
});

test("template wires embedded icon files into the scene", () => {
  assert.ok(tpl.includes("addFiles"), "json mode must register icon files");
});

test("template preloads the hand-drawn font before convert", () => {
  assert.ok(tpl.includes("document.fonts.load"), "missing font preload");
});

test("template pins the expected CDN versions", () => {
  assert.ok(tpl.includes("react@18.2.0"));
  assert.ok(tpl.includes("@excalidraw/excalidraw@0.17.6"));
  assert.ok(tpl.includes("@excalidraw/mermaid-to-excalidraw@1.1.2"));
});

test("template sets the success signal and has a save button", () => {
  assert.ok(tpl.includes('dataset.rendered = "true"'));
  assert.ok(tpl.includes('id="save"'));
});
