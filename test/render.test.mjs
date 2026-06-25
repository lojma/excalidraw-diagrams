import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, STYLE_PRESETS, resolveStyle, buildHtml, expandSemantic, NODE_COLORS } from "../skills/excalidraw-diagrams/render.mjs";

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

test("buildHtml defaults to mermaid mode with an empty elements array", () => {
  const tpl = 'MODE=__MODE__ ELS=__ELEMENTS__';
  const html = buildHtml({ template: tpl, title: "X", mermaid: "flowchart TD\nA-->B", style: {} });
  assert.ok(html.includes('MODE="mermaid"'));
  assert.ok(html.includes("ELS=[]"));
});

test("buildHtml json mode injects skeleton elements and escapes </script>", () => {
  const tpl = 'MODE=__MODE__ M=__MERMAID__ ELS=__ELEMENTS__';
  const elements = [{ type: "rectangle", id: "a", label: { text: "A[</script>]" } }];
  const html = buildHtml({ template: tpl, title: "X", style: {}, mode: "json", elements });
  assert.ok(html.includes('MODE="json"'));
  assert.ok(html.includes('M=""'), "mermaid should be empty in json mode");
  assert.ok(html.includes('"type":"rectangle"'));
  assert.ok(!html.includes("</script>"), "raw </script> must not survive in elements");
  assert.ok(html.includes("\\u003c/script>"));
});

test("buildHtml injects __IMAGES__ and __FILES__ tokens", () => {
  const tpl = 'IMG=__IMAGES__ FILES=__FILES__';
  const html = buildHtml({ template: tpl, title: "X", style: {}, mode: "json",
    images: [{ type: "image", id: "i1" }], files: { f1: { id: "f1" } } });
  assert.ok(html.includes('"type":"image"'));
  assert.ok(html.includes('"f1"'));
});

test("expandSemantic maps role -> palette colors, strips role", () => {
  const { skeleton } = expandSemantic([{ type: "rectangle", role: "data", x: 0, y: 0, width: 100, height: 40 }]);
  const n = skeleton[0];
  assert.equal(n.backgroundColor, NODE_COLORS.data.backgroundColor);
  assert.equal(n.strokeColor, NODE_COLORS.data.strokeColor);
  assert.equal(n.role, undefined, "role field should be stripped");
});

test("expandSemantic respects explicit colors and color:false", () => {
  const explicit = expandSemantic([{ type: "rectangle", role: "data", backgroundColor: "#fff" }]).skeleton[0];
  assert.equal(explicit.backgroundColor, "#fff", "explicit color wins over role");
  const off = expandSemantic([{ type: "rectangle", role: "data" }], { color: false }).skeleton[0];
  assert.equal(off.backgroundColor, undefined, "no role color when color:false");
});

test("expandSemantic expands a frame into a tinted rect + title text", () => {
  const { skeleton } = expandSemantic([{ frame: true, role: "service", label: "Backend", x: 10, y: 20, width: 200, height: 120 }]);
  const rect = skeleton.find((e) => e.type === "rectangle");
  const text = skeleton.find((e) => e.type === "text");
  assert.ok(rect && rect.backgroundColor && rect.frame === undefined);
  assert.equal(text.text, "Backend");
  assert.ok(text.y >= 20 && text.y < 64, "title sits in the top band");
});

test("expandSemantic embeds a known icon as a file + image, strips icon", () => {
  const { skeleton, images, files } = expandSemantic([
    { type: "rectangle", icon: "google", x: 0, y: 0, width: 150, height: 56, label: { text: "Google" } },
  ]);
  assert.equal(skeleton[0].icon, undefined, "icon field should be stripped");
  assert.equal(images.length, 1);
  assert.equal(images[0].type, "image");
  assert.ok(files["icon-google"].dataURL.startsWith("data:image/svg+xml;base64,"));
});

test("expandSemantic skips an unknown icon without failing", () => {
  const { images, files } = expandSemantic([{ type: "rectangle", icon: "definitely-not-an-icon", x: 0, y: 0 }]);
  assert.equal(images.length, 0);
  assert.equal(Object.keys(files).length, 0);
});
