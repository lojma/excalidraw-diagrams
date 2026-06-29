# Authoring staged flows as Excalidraw JSON

Use this for **dense or looping flows** — anything with triggers, a queue/scheduler, gates,
an eligibility decision, an action, and a retry/wait loop. Mermaid hands these to dagre,
which spreads them across a sparse canvas with long diagonal arrows and no readable staging.
Hand-placing the stages wins.

This is the **same element forms** as `references/architecture-json.md` — `render.mjs`
treats both identically (`--from-json` of an array of skeleton elements). Read that file for
the full element reference; this page is the *layout recipe* for flows. Render with:

```bash
node "$SKILL/render.mjs" --from-json flow.json --title "Scheduler"
```

## The idea: stages are lanes

A flow reads cleanly when each **stage** is its own labeled lane and the spine runs straight
through them. Lay the stages out in story order:

- **`LR`** (default for pipelines) → lanes are **columns**, left to right.
- **`TD`** (decision-heavy) → lanes are **rows**, top to bottom.

Each lane is a `frame: true` element. The frame's **title band is the stage label** — the
renderer draws it at the frame's top-left, so **leave ≥ 44px between the frame top and the
first node** (same rule as architecture frames). Typical stages:

> triggers · queue/scheduler · rules/priority/gates · eligibility/decision · action/try ·
> result · wait/retry/fallback

You won't have every stage — use the ones your flow actually has.

## Layout rules (each prevents a failure)

1. **One frame per stage, in order.** Give frames the same `y`/`height` (LR) or `x`/`width`
   (TD) so the lanes align. Color them by `role` to encode meaning — e.g. `external`
   triggers, `service` workers, `accent` for the decision, `data` for the result.
2. **Keep a stage's nodes close** and align their centers on the spine. Group the triggers
   into one band rather than scattering them.
3. **Decision nodes are diamonds:** `{ "type": "diamond", "role": "accent", ... }`. Give a
   diamond ~110px height and enough width that the label doesn't wrap.
4. **Short local arrows between adjacent stages.** Explicit `points`, edge-to-edge,
   horizontal on the spine. Label only gates/branches (`yes`/`no`/`retry`) — not every arrow.
5. **The retry/wait loop lives next to its decision.** Put the wait node *inside the decision
   lane*, and route the loop back **one stage** (a short dashed back-arrow), not across the
   whole canvas. A loop that travels the full width reads as noise.
6. **Watch icon auto-widening.** A node with an `icon` is auto-widened to
   `label.length × 11 + 92` if that's larger than your `width` — which can push it past its
   frame or under an arrow tail. Set an explicit `width` at least that big (or drop the icon)
   so the geometry stays predictable.

## Worked example — a scheduler/queue/retry flow (LR)

Triggers fan into a queue; a scheduler feeds an eligibility decision; eligible work is sent;
ineligible work waits and retries next window. Six stage lanes, a straight spine, and a local
retry loop:

```json
[
  { "frame": true, "role": "external", "label": "Triggers",  "x": 40,   "y": 60, "width": 210, "height": 360 },
  { "frame": true, "role": "service",  "label": "Queue",     "x": 290,  "y": 60, "width": 190, "height": 360 },
  { "frame": true, "role": "service",  "label": "Scheduler", "x": 520,  "y": 60, "width": 230, "height": 360 },
  { "frame": true, "role": "accent",   "label": "Decision",  "x": 790,  "y": 60, "width": 210, "height": 360 },
  { "frame": true, "role": "service",  "label": "Action",    "x": 1040, "y": 60, "width": 190, "height": 360 },
  { "frame": true, "role": "data",     "label": "Result",    "x": 1270, "y": 60, "width": 200, "height": 360 },

  { "type": "rectangle", "role": "external", "x": 60,  "y": 130, "width": 170, "height": 46, "label": { "text": "Cron tick" } },
  { "type": "rectangle", "role": "external", "x": 60,  "y": 190, "width": 170, "height": 46, "label": { "text": "API request" } },
  { "type": "rectangle", "role": "external", "x": 60,  "y": 250, "width": 170, "height": 46, "label": { "text": "Webhook" } },

  { "type": "rectangle", "role": "service", "icon": "queue",  "x": 310,  "y": 185, "width": 150, "height": 56, "label": { "text": "Queue" } },
  { "type": "rectangle", "role": "service", "icon": "server", "x": 540,  "y": 185, "width": 200, "height": 56, "label": { "text": "Scheduler" } },
  { "type": "diamond",   "role": "accent",  "x": 810,  "y": 158, "width": 170, "height": 110, "label": { "text": "Eligible?" } },
  { "type": "rectangle",                    "x": 820,  "y": 300, "width": 150, "height": 46, "label": { "text": "Wait" } },
  { "type": "rectangle", "role": "service", "icon": "bell",   "x": 1055, "y": 185, "width": 150, "height": 56, "label": { "text": "Send" } },
  { "type": "rectangle", "role": "data",                      "x": 1290, "y": 185, "width": 160, "height": 56, "label": { "text": "Delivered" } },

  { "type": "arrow", "x": 230, "y": 153, "width": 80,  "height": 55,  "points": [[0,0],[80,55]],   "endArrowhead": "arrow" },
  { "type": "arrow", "x": 230, "y": 213, "width": 80,  "height": 0,   "points": [[0,0],[80,0]],    "endArrowhead": "arrow", "label": { "text": "enqueue" } },
  { "type": "arrow", "x": 230, "y": 273, "width": 80,  "height": -42, "points": [[0,0],[80,-42]],  "endArrowhead": "arrow" },

  { "type": "arrow", "x": 460, "y": 213, "width": 80,  "height": 0,   "points": [[0,0],[80,0]],    "endArrowhead": "arrow" },
  { "type": "arrow", "x": 740, "y": 213, "width": 70,  "height": 0,   "points": [[0,0],[70,0]],    "endArrowhead": "arrow" },
  { "type": "arrow", "x": 980, "y": 213, "width": 75,  "height": 0,   "points": [[0,0],[75,0]],    "endArrowhead": "arrow", "label": { "text": "yes" } },
  { "type": "arrow", "x": 1205,"y": 213, "width": 85,  "height": 0,   "points": [[0,0],[85,0]],    "endArrowhead": "arrow" },

  { "type": "arrow", "x": 895, "y": 268, "width": 0,   "height": 32,  "points": [[0,0],[0,32]],    "endArrowhead": "arrow", "label": { "text": "no" } },
  { "type": "arrow", "x": 820, "y": 323, "width": -180,"height": -82, "points": [[0,0],[-180,0],[-180,-82]], "endArrowhead": "arrow", "strokeStyle": "dashed", "label": { "text": "retry next window" } }
]
```

What makes it read:
- **Six lanes in story order**, all the same height, so the eye tracks left→right.
- **A straight spine** at `y≈213`: Queue → Scheduler → Eligible? → Send → Delivered, each
  arrow short and edge-to-edge.
- **Triggers grouped** into one lane, fanning into the queue with three short arrows.
- **The retry loop is local:** `Wait` sits inside the Decision lane; `no` drops to it, and a
  short dashed back-arrow returns to the Scheduler one stage left — never crossing the canvas.

## Self-review (mandatory)

Run the screenshot gate from SKILL.md step 3 and Read the PNG:

```bash
node "$SKILL/shot.mjs" <printed-html-path> --out /tmp/flow.png
```

Reject and rework (SKILL.md reject gate) if the canvas is sparse, arrows go diagonal across
stages, the retry loop travels far from its decision, or a node spills out of its lane. Fix
sizing/coordinates and re-render until the stages read in order.
