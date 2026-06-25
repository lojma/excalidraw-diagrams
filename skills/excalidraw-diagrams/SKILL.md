---
name: excalidraw-diagrams
description: Use when the user wants to see, visualize, sketch, or draw a flow, process, sequence, pipeline, state machine, or system/architecture as a diagram — phrases like "show me how X works", "draw the auth flow", "diagram this", "visualize the architecture".
---

# excalidraw-diagrams

Render a described flow as a **live, editable Excalidraw diagram** in the
browser. You write Mermaid; layout is automatic (dagre routes arrows around
blocks — no manual coordinates, no arrows-over-blocks).

## Workflow

1. **Classify** the request into a supported Mermaid type:
   | User wants | Mermaid |
   |------------|---------|
   | flow / process / decision / request path | `flowchart` |
   | actors/services exchanging messages over time | `sequenceDiagram` |
   | classes / data model | `classDiagram` |
   | architecture / system map | `flowchart` with `subgraph` groups |

   Only these three Mermaid families render as editable elements. Anything else
   degrades to a flat image — do not use other Mermaid diagram types.

2. **Write the Mermaid** following the quality rules below. Save it to a file or
   pipe it via stdin.

3. **Render it:**
   ```bash
   node skills/excalidraw-diagrams/render.mjs diagram.mmd --title "Auth flow" --style clean
   ```
   - `--style` one of `clean` (default), `sketchy`, `colorful`, `mono`.
   - `--style-json '{"strokeColor":"#1862ab","backgroundColor":"#e7f5ff"}'` to override.
   - Default opens your external browser. In an embedded/in-app browser
     environment (sandboxes `file://`), use `--serve` and open the printed
     `http://localhost:PORT` URL instead.
   - See the flag list at the top of `render.mjs` if unsure.

4. **Self-review gate (required).** Screenshot the rendered page and look at it:
   ```bash
   node skills/excalidraw-diagrams/shot.mjs <printed-html-path> --out /tmp/diagram.png
   ```
   Then Read `/tmp/diagram.png`. If arrows cross blocks, labels overlap, or the
   layout is cramped: fix the Mermaid (change direction, add subgraphs, split
   the diagram) and re-render. Only tell the user it's ready after it looks
   right.

5. **Tell the user** it's open, and that the **💾 Save .excalidraw** button
   (top-right) downloads an editable file if they want one.

## Quality rules (keep layouts clean)

- **Shape carries meaning:** `([start])`, `{decision}`, `[process]`,
  `[(datastore)]`, `((cache))`. Be consistent.
- **Direction with intent:** `TD` for hierarchies/decisions, `LR` for pipelines.
- **Group with `subgraph`** for architecture maps — biggest readability win.
- **Short labels** — a handle, not a sentence.
- **Split dense diagrams** (>~12 nodes) into overview + detail.
- For conceptual/teaching diagrams, read
  `skills/excalidraw-diagrams/references/design-principles.md` first.

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
