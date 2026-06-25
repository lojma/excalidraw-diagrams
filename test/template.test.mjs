import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tpl = readFileSync(
  fileURLToPath(new URL("../skills/excalidraw-diagrams/template.html", import.meta.url)),
  "utf8"
);

test("template has the three substitution tokens", () => {
  assert.ok(tpl.includes("__TITLE__"), "missing __TITLE__");
  assert.ok(tpl.includes("__MERMAID__"), "missing __MERMAID__");
  assert.ok(tpl.includes("__STYLE__"), "missing __STYLE__");
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
