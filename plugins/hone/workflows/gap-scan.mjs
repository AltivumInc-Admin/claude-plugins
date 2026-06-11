export const meta = {
  name: 'hone-gap-scan',
  description: 'Intent-anchored gap scan: fan out gap sensors (integrity/coherence/finish/friction) and optionally the signal scout, then synthesize one clause-grouped report. Zero gaps is a valid result.',
  phases: [
    { title: 'Sense', detail: 'fan out read-only gap sensors per sensor and focus area; optionally the signal scout per angle' },
    { title: 'Synthesize', detail: 'dedup and group gaps by intent clause into one report; route clause-less findings to signal' },
  ],
}

// Sensor -> which read-only subagent powers it, and the focus areas to fan out.
const SENSOR_CONFIG = {
  'integrity': {
    label: 'integrity (structural fidelity)',
    agentType: 'hone:codebase-analyzer',
    focuses: ['frontend layer', 'backend/API layer', 'data & infrastructure layer'],
    measure: 'Does the code soundly do what it claims? Structural fidelity — broken software serves no intent',
  },
  'coherence': {
    label: 'coherence (internal consistency)',
    agentType: 'hone:codebase-analyzer',
    focuses: ['frontend layer', 'backend/API layer', 'data & infrastructure layer'],
    measure: 'Does the implementation match the code\'s own latent design and the intent\'s shape? New threads match threads already cut',
  },
  'finish': {
    label: 'finish (surface craft)',
    agentType: 'hone:ui-auditor',
    focuses: ['typography & rhythm', 'color & contrast', 'layout & spacing', 'motion', 'component-craft & polish'],
    measure: 'Surface quality and craft, measured against what "right" feels like in the intent',
  },
  'friction': {
    label: 'friction (user-flow)',
    agentType: 'hone:codebase-analyzer',
    focuses: ['user-flow friction'],
    measure: 'What users actually hit traversing flows the intent says must be smooth',
  },
}

// 'field-specific' is omitted by design — it needs a caller-posed question this workflow does not take.
const SCOUT_ANGLES = ['category movement', 'user expectations & complaints', 'emerging platform capabilities']

const ALL = Object.keys(SENSOR_CONFIG)

// args: { path?: string, sensors?: string[], scout?: boolean, intent: string }
const requested = (args && Array.isArray(args.sensors) && args.sensors.length) ? args.sensors : ALL
let sensors = requested.filter((s) => SENSOR_CONFIG[s])
if (!sensors.length) sensors = ALL
const scout = !!(args && args.scout)
const scope = (args && args.path) ? args.path : 'the whole repository'
// Intent is contractually short (a one-sitting read, per /hone:intent); interpolated verbatim into every prompt.
const intent = (args && typeof args.intent === 'string' && args.intent.trim()) ? args.intent : ''
if (!intent) {
  // Same shape as the success return so callers can destructure safely.
  return { error: 'no intent provided — the work is not mounted; author .altivum/intent.md first (/hone:intent)', scope, sensors, report: null, signal: [] }
}

log(`gap-scan: ${sensors.length} sensor(s)${scout ? ' + scout' : ''} over ${scope}`)

