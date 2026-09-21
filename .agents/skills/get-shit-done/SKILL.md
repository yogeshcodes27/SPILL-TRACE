---
name: get-shit-done
description: "Get Shit Done (GSD): Spec-driven, atomic-phased development framework. Use when planning complex features, managing multi-step workflows, preventing context rot, and verifying implementations."
---

# Get Shit Done (GSD) Framework

GSD turns ambiguous feature requests into predictable, verifiable, spec-driven outcomes. It eliminates context degradation and rambling by enforcing atomic work phases and explicit verification gates.

---

## The GSD Workflow Cycle

Every substantial feature or refactoring follows four phases:

### Phase 1: Discuss & Scope
- Clarify requirements, constraints, and success criteria.
- Identify edge cases, impacted files, and non-goals.
- Keep context lean: summarize decisions in a lightweight spec rather than re-reading large files repeatedly.

### Phase 2: Spec & Plan
- Create or update the roadmap breakdown into atomic tasks (15–30 minute increments).
- Define unambiguous verification criteria for each phase:
  - What automated tests or linting must pass?
  - What visual or functional checks confirm completion?

### Phase 3: Atomic Execution
- Execute one task/phase at a time.
- Make targeted, discrete modifications.
- Avoid scope creep — if new requirements arise, queue them for the next phase instead of deviating mid-stream.

### Phase 4: Verify & Checkpoint
- Run the verification steps (test, build, or live check).
- Confirm changes function as specified.
- Checkpoint progress cleanly so the next phase starts from a stable, known state.

---

## GSD Slash Directives

- `/gsd:plan <feature>`: Break down a feature request into atomic phases with clear verification gates.
- `/gsd:execute <phase>`: Implement the designated phase strictly within its specified boundary.
- `/gsd:verify`: Run the verification criteria and report test/build status.
- `/gsd:status`: Summarize completed phases, current phase, and remaining backlog.
