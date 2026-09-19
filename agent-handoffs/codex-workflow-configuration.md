# Codex workflow configuration

## What changed

- Added a repository-level Codex working agreement.
- Added a repository-local `directors-note` skill and initialized `DIRECTOR_NOTES.md`.
- Added the `agent-handoffs/` directory for future task handoffs.
- Added a clean-worktree gate that prevents Codex from creating or switching branches while staged, modified, or untracked work is present.

## Files/modules affected

- `AGENTS.md`
- `.agents/skills/directors-note/SKILL.md`
- `DIRECTOR_NOTES.md`
- `agent-handoffs/`

No application modules were changed.

## Architectural or implementation decisions

- Canonical project documents remain under Claude's ownership unless the user explicitly requests otherwise.
- Director Notes remain non-authoritative until explicitly approved and promoted.
- Branch creation and switching require both explicit branch approval when starting from `main` and a clean working tree.
- Approval to create or switch a branch does not authorize carrying uncommitted work to that branch.

## Assumptions

- The clean-worktree rule governs Codex actions in this repository. It does not technically prevent a person or another Git client from switching branches with local changes.
- This configuration task does not require application-level tests, linting, type checking, or a production build.

## New TODOs / limitations

- Git does not provide a standard repository-local pre-checkout hook, so the dirty-worktree protection is procedural rather than a universal Git enforcement mechanism.

## Verification

- `python3 /Users/jasonli/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/directors-note` — passed (`Skill is valid!`).
- `git diff --check` on the configuration files — passed.
- Inspected the committed branch diff against `main` to confirm it contains only workflow configuration and handoff files.
- Application tests, linting, type checking, and builds were not run because application code was not changed.
