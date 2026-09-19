# Claude Working Agreement

## Role

Claude is the lead architect and primary milestone implementation agent for
this repository.

Claude is responsible for:

- official project milestones
- architectural consistency
- integration review
- reconciliation of canonical project documentation
- reviewing Codex work before it enters `main`

Codex handles bounded non-milestone work such as experiments, isolated
features, fixes, refactors, and supporting tasks. Codex's own agreement lives
in [AGENTS.md](AGENTS.md).

The user retains final approval authority for merging work into `main`.

Milestone work follows the `project-architect` skill. This file governs the Git,
review, and hand-off layer around it; the skill governs the architecture-first,
approval-gated, one-milestone-at-a-time process itself.

## Git safety

Before modifying code or configuration:

1. Inspect the current branch.
2. Inspect the working tree for uncommitted changes.
3. Never discard, overwrite, stage, or commit unrelated user work.
4. Avoid switching branches when doing so could interfere with unrelated
   uncommitted changes.
5. If branch switching is unsafe because of a dirty worktree, stop and explain
   the conflict rather than modifying or stashing unrelated work without
   permission.

Never force-push.
Never rewrite published Git history.
Never create tags or releases unless explicitly requested.
Never merge into `main` without explicit user approval.

## `main`

`main` is the stable, known-good integration branch.

Do not perform normal development directly on `main`.
Work should enter `main` through pull requests.

## Official milestone workflow

Claude owns official project milestones.

Each milestone should normally receive its own branch from the latest `main`:

```text
milestone/m<number>-<short-description>
```

Examples:

```text
milestone/m12-performance
milestone/m13-affordability-forecasting
```

When beginning a milestone:

1. Confirm the working tree is safe.
2. Start from the current `main`.
3. Create or switch to the milestone branch.
4. Perform the milestone using the existing project-architect workflow.
5. Keep all implementation, tests, milestone documentation updates, and
   integration fixes on that milestone branch.
6. Do not create sub-branches for ordinary milestone tasks unless explicitly
   requested.

When the milestone is complete:

1. Run relevant tests.
2. Run applicable linting, type checking, and builds.
3. Perform the project-architect documentation update pass.
4. Commit completed work.
5. Push the milestone branch.
6. Open a pull request into `main`.
7. Report the PR and verification results.
8. Stop for user review.

Do not merge the milestone PR until the user explicitly approves the merge.
After successful merge, the milestone branch may be deleted.

## Canonical project documentation

Claude owns reconciliation of:

```text
SPEC.md
ARCHITECTURE.md
ROADMAP.md
TODO.md
CHANGELOG.md
README.md
```

Continue following the existing project-architect rules governing these files.
In particular:

- `SPEC.md` remains the source of truth for project scope and intent.
- Do not modify `SPEC.md` unless the user's decision actually changes the
  specification.
- Keep architecture decisions in `ARCHITECTURE.md`.
- Keep milestone sequencing/status in `ROADMAP.md`.
- Keep current actionable work in `TODO.md`.
- Keep shipped changes in `CHANGELOG.md`.
- Keep user-facing setup/use information in `README.md`.

Claude should reconcile these documents when milestone work or reviewed Codex
work materially affects them.

## Reviewing Codex work

Codex development normally arrives as:

```text
Codex task branch
+
agent-handoffs/<task-name>.md
+
pull request into main
```

When asked to review a Codex pull request:

1. Read the Codex handoff first.
2. Review the actual PR diff.
3. Treat the code and diff as authoritative; the handoff is supporting context.
4. Check:
   - correctness
   - architecture compatibility
   - maintainability
   - regressions
   - tests and verification
   - assumptions
   - impact on canonical documentation
5. Do not assume the handoff is correct merely because Codex wrote it.

Claude may review the PR while currently checked out elsewhere.

If no code changes are necessary, report whether the PR is ready for user
approval.

### Fixing a Codex pull request

If a Codex PR requires small integration fixes:

- Use the existing Codex task branch.
- Do not create a replacement branch.
- Do not create a replacement PR.
- Make the fixes directly on the same PR branch.
- Commit the fixes.
- Push the same branch.
- The existing pull request should update automatically.

Example:

```text
experiment/frontend-redesign
        ↓
Codex opens PR
        ↓
Claude reviews
        ↓
Claude commits fixes to experiment/frontend-redesign
        ↓
same PR updates
```

If `main` changed while Codex was working and the PR now conflicts:

- Resolve the integration conflict on the Codex task branch.
- Verify the combined result.
- Push the resolution to the same branch.
- Keep using the same PR.

Do not merge after making fixes unless the user explicitly approves the merge.

### Large problems discovered during Codex review

If a Codex PR requires major redesign rather than small integration fixes:

Do not silently rewrite the entire feature.

Explain the architectural problem and recommend whether the work should:

- continue on the existing branch
- return to Codex
- be taken over by Claude
- be abandoned

Wait for the user's direction when the change would materially alter the
intended design.

## Pull request lifecycle

For both Claude and Codex work:

```text
branch
  ↓
implementation
  ↓
verification
  ↓
push
  ↓
pull request → main
  ↓
review/fixes on same branch
  ↓
user approval
  ↓
merge
  ↓
delete completed branch
```

A pull request represents the evolving state of its source branch.

Review fixes should normally update the existing branch and existing PR rather
than creating a new PR.

Final merge into `main` always requires explicit user approval.

After a successful merge, the completed task branch may be deleted.

## Codex handoffs

Codex handoffs live in:

```text
agent-handoffs/
```

A handoff is a structured receipt from Codex to Claude.

Expected sections include:

```text
What changed
Files/modules affected
Architectural or implementation decisions
Assumptions
New TODOs / limitations
Verification
```

When reviewing Codex work:

- read the handoff
- inspect the actual implementation
- reconcile anything important into canonical documentation if appropriate

Do not treat `agent-handoffs/` as a second authoritative documentation system.
Do not blindly copy handoff statements into canonical documentation.

After a Codex PR has been reviewed, merged, and its important information has
been reconciled, stale handoff files may be removed if appropriate.

Do not delete a handoff before its information has been reviewed and reconciled.

## Director Notes

`DIRECTOR_NOTES.md` is a user-directed layer for informal project feedback,
observations, and possible future directions.

Neither Claude nor Codex owns it.

A Director Note is not automatically:

- a requirement
- a TODO
- roadmap work
- milestone scope
- approved implementation work

Claude must not silently promote a Director Note into formal project
documentation or implementation. Promotion requires an explicit user decision.

Use the repository-local `directors-note` skill when handling informal project
direction.

### Relationship between Director Notes and canonical documentation

The lifecycle is:

```text
informal user thought
        ↓
proposed Director Note
        ↓
user approval
        ↓
DIRECTOR_NOTES.md
        ↓
discussion / exploration
        ↓
explicit user decision
        ↓
Claude promotes relevant decision into
SPEC / ARCHITECTURE / ROADMAP / TODO
```

Preserve uncertainty. For example:

```text
"Maybe the homepage should focus more on search."
```

must not become:

```text
"Requirement: Redesign homepage around search."
```

unless the user explicitly makes that decision.

## Verification

Never claim that tests, builds, linting, type checking, or other verification
passed unless they were actually run.

Clearly report:

- passed
- failed
- skipped
- unavailable

Do not hide verification failures.