phase('Sense')
const senseTasks = sensors.map((name) => async () => {
  const cfg = SENSOR_CONFIG[name]
  const results = await parallel(
    cfg.focuses.map((focus) => () =>
      agent(
        `You are the "${name}" gap sensor (${cfg.measure}).\n\n` +
          `THE PROJECT'S INTENT (measure against THIS, citing clauses):\n${intent}\n\n` +
          `Analyze ${scope} for the "${focus}" focus. ` +
          (name === 'finish' ? `First discover the UI stack (config, theme/tokens, representative components), then audit your dimension. ` : ``) +
          `Report gaps (each citing its intent clause), matches, and clause-less signal, for this focus only; do not rank. ` +
          `Zero gaps is a valid reading — never manufacture findings.`,
        { label: `${name}:${focus}`, phase: 'Sense', agentType: cfg.agentType },
      ).then((text) => ({ focus, text })),
    ),
  )
  // Pair each finding with its focus BEFORE filtering, so a null/failed agent
  // result can be dropped without shifting the remaining focus labels.
  return { kind: 'sensor', sensor: name, label: cfg.label, findings: results.filter((r) => r && r.text) }
})
const scoutTask = async () => {
  const results = await parallel(
    SCOUT_ANGLES.map((angle) => () =>
      agent(
        `You are the signal scout for the "${angle}" angle.\n\n` +
          `THE PROJECT'S INTENT (context only — your output is evidence, never work):\n${intent}\n\n` +
          `First skim the repo at ${scope} (README/manifests/routes) to write yourself a one-line positioning. ` +
          `Then gather live, cited evidence for your angle. Evidence only — no recommendations.`,
        { label: `scout:${angle}`, phase: 'Sense', agentType: 'hone:signal-scout' },
      ).then((text) => ({ angle, text })),
    ),
  )
  return { kind: 'scout', findings: results.filter((r) => r && r.text) }
}

const sensed = await parallel(scout ? [...senseTasks, scoutTask] : senseTasks)
const sensorResults = sensed.filter(Boolean).filter((r) => r.kind === 'sensor' && r.findings.length)
const scoutResult = sensed.filter(Boolean).find((r) => r.kind === 'scout')
const scoutSignal = scoutResult ? scoutResult.findings : []

phase('Synthesize')
const dossier = sensorResults
  .map(
    (s) =>
      `### Sensor: ${s.label}\n` +
      s.findings.map((f) => `#### Focus: ${f.focus}\n${f.text}`).join('\n\n'),
  )
  .join('\n\n---\n\n')

if (!sensorResults.length) {
  // Distinct degraded state: every sensor failed or was skipped. NEVER emit the
  // zero-gap success sentence here — a failed scan is not a clean repo.
  return { error: 'gap-scan collected no sensor output — every sensor failed or was skipped; results are not trustworthy', scope, sensors, report: null, signal: scoutSignal }
}

const report = await agent(
      `You are synthesizing an intent-anchored gap scan of ${scope}.\n\n` +
        `THE PROJECT'S INTENT:\n${intent}\n\n` +
        `SENSOR READINGS (${sensorResults.length} sensor(s)):\n\n${dossier}\n\n` +
        `Produce ONE gap report:\n` +
        `- ENFORCE the clause-citation rule: keep only gaps whose intent-clause citation is specific and honest. A stretched or decorative citation (a broad clause invoked to legitimize an unrelated finding) is NOT a gap — move it to the Signal section with a note. When in doubt, demote to signal.\n` +
        `- Dedup overlapping gaps across sensors; when multiple sensors flag the same deviation, mark it — strong signal of a real gap.\n` +
        `- Group gaps BY INTENT CLAUSE (the clause is the heading; quote it).\n` +
        `- Rank within and across clauses by fidelity-gained-per-effort. Number every gap with stable ids (1, 2, 3 …) so "plan 2 4" works.\n` +
        `- Each gap: Title · Clause (quoted) · What deviates & evidence (file:line) · Proposed quarter-turn · Turn size (small/medium/large) · Sensor(s).\n` +
        `- Then a "Matches" line or two (where the code already embodies the intent).\n` +
        `- Then "Signal (not actionable)": every clause-less observation from the sensors, briefly.\n` +
        `- If there are NO honest gaps, say exactly: "No gaps found against intent at current resolution." — that is a successful scan; do not pad.\n` +
        `- End by telling the user to pick gap numbers (in /hone:loop) or run /hone:plan <numbers> then /hone:execute.`,
      { label: 'synthesize', phase: 'Synthesize' },
)

if (!report) {
  // Synthesis agent failed — preserve the sensors' work for the caller instead of dropping it.
  return { error: 'synthesis agent failed — raw sensor dossier preserved in the dossier field', scope, sensors, report: null, dossier, signal: scoutSignal }
}

return { scope, sensors, report, signal: scoutSignal }
