---
name: excalidraw-diagrams
description: Use when the user wants to see, visualize, sketch, or draw a flow, process, sequence, pipeline, state machine, or system/architecture as a diagram — phrases like "show me how X works", "draw the auth flow", "diagram this", "visualize the architecture".
---

# excalidraw-diagrams

Render a described flow as a **live, editable Excalidraw diagram** in the
browser. Two authoring paths, picked by diagram type:
- **Mermaid** (default) for flows, sequences, and class diagrams — layout is
  automatic (dagre routes arrows around blocks; no manual coordinates).
- **Hand-authored Excalidraw JSON** for architecture/system maps, where manual
  placement beats dagre's grouped layout. See `references/architecture-json.md`.

## Workflow

> **Script paths:** `render.mjs` and `shot.mjs` live in **this skill's own
> directory** — the folder you just read this `SKILL.md` from. Your shell's
> working directory is usually a different project, so invoke them by that
> absolute path. Below, `$SKILL` stands for that folder (e.g.
> `~/.claude/skills/excalidraw-diagrams`); substitute the real path.

1. **Classify** the request and pick the authoring path:
   | User wants | Path |
   |------------|------|
   | flow / process / decision / request path | Mermaid `flowchart` |
   | actors/services exchanging messages over time | Mermaid `sequenceDiagram` |
   | classes / data model | Mermaid `classDiagram` |
   | architecture / system map (grouped components) | **Declarative tiers** — read `references/architecture-layout.md` |

   Only those three Mermaid families render as editable elements; other Mermaid
   types degrade to a flat image — don't use them. Architecture maps use the Excalidraw
   paths below because dagre lays grouped components out poorly (floating groups,
   cross-canvas edges, wrapped circle text). For these maps, prioritize clean grouping
   and disciplined connector routing: short local arrows, quiet dashed secondary lines,
   no perimeter loops, and no dashed lines that look like extra containers.

2. **Author the diagram.**
   - *Mermaid path:* write Mermaid following the quality rules below; save to a
     file or pipe via stdin.
   - *Architecture path:* write a **declarative tiers spec** (no coordinates) per
     `references/architecture-layout.md` — list tiers, their nodes (with `role`/`icon`),
     and edges; the renderer lays it out with semantic color, titled frames, and real
     SVG icons (`--style mono` for grayscale). For pixel-level control, drop to the
     manual skeleton (`references/architecture-json.md`). Save to a `.json` file.

3. **Render it:**
   ```bash
   node "$SKILL/render.mjs" diagram.mmd --title "Auth flow" --style clean
   # architecture JSON path:
   node "$SKILL/render.mjs" --from-json diagram.json --title "Architecture"
   ```
   - `--style` one of `clean` (default), `sketchy`, `colorful`, `mono`.
   - `--style-json '{"strokeColor":"#1862ab","backgroundColor":"#e7f5ff"}'` to override.
   - Default opens your external browser. In an embedded/in-app browser
     environment (sandboxes `file://`), use `--serve` and open the printed
     `http://localhost:PORT` URL instead. Use `--no-open` to render without
     launching a browser (e.g. when you only need the screenshot in step 4).
   - `render.mjs` prints the output HTML path on stdout — capture it for step 4.
   - See the flag list at the top of `render.mjs` if unsure.

