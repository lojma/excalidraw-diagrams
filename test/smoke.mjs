#!/usr/bin/env node
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHtml, resolveStyle, expandSemantic } from "../skills/excalidraw-diagrams/render.mjs";
import { screenshot } from "../skills/excalidraw-diagrams/shot.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const template = readFileSync(here("../skills/excalidraw-diagrams/template.html"), "utf8");
const style = resolveStyle("clean", {});
const dir = mkdtempSync(join(tmpdir(), "excalidraw-smoke-"));

async function smoke(name, html) {
  const htmlPath = join(dir, `${name}.html`);
  const pngPath = join(dir, `${name}.png`);
  writeFileSync(htmlPath, html);
  const result = await screenshot({ htmlPath, outPng: pngPath });
  console.log(`smoke[${name}]:`, JSON.stringify(result), "->", pngPath);
  if (!result.ok) { console.error(`SMOKE FAILED (${name}): page did not render an Excalidraw canvas`); process.exit(1); }
}

// Mermaid path
await smoke("mermaid", buildHtml({
  template, title: "smoke", style,
  mermaid: readFileSync(here("./sample.mmd"), "utf8"),
}));

// Hand-authored JSON path
await smoke("json", buildHtml({
  template, title: "smoke-json", style,
  mode: "json", elements: JSON.parse(readFileSync(here("./sample.json"), "utf8")),
}));

// Semantic JSON path: role colors + frames + embedded SVG icons
{
  const { skeleton, images, files } = expandSemantic(
    JSON.parse(readFileSync(here("./sample-arch.json"), "utf8")), { color: true });
  await smoke("json-icons", buildHtml({
    template, title: "smoke-arch", style, mode: "json", elements: skeleton, images, files,
  }));
}

console.log("SMOKE OK");
