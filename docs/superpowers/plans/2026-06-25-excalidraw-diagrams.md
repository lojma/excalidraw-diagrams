# excalidraw-diagrams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code / Codex skill (packaged as a git-repo plugin) that turns a described flow/sequence/architecture into a live, editable Excalidraw diagram rendered in the browser, with automatic layout, style presets, and a render self-review gate.

**Architecture:** Claude authors **Mermaid**; a zero-dependency Node script (`render.mjs`) injects it into a self-contained `template.html` that loads React + Excalidraw (UMD, pinned CDN) and `@excalidraw/mermaid-to-excalidraw` (ESM), runs a post-process **style pass**, and renders an editable canvas. `shot.mjs` headless-screenshots a rendered page for the self-review gate and CI. No build step, no npm install.

**Tech Stack:** Node 22+ (built-in test runner, no deps), HTML/ESM, headless Google Chrome, GitHub Actions. Pinned CDN: `react@18.2.0`, `@excalidraw/excalidraw@0.17.6`, `@excalidraw/mermaid-to-excalidraw@1.1.2`.

**Reference material:** A verified proof-of-concept exists at `~/excalidraw-poc/preview.html` (plain) and `~/excalidraw-poc/preview-styled.html` (style pass). The spec is at `~/excalidraw-diagrams/docs/specs/2026-06-22-excalidraw-diagrams-design.md`. Build directory is `~/excalidraw-diagrams/` (the user will `git init` and push it).

**Conventions:**
- All paths below are relative to the build root `~/excalidraw-diagrams/`.
- Run Node test files with `node --test`.
- A Chrome binary path is needed for `shot.mjs`. Locally on macOS it is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Override with env `CHROME_BIN`.

---

### Task 1: Repository scaffolding

**Files:**
- Create: `.gitignore`
- Create: `.claude-plugin/plugin.json`
- Create: `LICENSE`
- Create: `README.md`

- [ ] **Step 1: Create directory structure**

Run:
```bash
cd ~/excalidraw-diagrams
mkdir -p .claude-plugin skills/excalidraw-diagrams/references test .github/workflows
```

- [ ] **Step 2: Write `.gitignore`**

```gitignore
node_modules/
*.png
*.log
.DS_Store
/tmp-preview/
```

- [ ] **Step 3: Write `.claude-plugin/plugin.json`**

```json
{
  "name": "excalidraw-diagrams",
  "version": "0.1.0",
  "description": "Render flows, sequences, and architecture as live, editable Excalidraw diagrams in the browser. Mermaid-authored, auto-laid-out, no build step.",
  "keywords": ["excalidraw", "diagram", "flowchart", "sequence", "architecture", "mermaid"]
}
```

- [ ] **Step 4: Write `LICENSE`** (MIT; replace `<YEAR> <AUTHOR>`)

```text
MIT License

Copyright (c) 2026 <AUTHOR>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Write `README.md` (stub — finalized in Task 9)**

```markdown
# excalidraw-diagrams

A skill that renders flows, sequences, and architecture diagrams as live,
editable Excalidraw canvases in your browser. Claude writes Mermaid; the diagram
is laid out automatically (no arrows-over-blocks) and opened for you. No build
step, no install — everything loads from a pinned CDN.

## Requirements
- Node 22+
- A Chromium-based browser (Google Chrome) for the optional render self-review.

## Layout
- `skills/excalidraw-diagrams/` — the skill (SKILL.md + scripts + template)
- `test/` — smoke test used by CI
- `.github/workflows/ci.yml` — headless render smoke test

(Usage details added in Task 9.)
```

- [ ] **Step 6: Commit**

```bash
cd ~/excalidraw-diagrams
git init 2>/dev/null; git add .
git commit -m "chore: scaffold excalidraw-diagrams plugin repo"
```

> NOTE: The spec says the user creates the repo. `git init` here is only to enable the frequent-commit workflow during implementation; it does not add a remote. If the user already initialized the repo, `git init` is a harmless no-op.

---

### Task 2: `template.html` — the self-contained preview

**Files:**
- Create: `skills/excalidraw-diagrams/template.html`
- Test: `test/template.test.mjs`

The template is static HTML with three substitution tokens (`__TITLE__`,
`__MERMAID__`, `__STYLE__`) that `render.mjs` replaces with JSON-encoded values.

- [ ] **Step 1: Write the failing test**

`test/template.test.mjs`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/excalidraw-diagrams && node --test test/template.test.mjs`
Expected: FAIL — cannot read `template.html` (file does not exist).

