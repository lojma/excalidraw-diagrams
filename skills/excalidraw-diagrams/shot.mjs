#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

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

// Run as a CLI even when reached through a symlink (installed skill dir).
const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === invokedPath) {
  const [htmlPath, ...rest] = process.argv.slice(2);
  const outIdx = rest.indexOf("--out");
  const outPng = outIdx >= 0 ? rest[outIdx + 1] : undefined;
  if (!htmlPath) { console.error("usage: shot.mjs <html> [--out file.png]"); process.exit(2); }
  screenshot({ htmlPath, outPng }).then((r) => {
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
  }).catch((e) => { console.error(e.message); process.exit(2); });
}
