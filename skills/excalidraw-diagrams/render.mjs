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

// ---- Declarative tier-grid auto-layout ---------------------------------------
// Turn a coordinate-free { tiers, sideGroups, edges } spec into the same skeleton
// array the manual JSON path uses (frames + role/icon nodes + arrows). Built-in
// rules place everything; the author overrides only what they want.
function nodeWidth(node) {
  const text = (node.label || node.id || "").length;
  return Math.max(node.width || 0, 120, text * 11 + (node.icon ? 92 : 40));
}

function nodeHeight(node) { return node.height || (node.shape === "ellipse" ? 96 : 56); }

export function layoutTiers(spec) {
  const G = { x0: 60, y0: 40, nodeGap: 40, tierGap: 60, sideGap: 90,
    padX: 30, titleBand: 44, padBottom: 24, ...(spec.layoutOptions || {}) };
  const box = {}, sideIds = new Set();
  const frames = [], nodes = [], edges = [];

  function place(node, group, x, ny, w, h) {
    const px = node.pin?.x ?? x, py = node.pin?.y ?? ny;
    nodes.push({ type: node.shape || "rectangle", role: node.role || group.role, icon: node.icon,
      x: px, y: py, width: w, height: h, label: { text: node.label || node.id } });
    box[node.id] = { x: px, y: py, w, h, cx: px + w / 2, cy: py + h / 2 };
  }

  // Measure each tier: nodes sized to their OWN text (a `columns` tier uses a uniform
  // cell so the grid lines up). rowWidth drives a content-fit frame.
  const tiers = (spec.tiers || []).map((t) => {
    const sizes = t.nodes.map((n) => ({ w: nodeWidth(n), h: nodeHeight(n) }));
    const grid = t.columns && t.nodes.length > t.columns;
    if (grid) {
      const cw = Math.max(...sizes.map((s) => s.w)), ch = Math.max(...sizes.map((s) => s.h));
      const cols = Math.min(t.columns, t.nodes.length), rows = Math.ceil(t.nodes.length / cols);
      return { t, grid, cols, cw, ch, rowWidth: cols * cw + (cols - 1) * G.nodeGap, blockH: rows * ch + (rows - 1) * G.nodeGap };
    }
    const rowWidth = sizes.reduce((s, z) => s + z.w, 0) + (sizes.length - 1) * G.nodeGap;
    return { t, grid, sizes, rowWidth, blockH: Math.max(...sizes.map((s) => s.h)) };
  });
  const maxFrameW = Math.max(160, ...tiers.map((T) => T.rowWidth)) + 2 * G.padX;
  const centerX = G.x0 + maxFrameW / 2;   // all main frames centered on this axis

  let y = G.y0;
  for (const T of tiers) {
    const frameW = T.rowWidth + 2 * G.padX, frameX = centerX - frameW / 2;
    const frameH = G.titleBand + T.blockH + G.padBottom;
    frames.push({ frame: true, role: T.t.role, label: T.t.label, x: frameX, y, width: frameW, height: frameH });
    const top = y + G.titleBand;
    if (T.grid) {
      T.t.nodes.forEach((node, i) => {
        const r = Math.floor(i / T.cols), c = i % T.cols;
        const inRow = Math.min(T.cols, T.t.nodes.length - r * T.cols);
        const rw = inRow * T.cw + (inRow - 1) * G.nodeGap;
        place(node, T.t, centerX - rw / 2 + c * (T.cw + G.nodeGap), top + r * (T.ch + G.nodeGap), T.cw, T.ch);
      });
    } else {
      let nx = frameX + G.padX;
      T.t.nodes.forEach((node, i) => {
        const { w, h } = T.sizes[i];
        place(node, T.t, nx, top + (T.blockH - h) / 2, w, h);
        nx += w + G.nodeGap;
      });
    }
    y += frameH + G.tierGap;
  }
  const stackRight = centerX + maxFrameW / 2;

  // side groups: column-stacked, to the right of the main stack
  let sx = stackRight + G.sideGap, sy = G.y0;
  for (const grp of spec.sideGroups || []) {
    const sizes = grp.nodes.map((n) => ({ w: nodeWidth(n), h: nodeHeight(n) }));
    const cw = Math.max(...sizes.map((s) => s.w));
    const frameH = G.titleBand + sizes.reduce((s, z) => s + z.h, 0) + (sizes.length - 1) * G.nodeGap + G.padBottom;
    frames.push({ frame: true, role: grp.role, label: grp.label, x: sx, y: sy, width: cw + 2 * G.padX, height: frameH });
    let ny = sy + G.titleBand;
    grp.nodes.forEach((node, i) => { place(node, grp, sx + G.padX, ny, cw, sizes[i].h); sideIds.add(node.id); ny += sizes[i].h + G.nodeGap; });
    sy += frameH + G.tierGap;
  }

  const emitArrow = (absPts, label) => {
    const [x, y] = absPts[0];
    const pts = absPts.map(([px, py]) => [px - x, py - y]);
    const last = pts[pts.length - 1];
    const arr = { type: "arrow", x, y, width: last[0], height: last[1], points: pts, endArrowhead: "arrow" };
    if (label) arr.label = { text: label, fontSize: 13 };
    edges.push(arr);
  };
  const busX = stackRight + G.sideGap / 2;   // empty corridor between stack and side groups
  for (const e of spec.edges || []) {
    const a = box[e.from], b = box[e.to];
    if (!a || !b) { console.error(`warning: edge ${e.from}->${e.to} references an unknown node`); continue; }
    if (sideIds.has(e.to)) {
      // To a side group: drop into the gap below the source, run out to the corridor,
      // then up/down to the target — never slicing across tiers or same-row neighbors.
      const gapY = a.y + a.h + G.tierGap / 2;
      emitArrow([[a.cx, a.y + a.h + 4], [a.cx, gapY], [busX, gapY], [busX, b.cy], [b.x - 6, b.cy]], e.label);
    } else if (sideIds.has(e.from)) {
      const gapY = b.y - G.tierGap / 2;
      emitArrow([[a.x - 4, a.cy], [busX, a.cy], [busX, gapY], [b.cx, gapY], [b.cx, b.y - 6]], e.label);
    } else if (b.cy > a.cy + 10) emitArrow([[a.cx, a.y + a.h + 4], [b.cx, b.y - 6]], e.label);
    else if (b.cy < a.cy - 10) emitArrow([[a.cx, a.y - 4], [b.cx, b.y + b.h + 6]], e.label);
    else if (b.cx > a.cx) emitArrow([[a.x + a.w + 4, a.cy], [b.x - 6, b.cy]], e.label);
    else emitArrow([[a.x - 4, a.cy], [b.x + b.w + 6, b.cy]], e.label);
  }

  return [...frames, ...nodes, ...edges];
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
    // An array is a manual skeleton; an object with `tiers` is a declarative
    // auto-layout spec that we place first, then expand.
    const skeleton = Array.isArray(raw) ? raw : layoutTiers(raw);
    if (!Array.isArray(raw) && raw.title && !args.title) args.title = raw.title;
    const color = !args.noColor && args.style !== "mono";
    ({ skeleton: elements, images, files } = expandSemantic(skeleton, { color }));
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
  // Default to a unique filename so each re-render opens a fresh browser tab
  // (reopening the same file:// path just refocuses the stale tab). Pass --out to
  // pin a path (e.g. for the screenshot gate).
  const outPath = args.out || join(outDir, `${slugify(title)}-${Date.now().toString(36)}.html`);
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
