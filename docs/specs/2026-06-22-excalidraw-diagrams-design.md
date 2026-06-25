# Design: `excalidraw-diagrams` skill

**Date:** 2026-06-22
**Status:** Approved design, pending implementation plan

## Goal

A skill that turns a described flow ("show me the auth flow", "draw this
architecture") into a **live, editable Excalidraw diagram** rendered in the
browser. Packaged as a git-repo plugin with fast, artifact-free CI.

## What the user gets

1. They describe a flow / sequence / architecture in natural language.
2. The skill renders it as a real Excalidraw canvas (hand-drawn style, full
   editor, auto-laid-out arrows) and opens it in a browser.
3. If they want the editable file, a **"Save .excalidraw"** button in the page
   downloads it on demand. Preview is the default deliverable; saving is opt-in.

## Prior art and how we differ

`github.com/coleam00/excalidraw-diagram-skill` solves the same problem the
opposite way: Claude **hand-authors raw Excalidraw JSON** with manual x/y
coordinates (section-by-section, namespaced seeds, manual `boundElements`
bindings), renders to a **static PNG** via Python + Playwright (`uv` +
chromium), and runs a manual **render → inspect PNG → fix coordinates → repeat
2–4×** loop. It explicitly rejects Mermaid and generator scripts.

That design *causes* the user's stated pain: with no layout engine, edges and
shapes collide, and its own defect checklist lists "arrows crossing through
elements" with the fix being "adjust x/y, add arrow waypoints" — by hand, every
time.

| Dimension | coleam00 (hand-JSON) | This skill (Mermaid + dagre) |
|-----------|----------------------|------------------------------|
| Layout / arrows | Manual coords → collisions, hand-fixed | Auto-routed by dagre; no arrows-over-blocks |
| Output | Static PNG | Live, editable Excalidraw canvas |
| Authoring | Verbose JSON, section-by-section | ~10 lines of Mermaid |
| Iterations | 2–4 render-fix loops per diagram | One pass + optional self-review |
| Setup / CI | `uv` + Playwright + chromium | Zero deps, CDN |

**Adopted from them** (good ideas, engine-agnostic): a design-quality
philosophy (shape-carries-meaning, color-as-semantics, "argue not display") and
a render-and-self-review step. **Rejected**: the hand-JSON authoring path — it
is precisely what reintroduces the collision problem.

## Core decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Engine delivery | **CDN, no build** (variant 1) | Tiny repo, trivial CI, verified working. Internet needed at open-time; versions pinned so no drift. |
| Authoring format | **Mermaid** | Claude is reliable at Mermaid; the official `@excalidraw/mermaid-to-excalidraw` converter handles layout. |
| Render approach | **UMD browser build** of React + Excalidraw via `<script>`, ESM only for the Mermaid converter | Avoids esm.sh chunked-build / React-sharing failures (both hit and discarded during the POC). |
| Output location | `$TMPDIR/excalidraw-previews/` | Keeps project folders clean; previews are disposable. Overridable via arg. |
| `.excalidraw` file | On-demand in-page Save button (`serializeAsJSON`) | No Node-side DOM/conversion needed; keeps `render.mjs` zero-dependency. |
| Launch | Portable: `open` (default) or `--serve` localhost | Works for external browsers AND embedded browser views in Claude/Codex apps (which sandbox `file://`). |
| Styling | **Post-process style pass** (named presets + pasteable override). NOT Mermaid `classDef`. | Verified: `classDef` colors do not flow through converter v1.1.2; a post-process pass over the converted elements gives full, reliable control. |
| Self-review gate | **Always on**: after render, headless-screenshot + Read the result, fix if needed | Catches dense-graph arrow crossings before declaring done. Reuses the CI render harness. |
| Design guidance | **Light in SKILL.md** + optional `references/design-principles.md` | Keeps the core skill lean (dagre does layout); deeper "argue-not-display" philosophy loaded only for complex/conceptual diagrams. |
| Repo | User creates it; we build files into `~/excalidraw-diagrams/` | Per user request. No `git init` performed by the skill build. |

## Supported diagram types

`@excalidraw/mermaid-to-excalidraw` natively produces editable elements only for:

- **flowchart** — process flows, decisions, branches
- **sequenceDiagram** — actor/service message exchanges
- **classDiagram**

Mapping the user's three priorities:

| User wants | Mermaid type |
|------------|--------------|
| Flowchart / process flow | `flowchart` |
| Sequence diagram | `sequenceDiagram` |
| Architecture / system map | `flowchart` with `subgraph` groupings |

Any other Mermaid type degrades to a flat raster image (not editable). The
SKILL.md MUST constrain Claude to the supported subset so output is always
editable.

## Styling and diagram quality

The user's core pain — "arrows over blocks, arrows through all blocks, blocks
that look awful" — comes from hand-authored coordinates with no layout engine.
This design avoids that entirely by delegating layout to Mermaid/dagre.
Verified in the POC: edges route around blocks with no overlaps.

### Diagram-quality rules (taught in SKILL.md)
These keep generated Mermaid producing clean layouts:
- Choose direction deliberately: `TD` for hierarchies/decisions, `LR` for
  pipelines/sequences-as-flow.
- Group related nodes with `subgraph` (this is how architecture maps stay
  readable).
- Keep node labels short; put detail in the description to the user, not the box.
- Cap density — split very large graphs into multiple diagrams rather than one
  dense graph (straight-line arrows between far nodes can still cross in dense
  graphs; fewer nodes per diagram avoids it).
- Order sibling nodes to minimise edge crossings.

### Style pass (post-process)
After `convertToExcalidrawElements`, the template runs a style pass over the
elements before rendering. It controls: `strokeColor`, `backgroundColor`,
`fillStyle`, `strokeWidth`, `roundness` (rounded corners), `fontFamily`, and
arrow color. Optional role-based coloring (store / action / decision / actor)
is a mapping we own — not `classDef`.

- **Named presets** (pick by name): `clean` (default — light fill, slate
  stroke, rounded, hand-drawn font), `sketchy`, `colorful` (role-based palette),
  `mono` (blueprint/monochrome).
- **Pasteable style object** (overrides the preset): a small JSON, e.g.
  ```json
  { "strokeColor": "#1862ab", "backgroundColor": "#e7f5ff",
    "fontFamily": 1, "roundness": 3, "strokeWidth": 1.5 }
  ```
- Presets live in `render.mjs`; the chosen preset + any override is injected
  into the template as a `__STYLE__` token consumed by the style pass.

Verified in the POC: the style pass produced rounded, uniformly-filled,
consistently-stroked blocks and recolored arrows — a clear improvement over the
unstyled output.

## Repository layout

```
excalidraw-diagrams/
  .claude-plugin/plugin.json          # plugin manifest (name, version, skills)
  skills/excalidraw-diagrams/
    SKILL.md                          # when-to-use + workflow + Mermaid cheat-sheet + constraints
    template.html                     # verified self-contained preview (pinned CDN)
    render.mjs                        # Node, zero-deps: Mermaid -> html -> open/serve
    shot.mjs                          # headless screenshot of a rendered preview (self-review + CI)
    references/
      design-principles.md            # deeper "argue-not-display" philosophy, loaded on demand
  test/
    sample.mmd                        # smoke-test Mermaid input
    smoke.mjs                         # headless-Chrome render assertion (wraps shot.mjs)
  .github/workflows/ci.yml            # runs smoke test on push/PR
  docs/specs/2026-06-22-excalidraw-diagrams-design.md
  README.md
  LICENSE
```

## Components

### `template.html`
Self-contained page, pinned versions:
- `react@18.2.0`, `react-dom@18.2.0` UMD from unpkg
- `@excalidraw/excalidraw@0.17.6` UMD from unpkg (+ `styles.css`, `EXCALIDRAW_ASSET_PATH`)
- `@excalidraw/mermaid-to-excalidraw@1.1.2` ESM from esm.sh
- `__MERMAID__`, `__TITLE__`, and `__STYLE__` placeholder tokens for substitution
- A **style pass** over the converted elements (consumes `__STYLE__`) before render
- A "Save .excalidraw" button wired to `ExcalidrawLib.serializeAsJSON`
- No debug/status overlay (that was POC-only)

### `render.mjs` (Node, no dependencies)
- Reads Mermaid from a file arg or stdin; takes `--title`, `--out`, `--serve`,
  `--no-open`, `--style <preset>`, `--style-json '<obj>'`.
- Holds the named style presets (`clean`/`sketchy`/`colorful`/`mono`); merges
  the chosen preset with any `--style-json` override into the `__STYLE__` token.
- String-substitutes Mermaid + title + style into `template.html`.
- Writes `<slug>.html` to the output dir (default `$TMPDIR/excalidraw-previews/`).
- Default: opens via the platform opener (`open`/`xdg-open`/`start`).
- `--serve`: starts an ephemeral localhost static server, prints the URL,
  for embedded browser views.
- Always prints the resulting path/URL so any harness can display it.

### `shot.mjs` (Node, no dependencies)
- Takes a rendered preview HTML path, drives headless Chrome
  (`--virtual-time-budget`), writes a PNG, and asserts the success signal
  (`data-rendered`) + `<canvas>` count >= 2.
- Used two ways: the **self-review gate** (Claude Reads the PNG to eyeball the
  result) and **CI** (`smoke.mjs` wraps it for pass/fail).
- Locates a Chrome binary across platforms; documents the env var to override.

### `SKILL.md`
- **Description:** "Use when the user wants to see/visualize a flow, process,
  sequence, or architecture as a diagram..." (triggering conditions only; no
  workflow summary, per CSO guidance).
