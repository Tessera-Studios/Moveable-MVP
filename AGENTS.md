<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:progress-tracking -->
# Read PROGRESS.md First

Before writing any code, read `PROGRESS.md` at the project root. It tracks exactly what has been built in each phase, where files live, and what is still pending. This prevents duplicating work, contradicting existing implementations, or missing established conventions.

After completing any phase or significant piece of work, update `PROGRESS.md` to reflect what was added.
<!-- END:progress-tracking -->

<!-- BEGIN:project-guidelines -->
# Project Guidelines

## TypeScript & Code Quality

- **Strong TypeScript** — Use strict types, avoid `any`, prefer branded types for domain primitives, and leverage discriminated unions for state machines. Every function should have explicit return types.
- **Modular architecture** — Favor small, single-purpose modules with clear boundaries. Extract shared logic into composable utilities. Keep files under ~300 lines; split when they exceed it.
- **Test-Driven Design where applicable** — Before implementing a feature or fixing a bug, write a failing test that defines success. Verify the test passes after implementation. For bug fixes: write a test that reproduces the bug first.
- **Exhaustive error handling** — Use result types (Either, Option) or custom error classes instead of throwing raw strings. Handle every branch — no silent failures.
- **No dead code** — Remove imports, variables, and functions your changes make unused. Don't leave commented-out code.

## Behavior (adapted from Karpathy-style guidelines)

### Think Before Coding

- State assumptions explicitly before implementing. If uncertain, ask.
- Present multiple interpretations when ambiguity exists — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- Stop when confused. Name what's unclear and ask for clarification.

### Simplicity First

- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

### Surgical Changes

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken. Match existing style.
- Every changed line must trace directly to the user's request.
- If you notice unrelated dead code, mention it — don't delete it.

### Goal-Driven Execution

- Transform tasks into verifiable goals with testable checkpoints.
- For multi-step tasks, lay out a plan:
  ```
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  ```
- Strong success criteria let you iterate independently. Weak criteria ("make it work") require constant clarification.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks (typo fixes, obvious one-liners), use judgment — not every change needs the full rigor.
<!-- END:project-guidelines -->
