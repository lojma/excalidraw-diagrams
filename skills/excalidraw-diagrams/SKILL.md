---
name: excalidraw-diagrams
description: Use when the user wants to see, visualize, sketch, or draw a flow, process, sequence, pipeline, state machine, or system/architecture as a diagram — phrases like "show me how X works", "draw the auth flow", "diagram this", "visualize the architecture".
---

# excalidraw-diagrams

Render a described flow or system as a **live, editable Excalidraw diagram** in the
browser. You are a **diagram designer**, not a renderer front-end: the spatial layout
is the message. Lay it out deliberately, then check the picture.

## Design, don't render

- **Spatial layout carries meaning.** Where a node sits — its stage, its column, its
  group — tells the reader as much as its label. Don't outsource that to an auto-layout
  engine unless the diagram is trivially simple.
- **One clear story path.** A reader's eye should follow the main flow without hunting.
  Lay the spine of the diagram along one axis (left→right or top→down).
- **Obvious grouping.** Related nodes sit close, in a shared frame/lane. Distance means
  "unrelated".
- **Connectors support, never dominate.** Short, local, mostly orthogonal. The blocks are
  the content; the arrows are punctuation.
- **Plan before authoring** anything non-trivial (Step 1 below).
- **Self-review the rendered image** before you tell the user it's ready. Always.

## Choose the path

Pick the authoring path from the work, not by habit. **Hand-authored Excalidraw JSON is
the quality path** — prefer it whenever layout matters.

**Mermaid** — use *only when ALL* of these hold:
- simple and mostly linear
- ≤ ~12 nodes
- few or no cross-links
- no retry/feedback loops
- no queue / scheduler / gate / eligibility logic
- exact layout is not critical

Mermaid hands layout to dagre (no manual coordinates), which is fine for a short linear
flow but goes sparse, scatters nodes, and sprouts long diagonal cross-canvas arrows on
anything dense. Only `flowchart`, `sequenceDiagram`, and `classDiagram` render as editable
elements; **any other Mermaid type degrades to a flat image — don't use those.**

**Hand-authored Excalidraw JSON (preferred for quality)** — use when *ANY* of these hold:
- more than ~12 nodes
- grouped components
- queues, schedulers, windows, gates, eligibility, retries, many triggers, or cross-links
- a staged flow you want to read stage-by-stage
- an architecture / system map
- a polished visual is expected
- Mermaid would likely go sparse or sprout long arrows

The JSON path has two sub-modes:
- **Declarative tiers** — coordinate-free `{tiers, edges}` spec, auto-laid-out. Best for
  architecture/system maps. Read `references/architecture-layout.md`.
- **Manual skeleton** — you place every box and route every arrow. Full control for
  architecture (`references/architecture-json.md`) **and staged flows**
  (`references/flow-layout.md`). Both use the *same* element forms.

## Step 1 — Plan the layout (mandatory for non-trivial)

Before authoring anything beyond a tiny linear flow, make a short internal plan:

- **Pattern:** pipeline · layered architecture · hub-and-spoke · fan-out / fan-in ·
  decision loop · queue-scheduler · timeline · state machine.
- **Main story path:** the spine the reader follows, in order.
- **Stages / tiers:** the bands the spine passes through.
- **Hero nodes** (the few that carry the point) vs **supporting nodes**.
- **Connectors:** which are **primary** (the flow) vs **secondary** (relations, retries,
  side-effects).
- **Groups / frames:** what shares a lane or panel.
- **Direction:** `TD` for hierarchies/decisions, `LR` for pipelines/timelines.
- **Loops / retries:** where they live — they belong *next to* their decision, not routed
  across the canvas.

A diagram you can describe in these terms lays out cleanly. One you can't isn't ready to draw.

## Workflow

> **Script paths:** `render.mjs` and `shot.mjs` live in **this skill's own
> directory** — the folder you just read this `SKILL.md` from. Your shell's
> working directory is usually a different project, so invoke them by that
> absolute path. Below, `$SKILL` stands for that folder (e.g.
> `~/.claude/skills/excalidraw-diagrams`); substitute the real path.

