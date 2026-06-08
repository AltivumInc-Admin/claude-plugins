export const meta = {
  name: 'altivum-refine-cycle',
  description: 'One refine cycle: parallel worktree build of picked items, integrate + automated checks, adversarial review panel with verification',
  phases: [
    { title: 'Build', detail: 'build each picked item in its own per-cycle worktree, in parallel' },
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
      required: ['build', 'lint', 'typecheck', 'test', 'coverage'],
      properties: {
        build: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        lint: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        typecheck: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        test: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        coverage: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
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
const maxParallel = (args && Number(args.maxParallel) > 0) ? Number(args.maxParallel) : 0

if (!items.length) {
  return { error: 'no items provided', integratedBranch: cycleBranch, built: [], failedItems: [], confirmedReviewDefects: [] }
}

// Per-cycle branch prefix so item branches never collide across cycles. cycleBranch is
// already unique per cycle (refine/cycle-<N>-<slug>); sanitize it into a branch-safe token.
const cyclePrefix = cycleBranch.replace(/[^a-zA-Z0-9._-]/g, '-')

log(`refine-cycle: ${items.length} item(s) onto ${cycleBranch} from ${base}`)

// Phase 1 — build each item on its OWN per-cycle branch in its OWN worktree.
phase('Build')
const buildThunk = (it) => () =>
  agent(
    `Implement ONE refinement item in the git repo at ${repoRoot}.\n` +
      `Item id: ${it.id}\nTitle: ${it.title}\nDetails: ${it.desc || ''}\n\n` +
      `Branch to create: refine/item-${cyclePrefix}-${it.id}\n\n` +
      `Steps (use Bash; keep the change scoped to THIS item only):\n` +
      `1. Make an isolated worktree on a fresh branch. Other item builders may be creating worktrees against this SAME repo concurrently, so retry on lock/contention errors:\n` +
      `   WT=$(mktemp -d)\n` +
      `   for attempt in 1 2 3 4 5; do\n` +
      `     git -C ${repoRoot} worktree add -B refine/item-${cyclePrefix}-${it.id} "$WT" ${base} && break\n` +
      `     sleep "$attempt"   # back off; another builder likely holds the .git/worktrees lock\n` +
      `   done\n` +
      `   cd "$WT"\n` +
      `2. Implement the item with TDD (write a failing test, then make it pass), following existing project conventions.\n` +
      `3. Commit with a clear message. Do NOT remove the worktree — the integrator needs the branch.\n` +
      `4. Report status 'built' with branch refine/item-${cyclePrefix}-${it.id}, the worktree path "$WT", the commit SHA, a one-line summary, and files changed.\n` +
      `If you cannot implement it cleanly, make NO commit and report status 'failed' with a reason.`,
    { label: `build:${cyclePrefix}:${it.id}`, phase: 'Build', schema: BUILD_SCHEMA },
  )

let built = []
if (maxParallel > 0) {
  // Honor an explicit concurrency cap by building in sequential chunks.
  for (let i = 0; i < items.length; i += maxParallel) {
    const chunk = items.slice(i, i + maxParallel)
    const r = await parallel(chunk.map(buildThunk))
    built = built.concat(r)
  }
} else {
  built = await parallel(items.map(buildThunk))
}
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
    `3. Run the automated checks and record each result, citing key output:\n` +
    `   build: ${checks.build || '(auto-detect from package.json scripts / Makefile)'}\n` +
    `   lint: ${checks.lint || '(auto-detect)'}\n` +
    `   typecheck: ${checks.typecheck || '(auto-detect)'}\n` +
    `   test: ${checks.test || '(auto-detect)'}\n` +
    `   coverage: ${checks.coverage || '(auto-detect; run coverage and confirm it did NOT decrease vs ' + base + ')'}\n` +
    `   Mark a check 'not-applicable' ONLY when the project genuinely has no such step (e.g. no typechecker in a plain-JS repo). If a check is EXPECTED for this kind of project but you cannot detect or run it, mark it 'fail' and explain in notes — never pass it off as 'not-applicable'. Any non-zero run is 'fail'.\n` +
    `4. Clean up the item worktrees so they don't accumulate: for each path in [${worktreeList || 'none'}] run git -C ${repoRoot} worktree remove --force <path> (ignore errors), then ALWAYS run git -C ${repoRoot} worktree prune at the end.\n` +
    `Report the integrated branch (${cycleBranch}), all five check results (build/lint/typecheck/test/coverage), the conflictedItems list, and brief notes.`,
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
