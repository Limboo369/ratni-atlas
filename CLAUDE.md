# Overtake (repo ratni-atlas) — notes for Claude

@AGENTS.md

## Claude only

- The plan with all of Darko's decisions is `docs/PLAN.md` (source of truth since 24. 9. 2026; the old claude.ai living doc
  is no longer updated). Follow its phase order, mark phases done there, and do not add things he rejected.
- The public build is https://war.deovilab.com. The old claude.ai artifact https://claude.ai/artifact/978GoCbiKGTJjrKhQnrwoS (v0.4)
  is legacy; if it is ever republished, reuse that URL.
- `git pull` at session start is done by the SessionStart hook in `.claude/settings.json`; if it fails, fix it before working.
- Claude cloud sessions cannot reach the server (egress proxy blocks SSH and unknown HTTPS) — everything server-side goes
  through GitHub Actions (`gh workflow run …`, `gh run watch`). A local desktop session uses the same path.