- Workflow: classify request -> write Mermaid (supported subset) -> run
  `render.mjs` (choose `open` vs `--serve` by environment) -> **self-review
  gate**: run `shot.mjs`, Read the PNG, fix Mermaid/style if crossings or
  overlaps appear -> tell user it's open and that the Save button exists.
- Mermaid cheat-sheet for the three types + common pitfalls (label escaping,
  unsupported-type fallback).
- **Light diagram-quality rules** (actionable for Mermaid): shape-carries-
  meaning, color-as-semantics, short labels, deliberate direction, subgraph
  grouping, density caps. For conceptual/complex diagrams, read
  `references/design-principles.md` (progressive disclosure).
- How to pick a style preset / pass a style override.
- Platform note: tool-name adaptation for Codex per writing-skills guidance
  (incl. how the self-review Read step maps on non-Claude-Code harnesses).

### CI (`.github/workflows/ci.yml` + `test/smoke.mjs`)
- On push/PR: set up Node + headless Chrome.
- `render.mjs test/sample.mmd --no-open` then headless-render the output and
  assert success. Production template has no debug overlay, so on success it
  sets a machine-readable signal (e.g. `document.body.dataset.rendered="true"`);
  smoke.mjs asserts that signal AND `<canvas>` count >= 2.
- No build artifacts to commit or verify.

