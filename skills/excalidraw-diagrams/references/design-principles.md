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

## Group with subgraphs
Architecture maps stay readable when components are grouped into labeled
`subgraph` regions (Backend / Frontend / External). Groups are the single
biggest readability win for system maps.

## Split before it gets dense
dagre routes arrows around blocks, but straight-line edges between far-apart
nodes can still cross in a crowded graph. If a diagram has more than ~12 nodes
or many long edges, split it into two diagrams (overview + detail) instead of
forcing everything into one.

## Keep labels short
Node text is a handle, not a sentence. Put detail in your explanation to the
user, not inside the box.
