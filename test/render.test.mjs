import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, STYLE_PRESETS, resolveStyle, buildHtml, expandSemantic, NODE_COLORS, layoutTiers } from "../skills/excalidraw-diagrams/render.mjs";

const TIERS = {
  tiers: [
    { label: "Client", role: "client", nodes: [{ id: "c", label: "Client", icon: "mobile" }] },
    { label: "Backend", role: "service", nodes: [
      { id: "gw", label: "API Gateway", icon: "gateway" }, { id: "auth", label: "Auth", icon: "shield" }] },
  ],
  sideGroups: [{ label: "External", role: "external", nodes: [{ id: "x", label: "Stripe", icon: "stripe" }] }],
  edges: [{ from: "c", to: "gw" }, { from: "gw", to: "x", label: "pay" }],
};

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

test("expandSemantic draws frame titles on the top layer so edges can't hide them", () => {
  const { skeleton } = expandSemantic([
    { frame: true, role: "data", label: "Data", x: 0, y: 0, width: 200, height: 120 },
    { type: "rectangle", x: 10, y: 60, width: 80, height: 40, label: { text: "node" } },
    { type: "arrow", x: 0, y: 0, points: [[0, 0], [0, 50]] },
  ]);
  const titleIdx = skeleton.findIndex((e) => e.type === "text" && e.text === "Data");
  const nodeIdx = skeleton.findIndex((e) => e.label && e.label.text === "node");
  const arrowIdx = skeleton.findIndex((e) => e.type === "arrow");
  assert.ok(titleIdx > nodeIdx && titleIdx > arrowIdx, "title renders after the node and the arrow");
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

test("expandSemantic forces arrows sharp (roundness null) so orthogonal bends are not curved", () => {
  const { skeleton } = expandSemantic([{ type: "arrow", points: [[0, 0], [0, 20], [40, 20]] }]);
  assert.equal(skeleton.find((e) => e.type === "arrow").roundness, null);
});

test("expandSemantic skips an unknown icon without failing", () => {
  const { images, files } = expandSemantic([{ type: "rectangle", icon: "definitely-not-an-icon", x: 0, y: 0 }]);
  assert.equal(images.length, 0);
  assert.equal(Object.keys(files).length, 0);
});

test("layoutTiers emits frames, nodes and arrows from a coordinate-free spec", () => {
  const els = layoutTiers(TIERS);
  const frames = els.filter((e) => e.frame);
  const nodes = els.filter((e) => e.type && e.type !== "arrow");
  const arrows = els.filter((e) => e.type === "arrow");
  assert.equal(frames.length, 3, "2 tiers + 1 side group");
  assert.equal(nodes.length, 4, "all nodes placed");
  assert.equal(arrows.length, 2, "both edges routed");
  for (const n of nodes) assert.ok(typeof n.x === "number" && typeof n.y === "number");
});

test("layoutTiers stacks tiers vertically and centers their frames", () => {
  const frames = layoutTiers(TIERS).filter((e) => e.frame);
  const [client, backend] = frames; // main-stack frames are emitted first, in order
  assert.ok(backend.y > client.y, "tiers stack downward");
  const cClient = client.x + client.width / 2, cBackend = backend.x + backend.width / 2;
  assert.ok(Math.abs(cClient - cBackend) < 1, "main frames share a center axis");
});

test("layoutTiers places side groups to the right of the main stack", () => {
  const frames = layoutTiers(TIERS).filter((e) => e.frame);
  const side = frames[2];
  const main = frames[0];
  assert.ok(side.x >= main.x + main.width, "side group sits right of the stack");
});

test("layoutTiers sizes icon nodes wide enough and routes a down-edge downward", () => {
  const els = layoutTiers(TIERS);
  const gw = els.find((e) => e.label && e.label.text === "API Gateway");
  assert.ok(gw.width >= "API Gateway".length * 11 + 92, "icon node sized to text + icon");
  const down = els.filter((e) => e.type === "arrow")[0]; // c -> gw is downward
  assert.ok(down.points.at(-1)[1] > 0, "down edge points downward");
});

test("layoutTiers skips an edge to an unknown node without throwing", () => {
  const arrows = layoutTiers({ tiers: TIERS.tiers, edges: [{ from: "gw", to: "nope" }] })
    .filter((e) => e.type === "arrow");
  assert.equal(arrows.length, 0);
});

const CONVERGE = {
  tiers: [
    { label: "Clients", role: "client", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }] },
    { label: "Edge", role: "service", nodes: [{ id: "cdn", label: "CDN" }] },
  ],
  edges: [{ from: "a", to: "cdn", label: "assets" }, { from: "b", to: "cdn", label: "assets" }, { from: "c", to: "cdn", label: "assets" }],
};

