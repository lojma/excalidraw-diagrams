import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpLevel, nextVersion } from "../scripts/bump-version.mjs";

test("a feat commit anywhere in the push triggers a minor bump", () => {
  assert.equal(bumpLevel(["fix: arrow overlap", "feat: timeline layout"]), "minor");
});

test("non-feat commits (fix/docs/chore/ci) trigger a patch bump", () => {
  assert.equal(bumpLevel(["fix: x", "docs: y", "chore: z", "ci: w"]), "patch");
});

test("feat with a scope and/or breaking bang still counts as feat", () => {
  assert.equal(bumpLevel(["feat(layout): x"]), "minor");
  assert.equal(bumpLevel(["feat!: x"]), "minor");
  assert.equal(bumpLevel(["feat(layout)!: x"]), "minor");
});

test("only the subject line is inspected, not the body", () => {
  // a body line that merely mentions 'feat:' must not force a minor
  assert.equal(bumpLevel(["fix: x\n\nthis feat: was a typo in the body"]), "patch");
});

test("empty push falls back to patch", () => {
  assert.equal(bumpLevel([]), "patch");
});

test("nextVersion increments by level", () => {
  assert.equal(nextVersion("0.2.0", "minor"), "0.3.0");
  assert.equal(nextVersion("0.3.0", "patch"), "0.3.1");
  assert.equal(nextVersion("0.3.1", "major"), "1.0.0");
});

test("nextVersion rejects an unparseable version", () => {
  assert.throws(() => nextVersion("not.a.version", "patch"));
});
