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
  Give a side group an `id` and an edge may target the **whole group**
  (`{"from":"core","to":"ext","label":"integrations"}`) — one connector into the
  group's edge, instead of many separate lines into each node.
- Edges are drawn straight between the nearest faces; an edge to a side group drops
  below its row and routes across so it doesn't cut through neighbors.
- An edge that **skips a tier** (e.g. tier 1 → tier 3) auto-routes around the left
  margin instead of slicing through the frame in between.
- When **many nodes in one tier point to many in the next**, those edges route as
  parallel orthogonal lanes through a widened gap (instead of a diagonal tangle).
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
| top  | `edgeRouting` | `"ortho"` (default) right-angle lanes, or `"straight"` direct 2-point diagonals |

**Edge routing.** By default edges route as orthogonal elbows through laned gaps —
clean right angles, shared bundles. Set `"edgeRouting": "straight"` in the spec (or pass
`--edges straight` on the command line, which overrides the spec) to collapse them into
direct diagonals. Straight is lighter when the elbow "comb" between two tiers dominates;
orthogonal is clearer when many edges share a gap. Endpoints are identical either way.

## Order nodes to avoid crossings

The renderer keeps the node order **you give**; it does not reorder to untangle
edges. So order each tier's nodes to line up with what they connect to:

- **Put a node near the source that points to it.** If a left-hand source connects
  to a node, place that node toward the left of its tier; a right-hand source's
  targets go right. Crossings appear when an edge must travel sideways past other
  nodes to reach one parked on the far side.
- **Keep one source's targets together.** List the nodes a single source feeds as
  neighbors, in the order their siblings appear above.

Example: a left-side `Stickers` feature that uses `Data` and `Wallet` reads cleanly
when `Data` and `Wallet` sit together at the left of the services tier — not with
`Wallet` pushed to the far right, which drags its edge across the whole tier.

## Labels

Keep edge labels sparse. Many labels in the same band (e.g. several edges into one
tier, or a cluster of side-group edges) collide into an unreadable blob. Label only
the edges whose purpose isn't obvious from the nodes themselves — a `Payments → Stripe`
edge needs no "charge" label. A label shared by a whole converging bundle is shown once.

## When the layout isn't perfect

Dense gaps route as orthogonal lanes, but lanes can still get busy and individual
edges may cross a lane. Two escape hatches:
- **Drag-refine:** open the diagram, drag nodes, click 💾 Save .excalidraw, then
  `render.mjs --from-excalidraw saved.excalidraw` to keep editing.
- **Full control:** drop to the manual skeleton path (`references/architecture-json.md`),
  where you set every coordinate and arrow route yourself.
