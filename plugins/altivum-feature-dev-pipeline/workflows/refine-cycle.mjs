export const meta = {
  name: 'altivum-refine-cycle',
  description: 'One refine cycle: parallel worktree build of picked items, integrate + automated checks, adversarial review panel with verification',
  phases: [
    { title: 'Build', detail: 'build each picked item in its own worktree, in parallel' },
    { title: 'Integrate', detail: 'merge item branches, run automated checks, clean up worktrees' },
    { title: 'Review', detail: 'adversarial review panel over the integrated diff, then verify findings' },
  ],
}

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'itemId', 'summary'],
  properties: {
    status: { type: 'string', enum: ['built', 'failed'] },
    itemId: { type: 'string' },
    branch: { type: 'string' },
    worktree: { type: 'string' },
    commit: { type: 'string' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
  },
}

const INTEGRATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['integratedBranch', 'checks', 'conflictedItems'],
  properties: {
    integratedBranch: { type: 'string' },
    checks: {
      type: 'object',
      additionalProperties: false,
      required: ['build', 'lint', 'typecheck', 'test'],
      properties: {
        build: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        lint: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        typecheck: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        test: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
      },
    },
    conflictedItems: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dimension', 'findings'],
  properties: {
    dimension: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'issue', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: 'string' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isRealDefect', 'reasoning'],
  properties: {
    isRealDefect: { type: 'boolean' },
    reasoning: { type: 'string' },
  },
}

const items = (args && Array.isArray(args.items)) ? args.items : []
const base = (args && args.base) || 'main'
const cycleBranch = (args && args.cycleBranch) || 'refine/cycle'
const repoRoot = (args && args.repoRoot) || '.'
const checks = (args && args.checks) || {}

if (!items.length) {
  return { error: 'no items provided', integratedBranch: cycleBranch, built: [], failedItems: [], confirmedReviewDefects: [] }
}

log(`refine-cycle: ${items.length} item(s) onto ${cycleBranch} from ${base}`)

// Phase 1 — parallel build, each item on its own branch in its own worktree.
phase('Build')
const built = await parallel(
  items.map((it) => () =>
    agent(
      `Implement ONE refinement item in the git repo at ${repoRoot}.\n` +
        `Item id: ${it.id}\nTitle: ${it.title}\nDetails: ${it.desc || ''}\n\n` +
        `Steps (use Bash; keep the change scoped to THIS item only):\n` +
        `1. Make an isolated worktree on a fresh branch:\n` +
        `   WT=$(mktemp -d)\n` +
        `   git -C ${repoRoot} worktree add -B refine/item-${it.id} "$WT" ${base}\n` +
        `   cd "$WT"\n` +
        `2. Implement the item with TDD (write a failing test, then make it pass), following existing project conventions.\n` +
        `3. Commit with a clear message. Do NOT remove the worktree — the integrator needs the branch.\n` +
        `4. Report status 'built' with branch refine/item-${it.id}, the worktree path "$WT", the commit SHA, a one-line summary, and files changed.\n` +
        `If you cannot implement it cleanly, make NO commit and report status 'failed' with a reason.`,
      { label: `build:${it.id}`, phase: 'Build', schema: BUILD_SCHEMA },
    ),
  ),
)
const okItems = built.filter((b) => b && b.status === 'built')
const failedItems = built.filter((b) => b && b.status === 'failed')

// Phase 2 — integrate built branches + run automated checks (single agent, main worktree).
phase('Integrate')
const branchList = okItems.map((b) => b.branch).filter(Boolean).join(', ')
const worktreeList = okItems.map((b) => b.worktree).filter(Boolean).join(', ')
const integration = await agent(
  `Integrate built refinement items in the git repo at ${repoRoot}.\n` +
    `Target branch: ${cycleBranch}. Base: ${base}. Item branches to merge (in order): ${branchList || '(none)'}.\n\n` +
    `Steps (Bash; capture REAL output):\n` +
    `1. git -C ${repoRoot} checkout -B ${cycleBranch} ${base}\n` +
    `2. For each item branch, merge it: git -C ${repoRoot} merge --no-ff <branch>. If it conflicts, run git -C ${repoRoot} merge --abort, record that item id in conflictedItems, and skip it (do not block the others).\n` +
    `3. Run the automated checks and record each result (pass / fail / not-applicable), citing key output:\n` +
    `   build: ${checks.build || '(auto-detect from package.json scripts / Makefile)'}\n` +
    `   lint: ${checks.lint || '(auto-detect)'}\n` +
    `   typecheck: ${checks.typecheck || '(auto-detect)'}\n` +
    `   test: ${checks.test || '(auto-detect)'}\n` +
    `   A check whose tool/script does not exist is 'not-applicable'; a non-zero run is 'fail'.\n` +
    `4. Clean up the item worktrees so they don't accumulate: for each path in [${worktreeList || 'none'}] run git -C ${repoRoot} worktree remove --force <path> (ignore errors), then git -C ${repoRoot} worktree prune.\n` +
    `Report the integrated branch (${cycleBranch}), the four check results, the conflictedItems list, and brief notes.`,
  { label: 'integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA },
)

// Phase 3 — adversarial review panel over the integrated diff, then verify high/critical findings.
phase('Review')
const DIMS = ['correctness & bugs', 'security', 'scope & hygiene', 'tests & coverage']
const reviews = await parallel(
  DIMS.map((d) => () =>
    agent(
      `Adversarially review the integrated diff for the "${d}" dimension in the repo at ${repoRoot}: ` +
        `run git -C ${repoRoot} diff ${base}...${cycleBranch} and read the changed files. ` +
        `Report only substantiated findings (severity, file, issue, concrete fix). Do not edit code.`,
      { label: `review:${d}`, phase: 'Review', schema: REVIEW_SCHEMA },
    ),
  ),
)
const flagged = reviews
  .filter(Boolean)
  .flatMap((r) => (r.findings || []).filter((f) => f.severity === 'high' || f.severity === 'critical').map((f) => ({ dimension: r.dimension, ...f })))

const verified = await parallel(
  flagged.map((f) => () =>
    agent(
      `Adversarially verify this review finding against the code at ${repoRoot} (branch ${cycleBranch}). ` +
        `Is it a real, substantiated ${f.severity} defect, or a false positive / style nit? Read the relevant file(s). ` +
        `Finding: ${JSON.stringify(f)}. Set isRealDefect=true only if genuinely substantiated; default false when unsure.`,
      { label: `verify:${f.dimension}`, phase: 'Review', schema: VERDICT_SCHEMA },
    ).then((v) => ({ finding: f, real: !!(v && v.isRealDefect), reasoning: v && v.reasoning })),
  ),
)
const confirmedReviewDefects = verified.filter((x) => x && x.real)

log(`refine-cycle done: ${okItems.length} built, ${failedItems.length} failed, ${confirmedReviewDefects.length} confirmed defect(s)`)

return {
  integratedBranch: integration ? integration.integratedBranch : cycleBranch,
  checks: integration ? integration.checks : null,
  conflictedItems: integration ? integration.conflictedItems : [],
  built: okItems,
  failedItems,
  confirmedReviewDefects,
}
