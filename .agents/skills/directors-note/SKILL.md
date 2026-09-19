---
name: directors-note
description: Normalize informal user feedback, ideas, observations, and exploratory project direction into a concise proposed Director Note.
---

# Director Note Intake

Use this skill when the user invokes `$directors-note` or clearly asks to turn informal project feedback into a Director Note.

The user's input may be conversational, repetitive, incomplete, or poorly structured.

Your job is to edit and normalize it without changing its meaning.

## Process

1. Do not implement the idea.
2. Do not modify canonical project documentation.
3. Rewrite the user's input into a concise proposed Director Note.
4. Preserve uncertainty exactly:
   - "maybe"
   - "consider"
   - "explore"
   - "I'm not sure"
   must not become requirements.
5. Give the note a short descriptive title.
6. Use concise prose and bullets where useful.
7. Assign an appropriate status, such as:
   - Exploratory
   - Feedback
   - Possible direction
   - Approved direction
8. Show the proposed note to the user before writing it anywhere.
9. Only after explicit user approval, append it to `DIRECTOR_NOTES.md`.
10. Never silently promote a Director Note into SPEC.md, ROADMAP.md, TODO.md, or implementation work.
11. Do not delete or rewrite previous Director Notes merely because they were superseded. Record later decisions separately when appropriate.

## Example transformation

Raw user input:

"homepage kinda feels like too much info maybe search should be the main thing and there could be one main takeaway but don't change it yet"

Proposed Director Note:

### Homepage information hierarchy

**Status:** Exploratory

Explore simplifying the initial homepage experience.

Consider:
- Making location search more prominent.
- Reducing the number of metrics initially visible.
- Highlighting one primary affordability takeaway.

Do not implement yet.
