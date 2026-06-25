# excalidraw-diagrams

Render flows, sequences, and architecture diagrams as live, editable Excalidraw
canvases in your browser. Claude writes Mermaid; layout is automatic (dagre
routes arrows around blocks — no arrows-over-blocks). No build step, no install:
React + Excalidraw load from a pinned CDN.

## Requirements
- Node 22+
- Google Chrome / Chromium (for the render self-review). Set `CHROME_BIN` if not auto-detected.

## Install

### Recommended: as a Claude Code plugin
This repo is a plugin marketplace. In Claude Code:
```
/plugin marketplace add lojma/excalidraw-diagrams
/plugin install excalidraw-diagrams@excalidraw-diagrams
```
The skill then auto-activates (invoke manually as `/excalidraw-diagrams:excalidraw-diagrams`).
To update after a new release: `/plugin update excalidraw-diagrams`.

### Alternative: symlink (for local development)
Edit-in-place without reinstalling:
```bash
ln -sfn "$PWD/skills/excalidraw-diagrams" ~/.claude/skills/excalidraw-diagrams
```
Use one or the other, not both (they'd register the same skill twice).

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
