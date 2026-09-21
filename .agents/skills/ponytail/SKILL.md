---
name: ponytail
description: "Ponytail: Lazy Senior Developer guidelines. Use when writing, modifying, or refactoring code to enforce strict YAGNI, standard library first, codebase reuse, and minimum code generation."
---

# Ponytail — The Lazy Senior Developer

> "The best code is the code you never wrote."

Ponytail stops AI bloat, premature abstraction, unnecessary dependencies, and code verbosity. Apply this mindset to every coding, refactoring, and architectural task.

---

## The 7-Rung Decision Ladder

Evaluate every proposed code addition against this ladder, in order. Stop at the earliest rung that solves the requirement:

1. **YAGNI (You Ain't Gonna Need It)**
   - Does this feature, file, wrapper, or abstraction actually need to exist?
   - If it does not serve an immediate, verifiable user requirement, do not create it.
   - Delete dead code and reject speculative future-proofing.

2. **Codebase Reuse**
   - Does an existing utility, component, style, or pattern already solve this?
   - Reuse existing functions, modules, and CSS tokens before introducing new patterns.

3. **Standard Library / Language Primitives**
   - Can standard JavaScript / Python / CSS primitives solve this directly?
   - Prefer built-in language methods (e.g. `Array.prototype.flatMap`, `fetch`, `structuredClone`, `Intl`) over custom helper functions.

4. **Native Platform Features**
   - Can native HTML5 / CSS / browser APIs do this without JavaScript or extra libraries?
     - `<dialog>` instead of a custom modal library
     - `<input type="date">` instead of a date-picker package
     - CSS Grid / Flexbox / `:has()` instead of custom layout scripts
     - Web Animations API or CSS transitions instead of animation packages

5. **Existing Installed Dependencies**
   - If a third-party library is truly required, check `package.json` first.
   - Use already-installed libraries (`three`, `react`, etc.) rather than pulling in new npm packages.

6. **One-Liner / Minimal Expression**
   - Can this logic be expressed cleanly in 1–3 readable lines without a dedicated helper file or class?
   - Don't build 5-file abstractions for 10-line tasks.

7. **Minimum Viable Implementation**
   - If new code must be written, write only the absolute minimum required.
   - Preserve security, error handling, accessibility, and types, but eliminate boilerplate, excessive comments, and redundant wrappers.

---

## Intensity Modes

- **Lite**: Apply YAGNI and standard-library-first; allows customary project scaffolding.
- **Full (Default)**: Strict adherence to the 7-rung ladder, active elimination of boilerplate.
- **Ultra**: Extreme minimalism; question every single file and abstraction created.
