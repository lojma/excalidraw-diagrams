# excalidraw-diagrams

A skill that renders flows, sequences, and architecture diagrams as live,
editable Excalidraw canvases in your browser. Claude writes Mermaid; the diagram
is laid out automatically (no arrows-over-blocks) and opened for you. No build
step, no install — everything loads from a pinned CDN.

## Requirements
- Node 22+
- A Chromium-based browser (Google Chrome) for the optional render self-review.

## Layout
- `skills/excalidraw-diagrams/` — the skill (SKILL.md + scripts + template)
- `test/` — smoke test used by CI
- `.github/workflows/ci.yml` — headless render smoke test

(Usage details added later.)
