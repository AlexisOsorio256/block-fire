---
name: blockfire-harness
description: >-
  Minimal frontier for changing harness/, measuring its surface and staying
  upstream-compatible with DSH.
whenToUse: >-
  When the task changes presets, host/web, the runtime resolver, the updater,
  JIT capabilities, metrics or harness tests.
---

# BLOCKFIRE Harness

Work inside `harness/`; never edit `node_modules` or the installed copy under
`$DSH_HOME`. Upstream DSH is a dependency, not a fork.

Normal flow:

1. Inspect only the code that owns the problem.
2. Make the minimal change; heavy capabilities go behind `bf_capability`.
3. `harness/install.sh` syncs repo -> installation.
4. `harness/test.sh` tests composition/runtime; use `--live` only when a real
   session supplies relevant evidence.
5. Measure the effect: `node harness/bin/context-report.mjs` for the prompt and
   tool surface (no model calls), `node harness/bin/session-report.mjs --last 1`
   for a real session's tokens and cache.

Rules:

- Persona and permanent tools stay stable and small; nothing volatile enters the
  prefix.
- Never trade a rule, a result marker or a parameter semantic for shorter text;
  cut only what duplicates, contradicts the session's real policy, or exists for
  no decision.
- Skills hold only knowledge that changes a decision, and load JIT.
- Do not add wrappers for what bash/fs already solve.
- Do not add a permanent tool for convenience; large schemas are JIT.
- No over-engineering: the smallest change that provably moves the metric.
- For composition and plugin detail, use the shipped Cordis skills.
- `harness/ARCHITECTURE.md` is frontier/risk reference, not opening reading.

Close: proportional proof, installation in sync when it applies, and an honest
report of what stayed unverified.
