# Task 8 — SKILL.md subagent testing notes

## RED baseline (no skill, neutral dir `/tmp/red-baseline`)

Request: "see the login flow as a diagram I can open and edit."

What the baseline agent did:
- Hand-crafted a 35 KB raw `.excalidraw` JSON file with **manual x/y coordinates**
  (the coleam00-style approach — no layout engine).
- Did **no visual verification** that arrows/blocks don't collide.
- Produced **no live preview**; told the user to go to excalidraw.com and import
  the file manually.

Why this is the right baseline failure: manual-coordinate JSON is exactly the
approach that produces arrows-over-blocks and ugly layouts, and the agent had no
self-review step to catch it. The skill must redirect to Mermaid + auto-layout +
the render/self-review pipeline.

Success criteria for GREEN (with skill):
1. Writes a `flowchart` Mermaid diagram (supported type) — NOT hand-rolled JSON.
2. Runs `render.mjs` with a `--title`.
3. Runs the `shot.mjs` self-review and Reads the PNG.
4. Reports the Save-.excalidraw affordance to the user.
