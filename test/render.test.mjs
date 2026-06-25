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
