// Auto-version the plugin from Conventional Commit messages.
//
// Rule (chosen in setup): any `feat` commit in the push -> minor bump;
// every other commit type (fix/docs/chore/ci/refactor/…) -> patch bump.
// Run on every push to main by .github/workflows/version-bump.yml.
//
// Pure helpers (`bumpLevel`, `nextVersion`) are unit-tested in
// test/bump-version.test.mjs; the CLI part only runs when invoked directly.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PLUGIN_PATH = fileURLToPath(
  new URL("../.claude-plugin/plugin.json", import.meta.url)
);

// `feat`, `feat(scope)`, `feat!`, `feat(scope)!` — case-insensitive.
const FEAT = /^feat(\([^)]*\))?!?:/i;

/** Decide the bump level from a list of commit subject/message lines. */
export function bumpLevel(messages) {
  for (const raw of messages) {
    const subject = String(raw).split("\n")[0].trim();
    if (FEAT.test(subject)) return "minor";
  }
  return "patch";
}

/** Increment a semver string by the given level. */
export function nextVersion(current, level) {
  const [major, minor, patch] = current.split(".").map((n) => parseInt(n, 10));
  if ([major, minor, patch].some((n) => Number.isNaN(n))) {
    throw new Error(`Unparseable version: "${current}"`);
  }
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const VERSION_FIELD = /("version"\s*:\s*")([^"]+)(")/;

function main() {
  const messages = (process.env.COMMIT_MESSAGES || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const level = bumpLevel(messages);

  // Edit only the version substring so the file stays byte-for-byte otherwise.
  const text = readFileSync(PLUGIN_PATH, "utf8");
  const match = text.match(VERSION_FIELD);
  if (!match) throw new Error('No "version" field in plugin.json');
  const current = match[2];
  const next = nextVersion(current, level);

  if (process.env.BUMP_DRY_RUN) {
    process.stderr.write(`level=${level} ${current} -> ${next}\n`);
    process.stdout.write(next + "\n");
    return;
  }

  writeFileSync(PLUGIN_PATH, text.replace(VERSION_FIELD, `$1${next}$3`));
  // stdout = the new version, for the workflow to capture
  process.stdout.write(next + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