- [ ] **Step 3: Write `skills/excalidraw-diagrams/template.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>__TITLE__</title>
<link rel="stylesheet" href="https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/styles.css" />
<style>
  html, body, #app { height: 100%; margin: 0; }
  #err { position: fixed; top: 0; left: 0; font: 12px monospace; color: #c00; white-space: pre-wrap; z-index: 9999; }
  #save { position: fixed; top: 10px; right: 12px; z-index: 10000; font: 13px sans-serif;
          padding: 6px 12px; border: 1px solid #ced4da; border-radius: 6px; background: #fff; cursor: pointer; }
</style>
<script>window.EXCALIDRAW_ASSET_PATH = "https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/";</script>
<script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw.production.min.js"></script>
</head>
<body>
<button id="save">💾 Save .excalidraw</button>
<div id="app"></div>
<pre id="err"></pre>
<script type="module">
  const TITLE = __TITLE__;
  const MERMAID = __MERMAID__;
  const STYLE = __STYLE__;

  const fail = (m) => { document.getElementById("err").textContent += m + "\n"; };
  window.addEventListener("error", (e) => fail("ERROR: " + (e.message || e)));
  window.addEventListener("unhandledrejection", (e) => fail("REJECTION: " + ((e.reason && e.reason.message) || e.reason)));

  function applyStyle(els, s) {
    for (const el of els) {
      if (["rectangle", "diamond", "ellipse"].includes(el.type)) {
        el.roundness = el.roundness ?? (s.roundness != null ? { type: s.roundness } : { type: 3 });
        el.fillStyle = s.fillStyle ?? "solid";
        el.strokeWidth = s.strokeWidth ?? 1.5;
        if (!el.backgroundColor || el.backgroundColor === "transparent") {
          el.backgroundColor = s.backgroundColor ?? "#f8f9fa";
          el.strokeColor = s.strokeColor ?? "#343a40";
        }
      }
      if (el.type === "text" && s.fontFamily) el.fontFamily = s.fontFamily;
      if (el.type === "arrow") {
        el.strokeColor = s.arrowColor ?? s.strokeColor ?? "#495057";
        el.strokeWidth = s.strokeWidth ?? 1.5;
      }
    }
  }

  try {
    const { parseMermaidToExcalidraw } = await import("https://esm.sh/@excalidraw/mermaid-to-excalidraw@1.1.2");
    const Ex = window.ExcalidrawLib;
    const { elements, files } = await parseMermaidToExcalidraw(MERMAID, { fontSize: STYLE.fontSize ?? 18 });
    const els = Ex.convertToExcalidrawElements(elements);
    applyStyle(els, STYLE);

    let api = null;
    const App = () => window.React.createElement(Ex.Excalidraw, {
      initialData: {
        elements: els,
        files,
        appState: { viewBackgroundColor: STYLE.viewBackgroundColor ?? "#ffffff" },
        scrollToContent: true,
      },
      excalidrawAPI: (a) => { api = a; },
    });
    window.ReactDOM.createRoot(document.getElementById("app")).render(window.React.createElement(App));

    document.getElementById("save").addEventListener("click", () => {
      if (!api) return;
      const json = Ex.serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), "local");
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (TITLE || "diagram").replace(/[^a-z0-9-_]+/gi, "-") + ".excalidraw";
      a.click();
    });

    document.body.dataset.rendered = "true";
  } catch (e) {
    fail("CATCH: " + ((e && e.stack) || e));
  }
</script>
</body>
</html>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/excalidraw-diagrams && node --test test/template.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/excalidraw-diagrams/template.html test/template.test.mjs
git commit -m "feat: add self-contained excalidraw preview template"
```

---

### Task 3: `render.mjs` — Mermaid → HTML, presets, CLI

**Files:**
- Create: `skills/excalidraw-diagrams/render.mjs`
- Test: `test/render.test.mjs`