## Skill testing (writing-skills / TDD)

Before finalizing SKILL.md:
1. **RED:** baseline subagent on "show me the login flow" WITHOUT the skill —
   capture what it does (likely ASCII/Mermaid text, no Excalidraw).
2. **GREEN:** add SKILL.md; verify subagent writes valid Mermaid in the
   supported subset and invokes `render.mjs`.
3. **REFACTOR:** close gaps (e.g. picks unsupported diagram type, forgets
   `--serve` in embedded environments).

## Risks / open items

- **CDN availability/version drift** — mitigated by pinned versions + CI smoke
  test that fails loudly when a pinned URL breaks.
- **Embedded browser `file://` sandboxing** — mitigated by `--serve` mode.
- **Mermaid unsupported types** — mitigated by SKILL.md constraint + cheat-sheet.
- **`mermaid-to-excalidraw` ESM in a UMD page** — verified working in POC; CI
  guards regressions.
- **Arrow crossings in dense graphs** — dagre avoids block overlaps, but
  straight-line edges between distant nodes can still cross. Mitigated by the
  diagram-quality rules (direction, subgraphs, density caps).
- **`classDef` styling not honored by converter v1.1.2** — sidestepped by doing
  all styling in the post-process pass.

## Verification already done

Two POCs rendered headlessly and confirmed via screenshot:
- `~/excalidraw-poc/preview.html` — full editable Excalidraw canvas, correct
  flowchart layout, decision diamond, clean routed arrows. Validates the render
  pipeline (UMD + ESM converter + Mermaid layout).
- `~/excalidraw-poc/preview-styled.html` — the post-process style pass producing
  rounded, uniformly-filled, consistently-stroked blocks and recolored arrows.
  Validates the styling channel (and showed `classDef` does not flow through).
