#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const HERE = dirname(fileURLToPath(import.meta.url));

export const STYLE_PRESETS = {
  clean:    { strokeColor: "#343a40", backgroundColor: "#f8f9fa", arrowColor: "#495057", roundness: 3, strokeWidth: 1.5, fillStyle: "solid",   fontFamily: 1, viewBackgroundColor: "#ffffff", fontSize: 18 },
  sketchy:  { strokeColor: "#343a40", backgroundColor: "#fff9db", arrowColor: "#495057", roundness: 3, strokeWidth: 2,   fillStyle: "hachure", fontFamily: 1, viewBackgroundColor: "#ffffff", fontSize: 18 },
  colorful: { strokeColor: "#1862ab", backgroundColor: "#e7f5ff", arrowColor: "#5f3dc4", roundness: 3, strokeWidth: 1.5, fillStyle: "solid",   fontFamily: 1, viewBackgroundColor: "#ffffff", fontSize: 18 },
  mono:     { strokeColor: "#212529", backgroundColor: "#ffffff", arrowColor: "#212529", roundness: 0, strokeWidth: 1.5, fillStyle: "solid",   fontFamily: 3, viewBackgroundColor: "#ffffff", fontSize: 18 },
};

export function slugify(title) {
  const s = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "diagram";
}

export function resolveStyle(preset, override) {
  const base = STYLE_PRESETS[preset] || STYLE_PRESETS.clean;
  return { ...base, ...(override || {}) };
}

function inject(value) {
  // JSON-encode, then escape "<" so "</script>" cannot terminate the script tag.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildHtml({ template, title, mermaid, style }) {
  return template
    .replaceAll("__TITLE__", inject(title))
    .replaceAll("__MERMAID__", inject(mermaid))
    .replaceAll("__STYLE__", inject(style));
}

function parseArgs(argv) {
  const args = { _: [], open: true, serve: false, style: "clean" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-open") args.open = false;
    else if (a === "--serve") { args.serve = true; args.open = false; }
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--style") args.style = argv[++i];
    else if (a === "--style-json") args.styleJson = argv[++i];
    else if (a === "--port") args.port = Number(argv[++i]);
    else args._.push(a);
  }
  return args;
}

function openInBrowser(filePath) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(cmd, [filePath], { stdio: "ignore", detached: true, shell: process.platform === "win32" });
  child.unref();
}

function serve(filePath, port = 0) {
  const html = readFileSync(filePath);
  const server = createServer((_req, res) => { res.writeHead(200, { "Content-Type": "text/html" }); res.end(html); });
  server.listen(port, () => {
    const p = server.address().port;
    console.log(`Serving preview at http://localhost:${p}/  (Ctrl-C to stop)`);
  });
}

export async function main(argv) {
  const args = parseArgs(argv);
  const template = readFileSync(join(HERE, "template.html"), "utf8");

  let mermaid;
  if (args._[0]) mermaid = readFileSync(args._[0], "utf8");
  else mermaid = readFileSync(0, "utf8"); // stdin

  const title = args.title || "diagram";
  const override = args.styleJson ? JSON.parse(args.styleJson) : {};
  const style = resolveStyle(args.style, override);
  const html = buildHtml({ template, title, mermaid, style });

  const outDir = args.out ? dirname(args.out) : join(tmpdir(), "excalidraw-previews");
  mkdirSync(outDir, { recursive: true });
  const outPath = args.out || join(outDir, `${slugify(title)}.html`);
  writeFileSync(outPath, html);
  console.log(outPath);

  if (args.serve) serve(outPath, args.port);
  else if (args.open) openInBrowser(outPath);
}

// Run main() when invoked as a CLI. Resolve symlinks: when installed under
// ~/.claude/skills the script is reached via a symlink, so process.argv[1]
// (symlink path) must be realpath'd to match fileURLToPath(import.meta.url)
// (the real path ESM already resolved).
const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invokedPath) {
  main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
}
