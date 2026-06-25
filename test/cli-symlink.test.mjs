import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, symlinkSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The skill is installed via a symlink (~/.claude/skills/...), and SKILL.md tells
// agents to invoke the scripts by that symlinked path. ESM resolves
// import.meta.url to the REAL path while process.argv[1] stays the symlink path,
// so a naive `import.meta.url === file://${argv[1]}` main-guard silently fails
// and the CLI becomes a no-op. This test pins that the CLI runs through a symlink.
const renderPath = fileURLToPath(new URL("../skills/excalidraw-diagrams/render.mjs", import.meta.url));

test("render.mjs runs when invoked through a symlink (installed-skill case)", () => {
  const dir = mkdtempSync(join(tmpdir(), "excalidraw-symlink-"));
  const link = join(dir, "render-link.mjs");
  symlinkSync(renderPath, link);
  const mmd = join(dir, "d.mmd");
  writeFileSync(mmd, "flowchart TD\n  A-->B");
  const out = join(dir, "out.html");
  execFileSync("node", [link, mmd, "--title", "t", "--out", out, "--no-open"]);
  assert.ok(existsSync(out), "render.mjs invoked via symlink must still write the HTML");
  assert.ok(readFileSync(out, "utf8").includes("flowchart TD"));
});