`render.mjs` exports pure functions (unit-tested here) and a CLI `main()`
(verified end-to-end in Task 5). The injection helper JSON-encodes values AND
escapes `<` so `</script>` inside Mermaid cannot break out of the script tag.

- [ ] **Step 1: Write the failing test**

`test/render.test.mjs`:
```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, STYLE_PRESETS, resolveStyle, buildHtml } from "../skills/excalidraw-diagrams/render.mjs";

test("slugify lowercases and dashes non-alphanumerics", () => {
  assert.equal(slugify("Auth Flow!"), "auth-flow");
  assert.equal(slugify("  A/B  test "), "a-b-test");
  assert.equal(slugify(""), "diagram");
});

test("named presets exist", () => {
  for (const name of ["clean", "sketchy", "colorful", "mono"]) {
    assert.ok(STYLE_PRESETS[name], `missing preset ${name}`);
  }
});

test("resolveStyle merges preset with override, override wins", () => {
  const s = resolveStyle("clean", { strokeColor: "#ff0000" });
  assert.equal(s.strokeColor, "#ff0000");
  assert.equal(s.backgroundColor, STYLE_PRESETS.clean.backgroundColor);
});

test("resolveStyle defaults to clean for unknown preset", () => {
  assert.deepEqual(resolveStyle("nope", {}), STYLE_PRESETS.clean);
});

test("buildHtml substitutes all tokens with JSON and escapes </script>", () => {
  const tpl = 'T=__TITLE__ M=__MERMAID__ S=__STYLE__';
  const html = buildHtml({ template: tpl, title: "X", mermaid: "flowchart TD\nA-->B", style: { strokeColor: "#000" } });
  assert.ok(html.includes('T="X"'));
  assert.ok(html.includes('M="flowchart TD\\nA-->B"'));
  assert.ok(html.includes('"strokeColor":"#000"'));
  assert.ok(!html.includes("__MERMAID__"));
});

test("buildHtml neutralizes a script-closing tag inside mermaid", () => {
  const tpl = 'M=__MERMAID__';
  const html = buildHtml({ template: tpl, title: "X", mermaid: "A[</script>]", style: {} });
  assert.ok(!html.includes("</script>"), "raw </script> must not survive");
  assert.ok(html.includes("\\u003c/script>"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/excalidraw-diagrams && node --test test/render.test.mjs`
Expected: FAIL — cannot resolve `render.mjs`.

- [ ] **Step 3: Write `skills/excalidraw-diagrams/render.mjs`**

```javascript
#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
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

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/excalidraw-diagrams && node --test test/render.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/excalidraw-diagrams/render.mjs test/render.test.mjs
git commit -m "feat: add render.mjs (mermaid->html, style presets, CLI)"
```

---

### Task 4: `shot.mjs` — headless screenshot + assertion

**Files:**
- Create: `skills/excalidraw-diagrams/shot.mjs`
- Test: `test/shot.test.mjs`

`shot.mjs` drives headless Chrome to (a) dump the DOM and assert the success
signal + `<canvas>` count, and (b) write a PNG. `findChrome()` is unit-tested;
the full `screenshot()` is integration-verified in Task 5.

- [ ] **Step 1: Write the failing test**

`test/shot.test.mjs`:
```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/excalidraw-diagrams && node --test test/shot.test.mjs`
Expected: FAIL — cannot resolve `shot.mjs`.

- [ ] **Step 3: Write `skills/excalidraw-diagrams/shot.mjs`**

