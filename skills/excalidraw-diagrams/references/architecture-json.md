# Authoring architecture maps as Excalidraw JSON

Use this for **system / architecture maps with grouped components**. Mermaid's dagre
layout handles these poorly — floating groups joined by long cross-canvas edges, circle
text wrapping mid-word ("Redi/s"), subgraph labels colliding with arrowheads. Hand-placing
the blocks wins. Render with:

```bash
node "$SKILL/render.mjs" --from-json diagram.json --title "Architecture"
node "$SKILL/render.mjs" --from-json diagram.json --style mono   # grayscale escape hatch
```

The file is a JSON **array of Excalidraw skeleton elements** plus a few author-friendly
fields (`role`, `frame`, `icon`) that `render.mjs` expands into colors and embedded icons.
**Color and icons are on by default**; `--style mono` (or `--no-color`) turns the palette
off. `x`/`y` is an element's top-left corner; arrow `points` are relative to its `x`/`y`.

## Semantic fields (let the renderer do the styling)

- **`role`** on a node → fill + stroke from the palette (set your own colors to override):

  | role | use | look |
  |------|-----|------|
  | `client` | apps/devices/users | violet |
  | `service` | backend services/APIs | blue |
  | `data` | databases/caches/stores | green |
  | `external` | third-party / providers | orange |
  | `accent` | the one thing to highlight | yellow |

- **`frame: true`** + `role` + `label` → a tinted panel with the label in a reserved
  **title band**. Position children with absolute `x`/`y` inside it, and **leave ≥ 44px
  between the frame top and the first child** so the title has its own space. Draw frames
  before the nodes they contain.

- **`icon: "<name>"`** on a node → embeds a real SVG icon at the node's left.
  When a node has an icon, **make it wider** (`label width + ~80px`) so the centered label
  clears the icon. Names are tech/stack logos (devicon) + generic shapes + social marks —
  full list in `references/icons.md`. Examples: `react nodejs python go rust docker
  kubernetes postgres mysql mongodb redis kafka nginx aws gcp terraform github`; generics
  `server database gateway shield cloud queue cache user bell`; social `apple google facebook`.
  Add any other devicon tech with `node icons/build.mjs --add <slug>`. Unknown names are skipped.

## Element forms

```jsonc
{ "type": "rectangle", "role": "service", "icon": "shield", "x": 360, "y": 180, "width": 170, "height": 56, "label": { "text": "Auth" } }
{ "type": "ellipse",   "role": "data", "icon": "redis", "x": 700, "y": 430, "width": 120, "height": 100, "label": { "text": "Redis" } }
{ "frame": true, "role": "data", "label": "Data", "x": 40, "y": 460, "width": 480, "height": 150 }
{ "type": "arrow", "x": 435, "y": 238, "width": 0, "height": 78, "points": [[0,0],[0,78]], "endArrowhead": "arrow", "label": { "text": "reads" } }
```

## Rules (each prevents a defect)

1. **Size nodes to their text** (`width ≈ 11 × chars + 40`, `height ≥ 48`); add ~80px more
   when the node has an icon. Circles need ~96px or the label wraps mid-word.
2. **Arrows use explicit `points`, NOT `start`/`end` bindings** — the converter recomputes
   bound geometry and skews routing. Bottom-center→top-center for vertical edges,
   side→side for same-row, ~4px gap off the box edge.
3. **Frames before their members; ≥44px title band; one role per panel.**
4. **Align columns; route downward** (dependencies under their consumers). A couple of
   clean crossings are fine; a tangle is not.
5. **Top-down hierarchy:** entrypoints on top, services in the middle, data at the bottom.

## Example (mobile-game login — colored, framed, icon-bearing)

```json
[
  { "frame": true, "role": "service",  "label": "Backend", "x": 40, "y": 200, "width": 500, "height": 240 },
  { "frame": true, "role": "data",     "label": "Data", "x": 40, "y": 465, "width": 500, "height": 145 },
  { "frame": true, "role": "external", "label": "Identity Providers", "x": 700, "y": 60, "width": 300, "height": 305 },

  { "type": "rectangle", "role": "client",   "icon": "mobile",   "x": 162, "y": 87,  "width": 215, "height": 56, "label": { "text": "Game Client" } },
  { "type": "rectangle", "role": "service",  "icon": "gateway",  "x": 160, "y": 257, "width": 220, "height": 56, "label": { "text": "API Gateway" } },
  { "type": "rectangle", "role": "service",  "icon": "shield",   "x": 315, "y": 367, "width": 140, "height": 56, "label": { "text": "Auth" } },
  { "type": "rectangle", "role": "service",  "icon": "user",     "x": 70,  "y": 367, "width": 170, "height": 56, "label": { "text": "Accounts" } },
  { "type": "rectangle", "role": "data",     "icon": "postgres", "x": 70,  "y": 520, "width": 170, "height": 56, "label": { "text": "Postgres" } },
  { "type": "ellipse",   "role": "data",     "icon": "redis",    "x": 320, "y": 496, "width": 130, "height": 104, "label": { "text": "Redis" } },
  { "type": "rectangle", "role": "external", "icon": "apple",    "x": 755, "y": 117, "width": 180, "height": 46, "label": { "text": "Apple" } },
  { "type": "rectangle", "role": "external", "icon": "google",   "x": 755, "y": 175, "width": 180, "height": 46, "label": { "text": "Google" } },
  { "type": "rectangle", "role": "external", "icon": "facebook", "x": 755, "y": 233, "width": 180, "height": 46, "label": { "text": "Facebook" } },
  { "type": "rectangle", "role": "external", "icon": "globe",    "x": 748, "y": 293, "width": 215, "height": 46, "label": { "text": "Game Center" } },

  { "type": "arrow", "x": 270, "y": 143, "width": 0,   "height": 114, "points": [[0,0],[0,114]],    "endArrowhead": "arrow" },
  { "type": "arrow", "x": 377, "y": 112, "width": 323, "height": 28,  "points": [[0,0],[323,28]],   "endArrowhead": "arrow", "label": { "text": "SDK sign-in" } },
  { "type": "arrow", "x": 270, "y": 313, "width": 115, "height": 54,  "points": [[0,0],[115,54]],   "endArrowhead": "arrow" },
  { "type": "arrow", "x": 315, "y": 395, "width": -75, "height": 0,   "points": [[0,0],[-75,0]],    "endArrowhead": "arrow", "label": { "text": "lookup" } },
  { "type": "arrow", "x": 455, "y": 384, "width": 245, "height": -130,"points": [[0,0],[245,-130]], "endArrowhead": "arrow", "label": { "text": "verify" } },
  { "type": "arrow", "x": 385, "y": 423, "width": 0,   "height": 73,  "points": [[0,0],[0,73]],     "endArrowhead": "arrow", "label": { "text": "session" } },
  { "type": "arrow", "x": 155, "y": 423, "width": 0,   "height": 97,  "points": [[0,0],[0,97]],     "endArrowhead": "arrow" }
]
```

After rendering, run the self-review screenshot gate (SKILL.md step 4) — **mandatory for
this path** — and fix sizing/routing/overlap until it looks right.