test("layoutTiers fans converging edges across the target face and de-dups a shared label", () => {
  const arrows = layoutTiers(CONVERGE).filter((e) => e.type === "arrow");
  assert.equal(arrows.length, 3);
  const ends = arrows.map((a) => Math.round(a.x + a.points.at(-1)[0]));
  assert.equal(new Set(ends).size, 3, "each arrow attaches at a distinct x on the target top");
  assert.equal(arrows.filter((a) => a.label).length, 1, "an identical bundle label appears once");
});

test("layoutTiers keeps distinct bundle labels while still fanning the edges", () => {
  const spec = { ...CONVERGE, edges: [{ from: "a", to: "cdn", label: "img" }, { from: "b", to: "cdn", label: "js" }, { from: "c", to: "cdn", label: "css" }] };
  const arrows = layoutTiers(spec).filter((e) => e.type === "arrow");
  assert.equal(arrows.filter((a) => a.label).length, 3, "distinct labels are all kept");
  const ends = arrows.map((a) => Math.round(a.x + a.points.at(-1)[0]));
  assert.equal(new Set(ends).size, 3, "edges still fan to distinct attach points");
});

const SKIP = {
  tiers: [
    { label: "T1", role: "client", nodes: [{ id: "a", label: "A" }] },
    { label: "T2", role: "service", nodes: [{ id: "x", label: "X" }] },
    { label: "T3", role: "data", nodes: [{ id: "b", label: "B" }] },
  ],
  edges: [{ from: "a", to: "b", label: "direct" }, { from: "a", to: "x" }],
};

test("layoutTiers routes a skip-tier edge around the stack, not through it", () => {
  const els = layoutTiers(SKIP);
  const frames = els.filter((e) => e.frame);
  const leftEdge = Math.min(...frames.map((f) => f.x));
  const arrows = els.filter((e) => e.type === "arrow");
  const skip = arrows.find((ar) => ar.label && ar.label.text === "direct");
  const adjacent = arrows.find((ar) => !ar.label);
  assert.equal(skip.points.length, 4, "skip edge is an orthogonal 4-point route");
  const corridorX = skip.x + skip.points[1][0];
  assert.ok(corridorX < leftEdge, "skip edge routes left of the whole stack");
  const adjMinX = Math.min(...adjacent.points.map((p) => adjacent.x + p[0]));
  assert.ok(adjMinX >= leftEdge - 1, "an adjacent edge routes within the stack, not around it");
});

const MM = {
  tiers: [
    { label: "Svc", role: "service", nodes: [{ id: "s1", label: "S1" }, { id: "s2", label: "S2" }] },
    { label: "Data", role: "data", nodes: [{ id: "d1", label: "D1" }, { id: "d2", label: "D2" }] },
  ],
  edges: [{ from: "s1", to: "d2" }, { from: "s2", to: "d1" }, { from: "s1", to: "d1" }, { from: "s2", to: "d2" }],
};

test("layoutTiers routes a many-to-many gap with distinct orthogonal lanes", () => {
  const arrows = layoutTiers(MM).filter((e) => e.type === "arrow");
  assert.equal(arrows.length, 4);
  for (const ar of arrows) {
    assert.equal(ar.points.length, 4, "orthogonal 4-point route");
    assert.equal(ar.points[1][1], ar.points[2][1], "middle segment is a flat horizontal lane");
  }
  const laneYs = arrows.map((ar) => Math.round(ar.y + ar.points[1][1]));
  assert.equal(new Set(laneYs).size, 4, "each edge gets its own lane");
});

test("layoutTiers routes a one-to-many gap as orthogonal elbows (no diagonals)", () => {
  const spec = {
    tiers: [
      { label: "A", role: "service", nodes: [{ id: "a", label: "A" }] },
      { label: "B", role: "data", nodes: [{ id: "b1", label: "B1" }, { id: "b2", label: "B2" }] },
    ],
    edges: [{ from: "a", to: "b1" }, { from: "a", to: "b2" }],
  };
  const arrows = layoutTiers(spec).filter((e) => e.type === "arrow");
  for (const ar of arrows) {
    assert.equal(ar.points.length, 4, "every adjacent edge is an orthogonal elbow");
    assert.equal(ar.points[1][1], ar.points[2][1], "the middle segment is a flat horizontal lane");
  }
});

test("layoutTiers gives two skip-tier edges distinct corridor lanes", () => {
  const spec = {
    tiers: [
      { label: "T1", role: "client", nodes: [{ id: "a1", label: "A1" }, { id: "a2", label: "A2" }] },
      { label: "T2", role: "service", nodes: [{ id: "x", label: "X" }] },
      { label: "T3", role: "data", nodes: [{ id: "b", label: "B" }] },
    ],
    edges: [{ from: "a1", to: "b" }, { from: "a2", to: "b" }],
  };
  const skips = layoutTiers(spec).filter((e) => e.type === "arrow" && e.points.length === 4);
  assert.equal(skips.length, 2);
  const lanes = skips.map((s) => s.x + s.points[1][0]);
  assert.notEqual(lanes[0], lanes[1], "each skip edge gets its own corridor lane");
});