4. **Self-review gate (required).** Screenshot the rendered page and look at it:
   ```bash
   node "$SKILL/shot.mjs" <printed-html-path> --out /tmp/diagram.png
   ```
   Then Read `/tmp/diagram.png` and fix what you see (re-render after each fix).
   This gate is **mandatory for the JSON path**. Only tell the user it's ready
   after it looks right. The preview zooms to fit the whole diagram, so the
   screenshot shows every node.

   | Symptom | Remedy |
   |---------|--------|
   | Arrows cross blocks / tangle | Mermaid: change direction or split. Tiers: reorder a tier's nodes near their sources |
   | Label text wraps / breaks mid-word | JSON: enlarge the node to fit its text |
   | Group label sits under an arrowhead | JSON: move the group label to the box's top-left |
   | Layout cramped | Fewer nodes, or split into overview + detail |
   | Dashed line forms a large outer rectangle | Reroute as a shorter local connector; don't let secondary lines look like containers |
   | Secondary connectors dominate | Make them lighter, dashed, and shorter |
   | Connector runs too close to a group frame | Move it away — 20–32 px whitespace from borders |
   | Long line crosses most of the canvas | Replace with a compact labeled connector or a connector to the whole group |
   | External bus looks like a wall | Move it by the external group, shorten it, or collapse to one labeled connector |
   | Stacked horizontal lines between tiers | Separate lanes 12–16 px, or simplify to vertical drops |
   | Connector label floats awkwardly | Place it above the line, away from corners/intersections; small white chip if possible |

   If `shot.mjs` returns `"ok":false` / `"canvasCount":0`, that is usually a
   slow-CDN flake — just run it once more before concluding anything is wrong.

5. **Tell the user** it's open, and that the **💾 Save .excalidraw** button
   (top-right) downloads an editable file if they want one.

6. **Iterate on their edits (optional).** If the user tweaks the diagram in the browser
   and clicks 💾 Save .excalidraw, reload that file as-is to refine it — it keeps their
   manual layout/edits:
   ```bash
   node "$SKILL/render.mjs" --from-excalidraw edited.excalidraw --title "Auth flow"
   ```
   Read the `.excalidraw` JSON to see what they changed, make targeted improvements
   (realign, recolor, add an icon), and re-render.

## Quality rules (keep layouts clean)

- **Shape carries meaning:** `([start])`, `{decision}`, `[process]`,
  `[(datastore)]`, `((cache))`. Be consistent.
- **Direction with intent:** `TD` for hierarchies/decisions, `LR` for pipelines.
- **Smoother flow edges (optional):** prefix a flowchart with
  `%%{init: {"flowchart": {"curve": "basis"}}}%%` for rounded edges. Skip it for
  subgraph-heavy maps (spacing is ignored there) — use the JSON path for those.
- **Group with `subgraph`** only for light Mermaid grouping; for real architecture
  maps use the Excalidraw JSON path (`references/architecture-json.md`).
- **Short labels** — a handle, not a sentence.
- **Split dense diagrams** (>~12 nodes) into overview + detail.
- For conceptual/teaching diagrams, read `$SKILL/references/design-principles.md`
  first.

### Architecture map connector rules

The diagram must read as grouped blocks first, connectors second. Use **two visual
levels**:
- **Primary:** solid dark grey, clear arrowhead, short path — the main flow/hierarchy.
- **Secondary:** light grey dashed, lower weight — relations like `save`, `remote`,
  `diagnostics`, `integrations`, `content`, `currency`. Keep them quiet: they must not
  dominate, cross the whole canvas, or compete with the colored group frames.

- Prefer **short, local** connectors over long routed paths; use **orthogonal**
  elbows, diagonals only when short and clear.
- Don't let secondary lines form large outer loops, run the canvas perimeter, or look
  like extra containers/frames.
- Keep lines **20–32 px** off group borders; separate parallel lanes by **12–16 px**;
  route into the **middle** of a block side, not its rounded corners.
- **External integrations:** prefer **one** dashed connector from the Core/Orchestrator
  area to the External group (label `integrations`/`diagnostics`). Only draw a vertical
  bus if each link has distinct meaning — keep it by the group, no taller than it.
- **Service rows:** one baseline, equal spacing; prefer simple vertical drops from
  feature blocks; avoid stacked horizontal lines between tiers.
- **Foundation:** keep it below the system with one clear connector in, not several.

Full detail and the override knobs: `references/architecture-layout.md`.

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
- Forcing an architecture map through Mermaid `subgraph`s → floating groups and
  cross-canvas edges. Use the Excalidraw JSON path instead.
- Letting dashed secondary connectors form large outer loops → they read as
  accidental group frames.
- Drawing every relationship as a long routed arrow → visual noise. Prefer local
  connectors and grouped/bus-style relations.
- Running connector lines too close to colored group borders → they merge with the
  frame.
- Making external integration buses too tall or too dark → they overpower the actual
  integration blocks.