1. **Author** the diagram per the path you chose:
   - *Mermaid:* write Mermaid following the quality rules below; save to a file or pipe via
     stdin.
   - *Declarative tiers:* write a coordinate-free spec per `references/architecture-layout.md`;
     save to a `.json` file.
   - *Manual skeleton:* hand-place the elements per `references/architecture-json.md`
     (architecture) or `references/flow-layout.md` (staged flows); save to a `.json` file.

2. **Render it:**
   ```bash
   node "$SKILL/render.mjs" diagram.mmd --title "Auth flow" --style clean
   # JSON path (manual skeleton OR declarative tiers — auto-detected):
   node "$SKILL/render.mjs" --from-json diagram.json --title "Architecture"
   ```
   - `--style` one of `clean` (default), `sketchy`, `colorful`, `mono`.
   - `--style-json '{"strokeColor":"#1862ab","backgroundColor":"#e7f5ff"}'` to override.
   - `--edges straight` (tiers path) collapses orthogonal elbows into direct diagonals —
     lighter when the elbow "comb" between tiers dominates. Default is `ortho`.
   - Default opens your external browser. In an embedded/in-app browser
     environment (sandboxes `file://`), use `--serve` and open the printed
     `http://localhost:PORT` URL instead. Use `--no-open` to render without
     launching a browser (e.g. when you only need the screenshot in step 3).
   - `render.mjs` prints the output HTML path on stdout — capture it for step 3.
   - See the flag list at the top of `render.mjs` if unsure.

3. **Self-review gate (required).** Screenshot the rendered page and look at it:
   ```bash
   node "$SKILL/shot.mjs" <printed-html-path> --out /tmp/diagram.png
   ```
   Then Read `/tmp/diagram.png` and fix what you see (re-render after each fix), using the
   **reject gate** below. This gate is **mandatory for the JSON path.** Only tell the user
   it's ready after it looks right. The preview zooms to fit the whole diagram, so the
   screenshot shows every node.

   If `shot.mjs` returns `"ok":false` / `"canvasCount":0`, that is usually a
   slow-CDN flake — just run it once more before concluding anything is wrong.

4. **Tell the user** it's open, and that the hamburger menu's **Save to...**
   downloads an editable `.excalidraw` file if they want one (**Export image...**
   for PNG/SVG).

5. **Iterate on their edits (optional).** If the user tweaks the diagram in the browser
   and saves it (hamburger menu → **Save to...**), reload that file as-is to refine it —
   it keeps their manual layout/edits:
   ```bash
   node "$SKILL/render.mjs" --from-excalidraw edited.excalidraw --title "Auth flow"
   ```
   Read the `.excalidraw` JSON to see what they changed, make targeted improvements
   (realign, recolor, add an icon), and re-render.

## Mermaid quality rules (simple cases only)

- **Shape carries meaning:** `([start])`, `{decision}`, `[process]`,
  `[(datastore)]`, `((cache))`. Be consistent.
- **Direction with intent:** `TD` for hierarchies/decisions, `LR` for pipelines.
- **Smoother flow edges (optional):** prefix a flowchart with
  `%%{init: {"flowchart": {"curve": "basis"}}}%%` for rounded edges.
- **Short labels** — a handle, not a sentence.
- If a flow grows past the Mermaid checklist (dense, grouped, looping), **don't fight
  dagre — switch to the JSON path** and lay it out by stage.
- For conceptual/teaching diagrams, read `$SKILL/references/design-principles.md` first.

## Dense flows — staged layout

A trigger→queue→decision→action flow reads cleanly only when its **stages are laid out in
order** and each arrow is short. Author it as a manual skeleton (`references/flow-layout.md`):

