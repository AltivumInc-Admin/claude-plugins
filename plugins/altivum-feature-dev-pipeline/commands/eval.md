---
description: Comprehensive codebase evaluation — structure, architecture, health, and prioritized, actionable recommendations.
argument-hint: "[optional area/path to scope the evaluation]"
---

# Codebase Evaluation & Analysis

Perform a thorough evaluation of the project (scoped to **$ARGUMENTS** if provided) and provide insights that demonstrate deep understanding of the codebase.

## Workflow

1. **Project Discovery** — Identify project type, framework, and stack. Read package manifests, configs, and docs (README, CLAUDE.md). Understand the build/dev/test workflow.
2. **Architecture Analysis** — Map the directory structure and patterns. Identify key components/modules and relationships, data flow, state management, API integrations, external dependencies, and the testing strategy.
3. **Code Quality Assessment** — Review patterns and consistency; look for bugs, anti-patterns, and tech debt; evaluate error handling and edge cases; assess accessibility, security, and performance opportunities. Where feasible, gather empirical ground truth (lint, typecheck, tests, build, dependency audit) and cite the output.
4. **Improvement Recommendations** — Provide 2-4 specific, prioritized, actionable recommendations with the highest impact.

## Output Format

```
PROJECT OVERVIEW
================
[Type, stack, purpose]

ARCHITECTURE UNDERSTANDING
==========================
[Key patterns, data flow, component structure]

CODEBASE HEALTH
===============
Strengths: [2-3 things done well]
Areas for Improvement: [2-3 opportunities]

RECOMMENDATIONS
===============
1. [Title]
   - What:   [Description]
   - Why:    [Value/Impact]
   - How:    [Implementation approach + specific files]
   - Effort: [Low/Medium/High]
2. ...
```

## Quality rules
- Actionable insights over generic observations. Be specific with file paths and references.
- Don't fabricate findings — verify against the actual code; if something is fine, say so in strengths.
- Respect existing patterns and constraints.

End by asking which recommendation(s) the user wants to take into the planning phase.
