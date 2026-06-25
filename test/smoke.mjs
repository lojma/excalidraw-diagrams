#!/usr/bin/env node
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHtml, resolveStyle } from "../skills/excalidraw-diagrams/render.mjs";
import { screenshot } from "../skills/excalidraw-diagrams/shot.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const template = readFileSync(here("../skills/excalidraw-diagrams/template.html"), "utf8");
const mermaid = readFileSync(here("./sample.mmd"), "utf8");
const html = buildHtml({ template, title: "smoke", mermaid, style: resolveStyle("clean", {}) });

const dir = mkdtempSync(join(tmpdir(), "excalidraw-smoke-"));
const htmlPath = join(dir, "smoke.html");
const pngPath = join(dir, "smoke.png");
writeFileSync(htmlPath, html);

const result = await screenshot({ htmlPath, outPng: pngPath });
console.log("smoke result:", JSON.stringify(result), "->", pngPath);
if (!result.ok) { console.error("SMOKE FAILED: page did not render an Excalidraw canvas"); process.exit(1); }
console.log("SMOKE OK");