- **Stage lanes:** one quiet labeled frame per stage, in story order — e.g. triggers ·
  queue/scheduler · rules/priority/gates · eligibility/decision · action/try · result ·
  wait/retry/fallback. `LR` → columns, `TD` → rows.
- **Keep related nodes close** within a stage; align their baselines.
- **Group triggers** into one band rather than scattering them.
- **The retry/wait loop sits next to its decision** — a short back-arrow, not a path routed
  across the canvas.
- **Short local arrows** between adjacent stages; label only gates/branches.
- No giant empty canvas: stages packed in order beat nodes floating far apart.

Full recipe + a worked scheduler example: `references/flow-layout.md`.

## Architecture map connector rules

The diagram must read as grouped blocks first, connectors second. Use **two visual levels**:
- **Primary:** solid dark grey, clear arrowhead, short path — the main flow/hierarchy.
- **Secondary:** light grey dashed, lower weight — relations like `save`, `remote`,
  `diagnostics`, `integrations`, `content`, `currency`. Keep them quiet: they must not
  dominate, cross the whole canvas, or compete with the colored group frames.

- Prefer **short, local** connectors over long routed paths; use **orthogonal** elbows,
  diagonals only when short and clear.
- Don't let secondary lines form large outer loops, run the canvas perimeter, or look like
  extra containers/frames.
- Keep lines **20–32 px** off group borders; separate parallel lanes by **12–16 px**;
  route into the **middle** of a block side, not its rounded corners.
- **External integrations:** prefer **one** dashed connector from the Core/Orchestrator
  area to the External group (label `integrations`/`diagnostics`). Only draw a vertical bus
  if each link has distinct meaning — keep it by the group, no taller than it.
- **Service rows:** one baseline, equal spacing; prefer simple vertical drops; avoid
  stacked horizontal lines between tiers.
- **Foundation:** keep it below the system with one clear connector in, not several.

Full detail and override knobs: `references/architecture-layout.md`.

## Self-review reject gate (strict)

Read the screenshot and **REJECT and rework** if you see any of these — don't ship it:

- huge empty canvas / nodes floating far apart
- tiny labels because the layout went over-wide
- long diagonal arrows, or connectors crossing most of the canvas
- dashed connectors that form an outer rectangle (read as an accidental frame)
- secondary lines dominating the colored group frames
- arrows landing on rounded corners instead of the middle of a side
- labels sitting on top of lines
- frames running too close to connectors
- stacked parallel lines between tiers
- an external bus so tall/dark it looks like a wall
- a retry/decision loop drawn far from the action it belongs to
- Mermaid output that's plainly worse than a manual layout would be

Then fix with the symptom→remedy table and re-render:

| Symptom | Remedy |
|---------|--------|
| Arrows cross blocks / tangle | Mermaid: change direction or split. Tiers: reorder a tier's nodes near their sources. Manual: re-place by stage |
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
| Retry/decision loop far from its action | Move the loop next to its decision; short local back-arrow |

## Switch path after a bad preview

If a **Mermaid** preview fails the gate — sparse, long diagonals, cross-canvas edges,
scattered nodes, poor grouping, unreadable scale — **do not keep patching the Mermaid.**
That's dagre's layout, not your text. Switch to a hand-authored JSON skeleton and lay it
out by stage (`references/flow-layout.md`) or by tier (`references/architecture-json.md`).

## Example (simple linear flow — Mermaid is fine here)

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
- **Rendering needs network.** The generated HTML loads Excalidraw, React, the
  Mermaid converter, and fonts from CDNs (unpkg/esm.sh) at view time; offline, the
  page stays blank. Only the SVG icons are bundled locally. A slow CDN can also make
  the screenshot gate flake — re-run `shot.mjs` once before concluding anything's wrong.

## Common mistakes

- Defaulting to Mermaid for a dense/looping/grouped flow → sparse canvas and long arrows.
  Use the JSON path and lay it out by stage.
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
- Routing a retry loop across the canvas instead of next to its decision.
- Skipping the screenshot gate → shipping a layout you never actually looked at.
