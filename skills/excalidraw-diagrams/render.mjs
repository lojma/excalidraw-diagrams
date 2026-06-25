#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync, realpathSync, existsSync } from "node:fs";
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

// Semantic palette for architecture maps. `role` on a node picks fill/stroke;
// `role` on a frame picks a lighter panel tint + a title color.
export const NODE_COLORS = {
  client:   { backgroundColor: "#e5dbff", strokeColor: "#7048e8" },
  service:  { backgroundColor: "#d0ebff", strokeColor: "#1c7ed6" },
  data:     { backgroundColor: "#d3f9d8", strokeColor: "#2f9e44" },
  external: { backgroundColor: "#ffe8cc", strokeColor: "#e8590c" },
  accent:   { backgroundColor: "#ffec99", strokeColor: "#f08c00" },
};
const FRAME_COLORS = {
  client:   { backgroundColor: "#f3f0ff", strokeColor: "#b197fc", title: "#7048e8" },
  service:  { backgroundColor: "#eef6ff", strokeColor: "#74c0fc", title: "#1c7ed6" },
  data:     { backgroundColor: "#ebfbee", strokeColor: "#8ce99a", title: "#2f9e44" },
  external: { backgroundColor: "#fff4e6", strokeColor: "#ffc078", title: "#e8590c" },
  neutral:  { backgroundColor: "#f8f9fa", strokeColor: "#ced4da", title: "#868e96" },
};
const ICONS_DIR = join(HERE, "icons");

let _manifest = null;
function iconManifest() {
  if (_manifest) return _manifest;
  try { _manifest = JSON.parse(readFileSync(join(ICONS_DIR, "manifest.json"), "utf8")); }
  catch { _manifest = {}; }
  return _manifest;
}

function loadIconDataURL(name) {
  const key = String(name).replace(/[^a-z0-9_+-]/gi, "").toLowerCase();
  const entry = iconManifest()[key];
  const file = join(ICONS_DIR, entry ? entry.file : `${key}.svg`);
  if (!existsSync(file)) return null;
  return `data:image/svg+xml;base64,${readFileSync(file).toString("base64")}`;
}

function imageElement(id, x, y, size, fileId) {
  // A complete Excalidraw image element; restore() fills any remaining defaults.
  return { type: "image", id, x, y, width: size, height: size, angle: 0, fileId, status: "saved",
    scale: [1, 1], strokeColor: "transparent", backgroundColor: "transparent", fillStyle: "solid",
    strokeWidth: 1, strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], frameId: null,
    roundness: null, seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: null,
    updated: 1, link: null, locked: false };
}

// Expand author-friendly `role`/`frame`/`icon` fields into plain skeleton elements,
// raw image elements, and an Excalidraw `files` map. Pure + exported for testing.
export function expandSemantic(elements, { color = true } = {}) {
  const skeleton = [], images = [], files = {};
  let n = 0;
  const frameRole = (r) => (r === "backend" ? "service" : r || "neutral");
  for (const el of elements || []) {
    if (el && el.frame) {
      const c = FRAME_COLORS[frameRole(el.role)] || FRAME_COLORS.neutral;
      const { frame, role, label, ...rest } = el;
      skeleton.push({ type: "rectangle", ...rest,
        backgroundColor: rest.backgroundColor ?? (color ? c.backgroundColor : "#f8f9fa"),
        strokeColor: rest.strokeColor ?? (color ? c.strokeColor : "#ced4da"),
        roundness: rest.roundness ?? { type: 3 } });
      if (label) skeleton.push({ type: "text", x: (el.x ?? 0) + 16, y: (el.y ?? 0) + 12,
        text: String(label), fontSize: 16, strokeColor: color ? c.title : "#868e96" });
      continue;
    }
    const { role, icon, ...node } = el || {};
    if (color && role && NODE_COLORS[role]) {
      node.backgroundColor = node.backgroundColor ?? NODE_COLORS[role].backgroundColor;
      node.strokeColor = node.strokeColor ?? NODE_COLORS[role].strokeColor;
    }
    if (icon) {
      const dataURL = loadIconDataURL(icon);
      if (!dataURL) console.error(`warning: unknown icon "${icon}" — skipping`);
      else {
        const fileId = `icon-${icon}`;
        if (!files[fileId]) files[fileId] = { mimeType: "image/svg+xml", id: fileId, dataURL, created: 1 };
        // Ensure the node is wide enough that the centered label clears the left icon.
        const label = node.label && node.label.text;
        if (label) {
          const need = label.length * 11 + 92;
          if (!node.width || node.width < need) node.width = need;
        }
        const h = node.height ?? 56, size = 26;
        images.push(imageElement(`img-${n++}`, (node.x ?? 0) + 12, (node.y ?? 0) + h / 2 - size / 2, size, fileId));
      }
    }
    skeleton.push(node);
  }
  return { skeleton, images, files };
}

function inject(value) {
  // JSON-encode, then escape "<" so "</script>" cannot terminate the script tag.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildHtml({ template, title, mermaid, style, mode = "mermaid", elements = [], images = [], files = {} }) {
  return template
    .replaceAll("__TITLE__", inject(title))
    .replaceAll("__MODE__", inject(mode))
    .replaceAll("__MERMAID__", inject(mermaid || ""))
    .replaceAll("__ELEMENTS__", inject(elements))
    .replaceAll("__IMAGES__", inject(images))
    .replaceAll("__FILES__", inject(files))
    .replaceAll("__STYLE__", inject(style));
}

function parseArgs(argv) {
  const args = { _: [], open: true, serve: false, style: "clean" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-open") args.open = false;
    else if (a === "--serve") { args.serve = true; args.open = false; }
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--from-json") args.fromJson = argv[++i];
    else if (a === "--from-excalidraw") args.fromExcalidraw = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--style") args.style = argv[++i];
    else if (a === "--no-color") args.noColor = true;
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

  let mode = "mermaid", mermaid = "", elements = [], images = [], files = {};
  if (args.fromExcalidraw) {
    // Round-trip: a saved .excalidraw scene (full elements + files) — load as-is so
    // the user's manual edits are preserved, then improve/re-render.
    mode = "scene";
    const scene = JSON.parse(readFileSync(args.fromExcalidraw, "utf8"));
    elements = scene.elements || [];
    files = scene.files || {};
  } else if (args.fromJson) {
    // Hand-authored architecture maps: an Excalidraw skeleton-element array, with
    // author-friendly role/frame/icon fields expanded into colors + embedded icons.
    mode = "json";
    const raw = JSON.parse(readFileSync(args.fromJson, "utf8"));
    const color = !args.noColor && args.style !== "mono";
    ({ skeleton: elements, images, files } = expandSemantic(raw, { color }));
  } else if (args._[0]) {
    mermaid = readFileSync(args._[0], "utf8");
  } else {
    mermaid = readFileSync(0, "utf8"); // stdin
  }

  const title = args.title || "diagram";
  const override = args.styleJson ? JSON.parse(args.styleJson) : {};
  const style = resolveStyle(args.style, override);
  const html = buildHtml({ template, title, mermaid, style, mode, elements, images, files });

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
