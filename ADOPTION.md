# Adoption notes — how this template drives developer adoption

This repo is not just a demo; it's a **developer-adoption asset**. Its job is to move
a developer from "heard of FLUX" to "shipped something with FLUX" as fast as
possible, and to make the non-obvious integration patterns (async polling, the CORS
proxy, cost-aware model selection) feel solved rather than scary.

## The funnel it serves

```
Discovery ─▶ First successful call ─▶ Integrated ─▶ Shipped ─▶ Advocated
```

| Stage | Developer's question | What this template does |
| --- | --- | --- |
| **Discovery** | "Can FLUX do what I need?" | A concrete, impressive use case (product → full campaign) that's more evocative than an API reference. |
| **First call** | "Can I get *one* image out?" | Phase-0 spike: clone → key → run → a real image in ~15 min. This is the **activation moment**. |
| **Integrated** | "How do I use it in a real app?" | Shows the patterns docs gloss over: async polling, the mandatory backend proxy, base64 for local inputs, the 10-min URL caveat. |
| **Shipped** | "Can I make it mine?" | Forkable: one config file for models/sizes/retries, a one-function path to add a new campaign type. |
| **Advocated** | "Worth telling others?" | A clean reference others fork, cite, and extend. |

The biggest drop-off in most API funnels is **Discovery → First successful call**.
Every choice here optimizes that edge: a single `npm install`, one env var, one
command, and a definition of done that is literally "you see a real image."

## Metrics that would matter

- **Time-to-first-image (TTFI):** minutes from `git clone` to the first rendered
  result. The single most predictive activation metric.
- **Activation rate:** % of cloners who complete one successful run.
- **Setup drop-off:** where people stall (missing key, Node version, install). Each
  is a fixable funnel leak.
- **Fork/extend rate:** % who add a campaign type or change `config.ts` — the signal
  that "Integrated → Shipped" is working.
- **Cost-to-first-value:** dollars of API spend to reach activation. This template
  keeps it low on purpose (a cheap klein concept draft before the premium hero),
  which itself teaches cost-aware orchestration.
- **Retention proxy:** repeat runs / return visits after day one.

Lightweight, privacy-respecting instrumentation (opt-in): a first-run ping with TTFI
and a coarse success/failure flag — enough to find funnel leaks, nothing creepy.

## Why templates (not just docs) compound

Reference docs answer "what does this endpoint do?"; a template answers "how do I
build the thing I actually want?" Templates:

- **collapse time-to-value** by pre-solving the boring-but-hard parts (proxy, polling,
  streaming, error handling);
- **encode best practices** in runnable code (the prompts here follow the
  `flux-best-practices` skill), so quality is the default;
- **are forkable surface area** — every fork is a warm lead and a potential case study.

## How more templates would follow

This is one node in a **library of task-oriented reference apps**, each targeting a
distinct "job to be done" and a distinct slice of the API:

- **Batch product catalog** — bulk generation + variations at scale (rate limits,
  concurrency, webhooks instead of polling).
- **Brand kit generator** — typography-heavy assets with `flux-2-flex` and strict
  hex-color brand control.
- **In-app editor** — inpaint / outpaint / erase flows (FLUX.1 Fill) behind a canvas.
- **Character-consistent series** — multi-reference editing for consistent subjects.

Each new template reuses this repo's spine (backend proxy, polling client, model
registry, SSE progress) and swaps the agent's plan. A shared starter kit plus a
gallery of these would turn "read the docs" into "fork the closest example," which is
the fastest path from Discovery to Shipped — and the most repeatable one.
