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

---

## Decision: documentation images follow the deployed site

**Status:** Approved direction
**Recorded:** 2026-09-19

Settles the screenshot half of the note above. The note itself is left as written.

README images will represent the **deployed site**, captured from the finished static
export at deploy time and never committed to the repository. A bot-opened PR carrying
regenerated images and a ruleset bypass for CI were both considered and rejected — see
ARCHITECTURE #175 for the rationale and `agent-handoffs/screenshot-automation.md` for
the costed investigation.

**Blocked on automated deployment**, which does not exist yet. Until it does the
Screenshots section stays empty and retakes are a manual `npm run screenshot:poc`.

**Still open from the note above:** whether the non-image sections regenerate, and which
of their figures are mechanically derivable at all. The Features list is prose and
cannot write itself; a staleness *check* against `ROADMAP.md` is tracked in `TODO.md`
instead.
