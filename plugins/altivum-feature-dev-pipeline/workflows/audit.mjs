export const meta = {
  name: 'altivum-recon-audit',
  description: 'Multi-lens parallel codebase audit (eval/improve/improve-ui/improve-x2/enhance) synthesized into one prioritized brief',
  phases: [
    { title: 'Analyze', detail: 'fan out read-only analyzers per lens and focus area' },
    { title: 'Synthesize', detail: 'dedup and rank findings across lenses into one brief' },
  ],
}

// Lens -> which read-only subagent powers it, and the focus areas to fan out.
const LENS_CONFIG = {
  'eval': {
    label: 'eval (health / architecture)',
    agentType: 'altivum-feature-dev-pipeline:codebase-analyzer',
    focuses: ['frontend layer', 'backend/API layer', 'data & infrastructure layer'],
    lens: 'empirical health, correctness, security, maintainability, architecture',
  },
  'improve': {
    label: 'improve (full-stack)',
    agentType: 'altivum-feature-dev-pipeline:codebase-analyzer',
    focuses: ['frontend layer', 'backend/API layer', 'data & infrastructure layer'],
    lens: 'bold, high-impact, cross-layer product/architecture moves',
  },
  'improve-ui': {
    label: 'improve-ui (interface craft)',
    agentType: 'altivum-feature-dev-pipeline:ui-auditor',
    focuses: ['typography & rhythm', 'color & contrast', 'layout & spacing', 'motion', 'component-craft & polish'],
    lens: 'visual design quality and modern CSS craft',
  },
  'improve-x2': {
    label: 'improve-x2 (frontier)',
    agentType: 'altivum-feature-dev-pipeline:frontier-researcher',
    focuses: ['category leaders now', 'signature UX/interaction patterns', 'emerging platform capabilities', 'field-specific'],
    lens: 'researched, distinctive, buildable frontier moves (cite real examples + URLs)',
  },
  'enhance': {
    label: 'enhance (UX friction)',
    agentType: 'altivum-feature-dev-pipeline:codebase-analyzer',
    focuses: ['user-flow UX friction'],
    lens: 'concrete UX friction in existing user flows, ranked by user impact',
  },
}

const ALL = Object.keys(LENS_CONFIG)

// args: { path?: string, lenses?: string[] }
const requested = (args && Array.isArray(args.lenses) && args.lenses.length) ? args.lenses : ALL
let lenses = requested.filter((l) => LENS_CONFIG[l])
if (!lenses.length) lenses = ALL
const scope = (args && args.path) ? args.path : 'the whole repository'

log(`recon: ${lenses.length} lens(es) over ${scope}`)

phase('Analyze')
const perLens = await parallel(
  lenses.map((name) => async () => {
    const cfg = LENS_CONFIG[name]
    const results = await parallel(
      cfg.focuses.map((focus) => () =>
        agent(
          `Analyze ${scope} for the "${focus}" focus, in service of the ${name} lens ` +
            `(${cfg.lens}). Return structured, file-grounded findings for this focus only; do not rank.`,
          { label: `${name}:${focus}`, phase: 'Analyze', agentType: cfg.agentType },
        ).then((text) => ({ focus, text })),
      ),
    )
    // Pair each finding with its focus BEFORE filtering, so a null/failed agent
    // result can be dropped without shifting the remaining focus labels.
    return { lens: name, label: cfg.label, findings: results.filter((r) => r && r.text) }
  }),
)

const lensesWithFindings = perLens.filter(Boolean).filter((l) => l.findings.length)

phase('Synthesize')
const dossier = lensesWithFindings
  .map(
    (l) =>
      `### Lens: ${l.label}\n` +
      l.findings.map((f) => `#### Focus: ${f.focus}\n${f.text}`).join('\n\n'),
  )
  .join('\n\n---\n\n')

const brief = await agent(
  `You are synthesizing a multi-lens audit of ${scope}. Below are findings from ` +
    `${lensesWithFindings.length} analysis lens(es), each with one or more focus areas.\n\n` +
    dossier +
    `\n\nProduce ONE unified, prioritized brief:\n` +
    `- Dedup overlapping findings across lenses; when multiple lenses flag the same thing, mark it — that is a strong signal.\n` +
    `- Rank by impact-per-effort, preserving each item's provenance (which lens/lenses it came from).\n` +
    `- Group into "Top recommendations" (a numbered, prioritized shortlist) and "Also noted" (everything else worth tracking).\n` +
    `- For each top item: Title · What & why (with file evidence) · Lens(es) · Rough impact · Rough effort.\n` +
    `- Keep numbering stable, and end by telling the user to run /altivum-feature-dev-pipeline:plan <numbers> on the items they want, then :execute.`,
  { label: 'synthesize', phase: 'Synthesize' },
)

return { scope, lenses, brief }
