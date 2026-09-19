# Codex Working Agreement

## Role

Codex handles bounded non-milestone work in this repository.

Claude is the lead architect for official milestones and owns reconciliation of the canonical project documentation.

## Branch workflow

Before modifying code, always inspect the current Git branch.

Before creating or switching any branch:

- Run `git status --short`.
- If the output is not empty, stop and tell me which staged, modified, and untracked files are present.
- Explain that uncommitted changes belong to the working tree and can follow a branch checkout.
- Do not create or switch branches until I explicitly choose how to handle the existing work: commit it on the current branch, stash it, or cancel the branch change.
- Never interpret approval to create or switch a branch as approval to carry uncommitted work onto that branch.
- Do not discard, stash, move, or commit existing work without explicit approval.
- After the chosen action is complete, run `git status --short` again and proceed only when the working tree is clean.

If currently on `main`:

- Do not begin implementation.
- Classify the requested work using one of these prefixes:

```text
feature/...     new functionality
fix/...         bug fix
refactor/...    code restructuring or performance work without intended feature changes
experiment/...  exploratory work that may not ship
docs/...        documentation-only work
```

- Suggest a short descriptive branch name.
- Ask me to approve creating/switching to that branch before changing code.

Examples:

```text
feature/county-comparison
fix/mobile-map-overflow
refactor/query-performance
experiment/frontend-redesign
docs/api-reference
```

Never implement directly on `main`.

Once assigned a branch:

- Work only on that branch.
- Do not create additional branches unless explicitly asked.
- Never merge into `main` without explicit user approval.
- Never force-push `main`, or any branch another agent or person has work
  based on. Rebasing your own unmerged task branch onto an updated `main` is
  normal and allowed — push it with `--force-with-lease`, never a bare
  `--force`.
- Never rewrite history that has already merged into `main`.
- Never create tags or releases unless explicitly requested.

## Commits

Make small, coherent commits as work progresses.

Use concise commit messages describing the actual change.

Do not ask permission before every normal commit.

## Task completion workflow

When the assigned task is complete:

1. Run the relevant tests.
2. Run applicable linting, type checking, and build verification.
3. Create or update the required handoff document.
4. Commit all completed work.
5. Push the assigned branch to `origin`.
6. Open a pull request from the assigned branch into `main`.
7. Report:
   - branch name
   - commits created
   - verification results
   - handoff file path
   - pull request
8. Stop and wait for review.

Do not merge the pull request without explicit user approval.

## Pull request lifecycle

The pull request is the integration point for the task.

After the pull request is opened:

- Keep using the same task branch for review fixes.
- If review requires changes, commit and push those changes to the same branch.
- Do not open a replacement pull request for review fixes.
- New commits pushed to the branch should update the existing pull request automatically.
- Claude or another reviewer may make integration fixes directly on the same task branch.
- If `main` changes and the task branch develops conflicts, resolve those conflicts on the task branch before merging.
- Final merge requires explicit user approval.
- After the pull request is successfully merged into `main`, the task branch may be deleted.

## Canonical documentation ownership

Do not modify these files unless I explicitly instruct you to:

```text
SPEC.md
ARCHITECTURE.md
ROADMAP.md
TODO.md
CHANGELOG.md
README.md
```

Claude owns reconciliation of these canonical project documents.

Codex may identify information that should eventually affect these documents, but that information belongs in the task handoff instead.

## Director Notes

`DIRECTOR_NOTES.md` is shared user-directed documentation and is not owned by either Claude or Codex.

A Director Note is not automatically:

- a requirement
- a TODO
- a roadmap item
- approved implementation work

Follow the `directors-note` skill whenever I provide informal feedback or explicitly invoke it.

## Handoffs

Every completed Codex development task must create:

```text
agent-handoffs/<task-name>.md
```

The handoff must contain:

```markdown
# <Task name>

## What changed

## Files/modules affected

## Architectural or implementation decisions

## Assumptions

## New TODOs / limitations

## Verification
- Commands run
- Results
```

The handoff exists so Claude can later review:

1. the actual code/diff
2. Codex's structured explanation of the work

Claude will then decide whether the canonical project documentation needs updating.

The handoff is not authoritative project documentation.

Do not silently promote information from a handoff into canonical project documentation.

## Verification

Never claim something passed unless you actually ran it.

Report failing, skipped, or unavailable verification plainly.
