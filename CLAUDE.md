# ConquError (repo ratni-atlas) — notes for Claude

@AGENTS.md

## Claude only

- Living plan with all of Darko's decisions (items 1–67 from the ideas list, UI/UX, server):
  https://claude.ai/code/artifact/165734ed-94a2-469d-9c8f-fcf9cc122ce7 (snapshot in `docs/PLAN.md`). Do not add things he rejected there.
- The public build is https://war.deovilab.com. The old claude.ai artifact https://claude.ai/artifact/978GoCbiKGTJjrKhQnrwoS (v0.4)
  is legacy; if it is ever republished, reuse that URL.
- `git pull` at session start is done by the SessionStart hook in `.claude/settings.json`; if it fails, fix it before working.
- Claude cloud sessions cannot reach the server (egress proxy blocks SSH and unknown HTTPS) — everything server-side goes
  through GitHub Actions (`gh workflow run …`, `gh run watch`). A local desktop session uses the same path.
