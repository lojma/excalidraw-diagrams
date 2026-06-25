# excalidraw-diagrams

Render flows, sequences, and architecture diagrams as live, editable Excalidraw
canvases in your browser. Claude writes Mermaid; layout is automatic (dagre
routes arrows around blocks — no arrows-over-blocks). No build step, no install:
React + Excalidraw load from a pinned CDN.

## Requirements
- Node 22+
- Google Chrome / Chromium (for the render self-review). Set `CHROME_BIN` if not auto-detected.

## Install (as a skill)
Symlink the skill into your agent skills directory:
```bash
ln -sfn "$PWD/skills/excalidraw-diagrams" ~/.claude/skills/excalidraw-diagrams
```
Or install this repo as a Claude Code plugin (it ships `.claude-plugin/plugin.json`).

## Usage
Ask Claude to "draw" or "diagram" a flow. Under the hood, the skill writes
Mermaid and runs:
```bash
node skills/excalidraw-diagrams/render.mjs diagram.mmd --title "Auth flow" --style clean
# styles: clean | sketchy | colorful | mono
# --style-json '{"strokeColor":"#1862ab"}'  to override
# --serve   for embedded/in-app browser views (prints an http://localhost URL)
```
The preview zooms to fit the whole diagram. Click **💾 Save .excalidraw**
(top-right) to download an editable file.

## Supported diagram types
`flowchart`, `sequenceDiagram`, `classDiagram` (architecture = flowchart + subgraphs).
Other Mermaid types degrade to a flat image.

## Development
```bash
node --test test/*.test.mjs   # unit tests
node test/smoke.mjs           # end-to-end render smoke test (needs network + Chrome)
```
CI runs both on every push.

## License
MIT
