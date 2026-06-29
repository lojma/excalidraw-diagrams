# Design principles (load for complex or conceptual diagrams)

Read this when a diagram is conceptual, teaches something, or feels like it
needs more than boxes-and-arrows. For simple flows, the rules in SKILL.md are
enough.

## Argue, don't display
A good diagram makes a point. Before drawing, finish the sentence: "This diagram
shows that ___." If you can't, you're labeling boxes, not explaining.

## Shape carries meaning
- Start / input / actor → rounded (`([text])`) or stadium nodes
- Decision / condition → diamond (`{text}`)
- Process / action → rectangle (`[text]`)
- Data store → cylinder (`[(text)]`)
- Cache / external → circle (`((text))`)
Use shape consistently so a reader learns your vocabulary once.

## Color encodes, not decorates
Pick ONE style preset per diagram. Use the `colorful` preset (or a style
override) only when color means something — e.g. stores vs actions vs decisions.
Don't add color just to fill space.

## Direction matches the story
- `TD` (top-down): hierarchies, decision trees, request flows
- `LR` (left-right): pipelines, sequences-as-flow, before→after

## Group explicitly
Grouping related components into labeled regions (Backend / Frontend / External,
or one lane per flow stage) is the single biggest readability win. For real
maps and staged flows, author the groups as frames on the **Excalidraw JSON
path** (`references/architecture-layout.md`, `references/architecture-json.md`,
`references/flow-layout.md`) where you control placement — Mermaid `subgraph`s
are only worth it for a light, simple grouping.

## When it gets dense, change paths, don't just split
dagre routes arrows around blocks, but straight-line edges between far-apart
nodes still cross in a crowded graph, and grouped/looping flows go sparse. Past
~12 nodes, or with grouping/queues/retries, the fix is usually to **move to the
JSON path** and lay the diagram out by tier or stage — not to keep fighting
Mermaid. Splitting into overview + detail is a fallback when even a hand-authored
diagram would be too much for one canvas.

## Keep labels short
Node text is a handle, not a sentence. Put detail in your explanation to the
user, not inside the box.
