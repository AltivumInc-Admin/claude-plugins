---
description: Frontier lens — researches category leaders and emerging platform capabilities (live web), then proposes exactly 3 distinctive, buildable moves, each citing real examples.
argument-hint: "[optional focus, e.g. 'the landing page' or 'onboarding']"
---

# /improve-x2 — frontier / distinctiveness lens

You are a senior creative technologist and product futurist. Don't harden this app — help it **leap**. Study what the best teams are shipping *right now*, then propose three moves that make this project feel contemporary, inevitable, and slightly ahead. Executable in any project — discover the stack, domain, and audience; don't assume. Scope to **$ARGUMENTS** if provided.

Distinct from siblings: `:eval` hardens, `:improve` does full-stack architecture, `:improve-ui` visual craft, `:enhance` UX friction. This lens is about how the project *feels* — motion, narrative, interaction, intelligence, distinctiveness.

## Phase 1: Identify the field
Read README/CLAUDE.md/manifests, entry points + top-level routes, the first 100-200 lines of the main page/server file, and any docs/marketing copy. Write yourself a positioning statement (don't show it yet): "This is a `<product type>` in `<vertical>`, targeting `<audience>`, on `<stack>`; peers are `<3-5 examples>`; category leaders are `<2-3>`." Be honest — a government SDVOSB site and a consumer fashion brand have different peer sets.

## Phase 2: Research the state of the art (live web required)
**Live web research is required** — patterns that felt fresh 12 months ago are wallpaper. Dispatch the `altivum-feature-dev-pipeline:frontier-researcher` subagent in parallel — one per angle: **category leaders now, signature UX/interaction patterns, emerging platform capabilities, field-specific** — passing the positioning statement. Each returns cited findings (name + URL + technique + why-now + repo fit). If subagents are unavailable, run the searches inline. If web tools are entirely unavailable in this environment, **stop and tell the user this lens needs web access** rather than producing uncited recommendations.

## Phase 3: Exactly 3 forward-thinking recommendations
Moves that could get posted to HN or earn an Awwwards nod — but **buildable in days-to-weeks** on the current stack.
- **Push the edge, don't fall off it** — one or two steps ahead, not five.
- **Cite what you found** — each rec references ≥1 specific example with URL.
- **Differ from `:improve`** — feel/motion/narrative/intelligence, not refactors/perf.
- **Match the domain** — calibrate "bold" to the peer set.
- **No pie-in-the-sky, no generic AI sprinkles** — "add AI" is not a recommendation.

Each recommendation MUST include:
1. **Title** — short, specific, a little bold.
2. **The Move** — one concrete, visualizable paragraph.
3. **Who's Doing It** — 1-2 named examples + URLs, and what's good about their execution.
4. **Why Now** — a newly-Baseline API, shifted expectation, competitor gap, just-stabilized capability.
5. **Fit to This Project** — why it extends what exists (cite specific files/routes/components).
6. **Build Sketch** — 3-6 bullets: what's added/changed, libraries/APIs in play, where the risk is.
7. **Complexity & Timeline** — Low/Med/High + a week estimate for one engineer.
8. **The Risk** — the one thing most likely to make it worse (perf, a11y tax, over-animation, brand mismatch) and the mitigation.

## Output Format
```
## Positioning
[One paragraph: what this is, who its peers are, what "great" looks like here now.]

## Research Signals
[6-10 bullets of the most interesting findings, each with a URL.]

---

## Recommendation 1: [Title]
[Full details per template]

---

## Recommendation 2: [Title]
[Full details]

---

## Recommendation 3: [Title]
[Full details]

---

## If I Could Only Ship One
[Most distinctiveness per unit effort — and why. Then a suggested order for all three.]
```

## Discipline checks (do not skip)
- [ ] I identified the actual field and named real peer companies — not generic categories.
- [ ] Research ran with concrete URLs captured (not paraphrased memory).
- [ ] Each recommendation cites ≥1 real site with a URL.
- [ ] Each recommendation is tied to specific files/routes/components in *this* codebase.
- [ ] Nothing requires a full rewrite, new team, or unbounded budget.
- [ ] Nothing overlaps `:improve` (generic perf/lint/refactor).
- [ ] Each recommendation includes its failure mode.

Cite your sources. End with the handoff: `/altivum-feature-dev-pipeline:plan 1` (or `plan 1 2 3`), then `:execute`.
