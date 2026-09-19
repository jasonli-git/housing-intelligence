# Director Notes

This file contains user-originated feedback, observations, and possible directions.

Notes are not automatically approved requirements. Ideas must receive explicit user approval before implementation. Promotion into `SPEC.md`, `ROADMAP.md`, `TODO.md`, or milestone work requires an explicit decision.

---

## README audit and documentation auto-maintenance

**Status:** Possible direction — not approved for implementation
**Recorded:** 2026-09-19

Reduce the README's hand-maintained surface and have most of it refresh
automatically on pushes to `main`.

### Per-section intent

| Section | Intent |
|---|---|
| Status (top) | Much shorter: a summary of what is already implemented/deployed, then a few sentences on the latest of the project. Updated automatically as often as possible. |
| Screenshots | Delete the current section for now. Open question: can screenshots be automated on every push to `main`? If that works, cover desktop and mobile views. |
| Features | Keep, but keep it current on every push to `main`. |
| Sample output | Undecided. Probably removable *if* automated screenshots work out. |
| Model evaluations | Much shorter, concise, automated. Should read as a story of progression over time across existing and new evals, with links out for readers who want the evals themselves. |
| Tech Stack | Content is fine. Keep it current on every push to `main`. |
| Setup / Publishing | Audit and update automatically. |
| Project Status | Fine at its current length, since the top status section becomes much shorter. |
| Resource Requirements, Storage Footprint | Suspend for now; mark stale or outdated. Interest in automating both per push to `main`, not yet explored. |

### Also raised

- Audit whether `TODO.md` is useful, and how to make it more relevant to the
  workflow.
- Explore automating a `SPEC.md` audit.

### Open question

How much of this can actually be generated or verified on each push to `main`,
and by what mechanism. Several items above are conditional on that answer.

Do not implement yet.
