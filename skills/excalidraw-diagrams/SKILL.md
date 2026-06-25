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
   | architecture / system map (grouped components) | **Excalidraw JSON** — read `references/architecture-json.md` |

   Only those three Mermaid families render as editable elements; other Mermaid
   types degrade to a flat image — don't use them. Architecture maps are authored
   directly as Excalidraw JSON because dagre lays grouped components out poorly
   (floating groups, cross-canvas edges, wrapped circle text).

2. **Author the diagram.**
   - *Mermaid path:* write Mermaid following the quality rules below; save to a
     file or pipe via stdin.
   - *Architecture (JSON) path:* author a JSON array of Excalidraw skeleton
     elements per `references/architecture-json.md`; save to a `.json` file. Use the
     `role` / `frame` / `icon` fields — the renderer adds semantic color, titled
     panels, and real SVG icons by default (`--style mono` for grayscale).

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
     `http://localhost:PORT` URL instead.
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
   | Arrows cross blocks / tangle | Mermaid: change direction or split. JSON: realign columns, reroute |
   | Label text wraps / breaks mid-word | JSON: enlarge the node to fit its text |
   | Group label sits under an arrowhead | JSON: move the group label to the box's top-left |
   | Layout cramped | Fewer nodes, or split into overview + detail |

   If `shot.mjs` returns `"ok":false` / `"canvasCount":0`, that is usually a
   slow-CDN flake — just run it once more before concluding anything is wrong.

5. **Tell the user** it's open, and that the **💾 Save .excalidraw** button
   (top-right) downloads an editable file if they want one.

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