```javascript
#!/usr/bin/env node
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const pexec = promisify(execFile);

const CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const c of CANDIDATES) if (existsSync(c)) return c;
  throw new Error("Could not find a Chrome/Chromium binary. Set CHROME_BIN to its path.");
}

const BASE_FLAGS = ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars"];

export async function screenshot({ htmlPath, outPng, budgetMs = 25000, windowSize = "1200,820" }) {
  const chrome = findChrome();
  const url = htmlPath.startsWith("http") ? htmlPath : `file://${htmlPath}`;

  // 1) Dump DOM to assert success signal + canvas count.
  const { stdout: dom } = await pexec(chrome, [
    ...BASE_FLAGS, `--virtual-time-budget=${budgetMs}`, "--dump-dom", url,
  ], { maxBuffer: 64 * 1024 * 1024 });

  const rendered = /data-rendered="true"/.test(dom);
  const canvasCount = (dom.match(/<canvas/g) || []).length;

  // 2) Write the PNG (best-effort; assertion above is the gate).
  if (outPng) {
    await pexec(chrome, [
      ...BASE_FLAGS, `--window-size=${windowSize}`, `--virtual-time-budget=${budgetMs}`,
      `--screenshot=${outPng}`, url,
    ], { maxBuffer: 64 * 1024 * 1024 });
  }

  return { ok: rendered && canvasCount >= 2, rendered, canvasCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [htmlPath, ...rest] = process.argv.slice(2);
  const outIdx = rest.indexOf("--out");
  const outPng = outIdx >= 0 ? rest[outIdx + 1] : undefined;
  if (!htmlPath) { console.error("usage: shot.mjs <html> [--out file.png]"); process.exit(2); }
  screenshot({ htmlPath, outPng }).then((r) => {
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
  }).catch((e) => { console.error(e.message); process.exit(2); });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/excalidraw-diagrams && node --test test/shot.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/excalidraw-diagrams/shot.mjs test/shot.test.mjs
git commit -m "feat: add shot.mjs headless screenshot + render assertion"
```

---

### Task 5: End-to-end smoke test (`smoke.mjs` + `sample.mmd`)

**Files:**
- Create: `test/sample.mmd`
- Create: `test/smoke.mjs`

This is the real integration check: render the sample, headless-render it, and
assert it succeeded. Requires network access (CDN) and a Chrome binary.

- [ ] **Step 1: Write `test/sample.mmd`**

```text
flowchart TD
  A([User]) --> B{Logged in?}
  B -- no --> C[Show login form]
  C --> D[POST /auth]
  D --> B
  B -- yes --> E[Dashboard]
  E --> F[(Postgres)]
```

- [ ] **Step 2: Write `test/smoke.mjs`**

```javascript
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
```

- [ ] **Step 3: Run the smoke test locally (network + Chrome required)**

Run: `cd ~/excalidraw-diagrams && node test/smoke.mjs`
Expected: prints `smoke result: {"ok":true,"rendered":true,"canvasCount":2} -> /…/smoke.png` then `SMOKE OK`, exit 0.

- [ ] **Step 4: Visually confirm the PNG (one-time sanity)**

Open the printed PNG path and confirm it shows the flowchart (boxes, decision diamond, routed arrows). On macOS: `open <png-path>`.

- [ ] **Step 5: Commit**

```bash
git add test/sample.mmd test/smoke.mjs
git commit -m "test: add end-to-end render smoke test"
```

---

### Task 6: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - uses: browser-actions/setup-chrome@v1
        id: chrome
      - name: Unit tests
        run: node --test test/
      - name: End-to-end smoke test
        env:
          CHROME_BIN: ${{ steps.chrome.outputs.chrome-path }}
        run: node test/smoke.mjs
```

- [ ] **Step 2: Validate the workflow YAML locally**

Run: `cd ~/excalidraw-diagrams && node -e "const f=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(!/smoke\.mjs/.test(f)||!/setup-chrome/.test(f)) throw new Error('workflow missing steps'); console.log('workflow ok')"`
Expected: prints `workflow ok`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: headless render smoke test on push/PR"
```

> NOTE: The workflow runs on GitHub after the user pushes. It cannot be executed locally; Step 2 only validates the file is well-formed and references the right steps.

---

### Task 7: `references/design-principles.md` and `SKILL.md` (content)

**Files:**
- Create: `skills/excalidraw-diagrams/references/design-principles.md`
- Create: `skills/excalidraw-diagrams/SKILL.md`

This task writes the skill content. Task 8 tests it with subagents (RED/GREEN/REFACTOR) per the writing-skills methodology — do NOT skip Task 8.

- [ ] **Step 1: Write `references/design-principles.md`**

```markdown
# Design principles (load for complex or conceptual diagrams)

Read this when a diagram is conceptual, teaches something, or feels like it
needs more than boxes-and-arrows. For simple flows, the rules in SKILL.md are
enough.

## Argue, don't display
A good diagram makes a point. Before drawing, finish the sentence: "This diagram
shows that ___." If you can't, you're labeling boxes, not explaining.

## Shape carries meaning
- Start / input / actor → rounded (`([text])`) or stadium nodes
- Decision / condition → diamond (`{text}`)
- Process / action → rectangle (`[text]`)
- Data store → cylinder (`[(text)]`)
- Cache / external → circle (`((text))`)
Use shape consistently so a reader learns your vocabulary once.

## Color encodes, not decorates
Pick ONE style preset per diagram. Use the `colorful` preset (or a style
override) only when color means something — e.g. stores vs actions vs decisions.
Don't add color just to fill space.

## Direction matches the story
- `TD` (top-down): hierarchies, decision trees, request flows
- `LR` (left-right): pipelines, sequences-as-flow, before→after

## Group with subgraphs
Architecture maps stay readable when components are grouped into labeled
`subgraph` regions (Backend / Frontend / External). Groups are the single
biggest readability win for system maps.

## Split before it gets dense
dagre routes arrows around blocks, but straight-line edges between far-apart
nodes can still cross in a crowded graph. If a diagram has more than ~12 nodes
or many long edges, split it into two diagrams (overview + detail) instead of
forcing everything into one.

## Keep labels short
Node text is a handle, not a sentence. Put detail in your explanation to the
user, not inside the box.
```

- [ ] **Step 2: Write `skills/excalidraw-diagrams/SKILL.md`**

````markdown
---
name: excalidraw-diagrams
description: Use when the user wants to see, visualize, sketch, or draw a flow, process, sequence, pipeline, state machine, or system/architecture as a diagram — phrases like "show me how X works", "draw the auth flow", "diagram this", "visualize the architecture".
---

# excalidraw-diagrams

Render a described flow as a **live, editable Excalidraw diagram** in the
browser. You write Mermaid; layout is automatic (dagre routes arrows around
blocks — no manual coordinates, no arrows-over-blocks).

## Workflow

1. **Classify** the request into a supported Mermaid type:
   | User wants | Mermaid |
   |------------|---------|
   | flow / process / decision / request path | `flowchart` |
   | actors/services exchanging messages over time | `sequenceDiagram` |
   | classes / data model | `classDiagram` |
   | architecture / system map | `flowchart` with `subgraph` groups |

   Only these three Mermaid families render as editable elements. Anything else
   degrades to a flat image — do not use other Mermaid diagram types.

2. **Write the Mermaid** following the quality rules below. Save it to a file or
   pipe it via stdin.

3. **Render it:**
   ```bash
   node skills/excalidraw-diagrams/render.mjs diagram.mmd --title "Auth flow" --style clean
   ```
   - `--style` one of `clean` (default), `sketchy`, `colorful`, `mono`.
   - `--style-json '{"strokeColor":"#1862ab","backgroundColor":"#e7f5ff"}'` to override.
   - Default opens your external browser. In an embedded/in-app browser
     environment (sandboxes `file://`), use `--serve` and open the printed
     `http://localhost:PORT` URL instead.
   - Run `node skills/excalidraw-diagrams/render.mjs --help`-style: see flags at
     the top of `render.mjs` if unsure.

4. **Self-review gate (required).** Screenshot the rendered page and look at it:
   ```bash
   node skills/excalidraw-diagrams/shot.mjs <printed-html-path> --out /tmp/diagram.png
   ```
   Then Read `/tmp/diagram.png`. If arrows cross blocks, labels overlap, or the
   layout is cramped: fix the Mermaid (change direction, add subgraphs, split
   the diagram) and re-render. Only tell the user it's ready after it looks
   right.

5. **Tell the user** it's open, and that the **💾 Save .excalidraw** button
   (top-right) downloads an editable file if they want one.

## Quality rules (keep layouts clean)

- **Shape carries meaning:** `([start])`, `{decision}`, `[process]`,
  `[(datastore)]`, `((cache))`. Be consistent.
- **Direction with intent:** `TD` for hierarchies/decisions, `LR` for pipelines.
- **Group with `subgraph`** for architecture maps — biggest readability win.
- **Short labels** — a handle, not a sentence.
- **Split dense diagrams** (>~12 nodes) into overview + detail.
- For conceptual/teaching diagrams, read
  `skills/excalidraw-diagrams/references/design-principles.md` first.

## Example

```text
flowchart TD
  A([User]) --> B{Logged in?}
  B -- no --> C[Show login form]
  C --> D[POST /auth]
  D --> B
  B -- yes --> E[Dashboard]
  E --> F[(Postgres)]
```

## Platform notes

- Tools are invoked with Claude Code names (Bash, Read). On Codex/other
  harnesses, use the equivalent shell-exec and image-read tools.
- The self-review gate needs a Chromium browser; set `CHROME_BIN` if it is not
  auto-detected. If no browser is available, skip the screenshot and ask the
  user to eyeball the live preview.

## Common mistakes

- Using an unsupported Mermaid diagram type → renders as a flat image. Stick to
  flowchart / sequenceDiagram / classDiagram.
- Long node labels → boxes overflow. Keep them short.
- One giant graph → arrow crossings. Split it.
````

- [ ] **Step 3: Sanity-check the frontmatter and required sections**

Run:
```bash
cd ~/excalidraw-diagrams && node -e "
const f=require('fs').readFileSync('skills/excalidraw-diagrams/SKILL.md','utf8');
if(!/^---[\s\S]*name: excalidraw-diagrams[\s\S]*description: Use when[\s\S]*?---/.test(f)) throw new Error('frontmatter');
for(const s of ['## Workflow','Self-review gate','render.mjs','shot.mjs']) if(!f.includes(s)) throw new Error('missing '+s);
console.log('SKILL.md structure ok');
"
```
Expected: prints `SKILL.md structure ok`.

- [ ] **Step 4: Commit**

```bash
git add skills/excalidraw-diagrams/SKILL.md skills/excalidraw-diagrams/references/design-principles.md
git commit -m "feat: add SKILL.md and design-principles reference"
```

---

### Task 8: Test SKILL.md with subagents (RED → GREEN → REFACTOR)

**Files:**
- Modify (as needed): `skills/excalidraw-diagrams/SKILL.md`

This applies the writing-skills Iron Law: do not ship the skill without watching
an agent succeed with it (and fail without it). Use the `Agent` tool with a
fresh subagent for each run.

- [ ] **Step 1: RED — baseline without the skill**

Dispatch a fresh general-purpose subagent (do NOT mention the skill). Prompt:
> "In the repo at `~/excalidraw-diagrams`, the user says: 'show me the login flow as a diagram I can open and edit.' Do it. Tell me exactly what commands you ran and what the user ends up seeing."

Record verbatim what it does. Expected baseline failure: it produces ASCII art,
a raw `.excalidraw` JSON by hand, or a Mermaid code block with no rendered
canvas — i.e. NOT an opened editable Excalidraw diagram. Save notes to
`docs/superpowers/plans/notes-task8-baseline.md`.

- [ ] **Step 2: GREEN — same task with the skill**

Dispatch a fresh subagent. Prompt:
> "Read `~/excalidraw-diagrams/skills/excalidraw-diagrams/SKILL.md` and follow it. The user says: 'show me the login flow as a diagram I can open and edit.' Then report the exact commands you ran, whether you ran the self-review screenshot, and what the user ends up seeing."

Success criteria (all must hold):
- Wrote a `flowchart` Mermaid diagram (supported type).
- Ran `render.mjs` with a `--title` (and `--serve` if it judged the env embedded).
- Ran the `shot.mjs` self-review and Read the PNG.
- Reported the Save-.excalidraw affordance to the user.

- [ ] **Step 3: REFACTOR — close gaps found in Step 2**

For each failure or rationalization observed, add an explicit counter to
SKILL.md (e.g. agent skipped self-review → strengthen "required" wording and add
to Common mistakes; agent picked `stateDiagram` → make the supported-subset
constraint louder). Re-run Step 2 with a fresh subagent until all success
criteria hold. Keep edits minimal and targeted.

- [ ] **Step 4: Commit**

```bash
cd ~/excalidraw-diagrams
git add skills/excalidraw-diagrams/SKILL.md docs/superpowers/plans/notes-task8-baseline.md
git commit -m "test: validate SKILL.md with subagents; close loopholes"
```

---

### Task 9: Install locally, manual verification, finalize README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Install the skill for local use**

Symlink the skill into the user's skills dir so it is discoverable:
```bash
ln -sfn ~/excalidraw-diagrams/skills/excalidraw-diagrams ~/.agents/skills/excalidraw-diagrams
ls -la ~/.claude/skills/excalidraw-diagrams 2>/dev/null || ln -sfn ~/.agents/skills/excalidraw-diagrams ~/.claude/skills/excalidraw-diagrams
```
(Confirm the symlink resolves and `SKILL.md` is readable through it.)

- [ ] **Step 2: Manual end-to-end run of all three diagram types**

```bash
cd ~/excalidraw-diagrams
printf 'sequenceDiagram\n  Client->>API: POST /auth\n  API->>DB: lookup user\n  DB-->>API: row\n  API-->>Client: 200 + token\n' | node skills/excalidraw-diagrams/render.mjs --title "auth sequence" --style colorful
```
Confirm a browser opens with an editable sequence diagram. Repeat with the
`flowchart` sample (`test/sample.mmd`) and a small `subgraph` architecture map.
For each, run `shot.mjs` and Read the PNG to confirm clean layout.

- [ ] **Step 3: Finalize `README.md`**

Replace the stub `README.md` with full usage:
```markdown
# excalidraw-diagrams

Render flows, sequences, and architecture diagrams as live, editable Excalidraw
canvases in your browser. Claude writes Mermaid; layout is automatic (dagre
routes arrows around blocks — no arrows-over-blocks). No build step, no install:
React + Excalidraw load from a pinned CDN.

## Requirements
- Node 22+
- Google Chrome / Chromium (for the optional render self-review). Set `CHROME_BIN` if not auto-detected.

## Install (as a skill)
Symlink the skill into your agent skills directory:
```bash
ln -sfn "$PWD/skills/excalidraw-diagrams" ~/.claude/skills/excalidraw-diagrams
```
Or install this repo as a Claude Code plugin (it ships `.claude-plugin/plugin.json`).

## Usage
Ask Claude to "draw" or "diagram" a flow. Under the hood:
```bash
node skills/excalidraw-diagrams/render.mjs diagram.mmd --title "Auth flow" --style clean
# styles: clean | sketchy | colorful | mono
# --style-json '{"strokeColor":"#1862ab"}'  to override
# --serve   for embedded/in-app browser views (prints an http://localhost URL)
```
Click **💾 Save .excalidraw** (top-right) to download an editable file.

## Supported diagram types
`flowchart`, `sequenceDiagram`, `classDiagram` (architecture = flowchart + subgraphs).
Other Mermaid types degrade to a flat image.

## Development
```bash
node --test test/      # unit tests
node test/smoke.mjs    # end-to-end render smoke test (needs network + Chrome)
```
CI runs both on every push.

## License
MIT
```

- [ ] **Step 4: Run the full test suite once more**

Run: `cd ~/excalidraw-diagrams && node --test test/ && node test/smoke.mjs`
Expected: all unit tests pass; smoke test prints `SMOKE OK`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: finalize README with usage and development guide"
```

---

## Verification summary

| Spec requirement | Covered by |
|------------------|-----------|
| CDN, no build (variant 1) | Task 2 template; Task 5 smoke proves it renders |
| Mermaid authoring + auto layout | Task 2/3; Task 5 |
| Live editable browser preview | Task 2 (Excalidraw component); Task 9 manual |
| Output to `$TMPDIR/excalidraw-previews/` | Task 3 `main()` |
| On-demand `.excalidraw` (Save button) | Task 2 template |
| Portable launch (`open` + `--serve`) | Task 3 `openInBrowser`/`serve` |
| Style presets + pasteable override | Task 3 `STYLE_PRESETS`/`resolveStyle`; Task 2 style pass |
| Supported-subset constraint | Task 7 SKILL.md; Task 8 enforces via testing |
| Self-review gate | Task 4 `shot.mjs`; Task 7 workflow; Task 8 verifies agent runs it |
| Design philosophy (light + reference) | Task 7 SKILL.md + design-principles.md |
| Zero-artifact CI smoke test | Task 6 |
| SKILL.md TDD with subagents | Task 8 |
| Prior-art differentiation (no hand-JSON) | Embodied by Mermaid pipeline; SKILL.md forbids other types |
