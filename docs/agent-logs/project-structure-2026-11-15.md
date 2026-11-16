# Project structure specification

## Owner and agent

- Owner: Carlos Gabriel Martinez Bazaldua
- Agent: Architect

## Summary

The repository structure and documentation were reviewed before changes. The
backend and frontend had only their entry-point files, while the shared package
contained only its public index. `SPEC-002-project-structure.md` now defines
layer responsibilities, dependency direction, naming, and verification rules
for the requested backend and frontend organization.

The corresponding empty directories were created with `.gitkeep` files so the
structure is visible in Git without adding placeholder runtime code.

## Files changed

- Added `docs/specs/SPEC-002-project-structure.md`.
- Updated `docs/specs/SPEC-000-foundation.md` with the structure reference and
  TS/TSX conventions.
- Updated `README.md` with the new specification and source organization.
- Added backend, frontend, and shared architecture directories with
  `.gitkeep` files.

## Verification

The structure was reviewed against the requested responsibilities. No tests
were run before this log was written; verification is pending owner approval
for the requested validation step.
