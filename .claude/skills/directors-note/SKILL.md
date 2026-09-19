---
name: directors-note
description: Normalize informal user feedback, ideas, observations, and exploratory project direction into a concise proposed Director Note.
---

# Director Note Intake

Use this skill when the user invokes `/directors-note` or asks to turn informal
project feedback into a Director Note.

The user's input may be conversational, repetitive, incomplete, or speculative.

Your job is to edit and normalize it without changing its meaning.

## Process

1. Do not implement the idea.
2. Do not modify canonical project documentation.
3. Rewrite the input into a concise proposed Director Note.
4. Preserve uncertainty.
5. Do not turn possibilities into requirements.
6. Give the note a short descriptive title.
7. Use concise prose and bullets where useful.
8. Assign an appropriate status such as:
   - Exploratory
   - Feedback
   - Possible direction
   - Approved direction
9. Show the proposed note to the user.
10. Wait for explicit approval before appending it to `DIRECTOR_NOTES.md`.
11. Never silently promote the note into SPEC.md, ARCHITECTURE.md, ROADMAP.md,
    TODO.md, or implementation work.
12. Do not delete or rewrite previous Director Notes merely because later
    thinking supersedes them. Record later decisions separately when
    appropriate.

## Example

Raw input:

"homepage kinda feels like too much info maybe search should be the main thing
and there could be one main takeaway but don't change it yet"

Proposed note:

### Homepage information hierarchy

**Status:** Exploratory

Explore simplifying the initial homepage experience.

Consider:

- Making location search more prominent.
- Reducing the number of metrics initially visible.
- Highlighting one primary affordability takeaway.

Do not implement yet.
