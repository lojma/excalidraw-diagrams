# Architecture maps the easy way: declarative tiers (auto-layout)

**Start here for architecture/system maps.** Write *what* the diagram contains — tiers,
their nodes, and the edges — with **no coordinates**. The renderer places everything
(sizes nodes, aligns rows, sizes frames, routes arrows) and applies the semantic color +
icons automatically. Render the spec the same way as manual JSON (it's auto-detected):

```bash
node "$SKILL/render.mjs" --from-json spec.json --title "Architecture"
```

## The spec

An object (not an array) with `tiers`, optional `sideGroups`, and `edges`:

```jsonc
{
  "layout": "tiers", "title": "Mobile game login",
  "tiers": [
    { "label": "Client",  "role": "client",  "nodes": [ {"id":"client","label":"Game Client","icon":"mobile"} ] },
    { "label": "Backend",  "role": "service", "nodes": [
        {"id":"gw","label":"API Gateway","icon":"gateway"},
        {"id":"auth","label":"Auth","icon":"shield"},
        {"id":"acct","label":"Accounts","icon":"user"} ] },
    { "label": "Data",     "role": "data",    "nodes": [
        {"id":"pg","label":"Postgres","icon":"postgres"},
        {"id":"rd","label":"Redis","icon":"redis","shape":"ellipse"} ] }
  ],
  "sideGroups": [
    { "label": "Identity Providers", "role": "external", "nodes": [
        {"id":"apple","label":"Apple","icon":"apple"},
        {"id":"google","label":"Google","icon":"google"} ] }
  ],
  "edges": [
    { "from": "client", "to": "gw" },
    { "from": "client", "to": "apple", "label": "SDK sign-in" },
    { "from": "auth", "to": "rd", "label": "session" }
  ]
}
```

## Built-in rules (you don't specify any of this)

- Tiers stack top→down in the order given; each is a colored, titled frame.
- A tier's nodes flow in a centered row; nodes are sized to their text (+ icon).
- All main-stack frames share one width so they line up.
- `sideGroups` stack to the **right** of the main stack (e.g. external providers).
- Edges are drawn straight between the nearest faces; an edge to a side group drops
  below its row and routes across so it doesn't cut through neighbors.
- An edge that **skips a tier** (e.g. tier 1 → tier 3) auto-routes around the left
  margin instead of slicing through the frame in between.
- Several edges converging on one node fan across its face and a label they all
  share is shown once, not repeated.
- `role` colors: `client` violet, `service` blue, `data` green, `external` orange.
- Icons: any name from `references/icons.md` (`postgres`, `redis`, `docker`, `react`, …).

## Overrides (touch only what you want)

| Where | Field | Effect |
|-------|-------|--------|
| node | `width`, `height` | fix a node's size |
| node | `shape` | `rectangle` (default), `ellipse`, `diamond` |
| node | `role` | override the tier's role for one node |
| node | `pin: {x,y}` | place this node manually; others lay out around it |
| tier | `columns` | wrap the tier's nodes into a grid of N columns |
| top  | `layoutOptions` | `{ nodeGap, tierGap, sideGap, padX, titleBand }` spacing |

## When the layout isn't perfect

Straight edges can still cross when many nodes in one tier point to many in the next.
Two escape hatches:
- **Drag-refine:** open the diagram, drag nodes, click 💾 Save .excalidraw, then
  `render.mjs --from-excalidraw saved.excalidraw` to keep editing.
- **Full control:** drop to the manual skeleton path (`references/architecture-json.md`),
  where you set every coordinate and arrow route yourself.
