# Orwell — Project structure scaffold

## Owner

Carlos Gabriel Martinez Bazaldua, Product Owner

## Scope

Created the basic project structure from `SPEC-000-foundation.md` and the
approved technical baseline in `SPEC-001.md`.

## Created areas

- `apps/frontend/`: React/Vite/TypeScript client scaffold.
- `apps/backend/`: Node.js/Express REST API boundary with a health endpoint.
- `packages/shared/`: Shared TypeScript contract package.
- Root workspace configuration and TypeScript project references.
- Root ignore rules for generated and environment-specific files.
- `docs/agent-logs/`: Agent work summaries.
- `docs/agent-prompts/`: Agent operating prompts.
- `docs/requirements/`: Project requirements.

## Deliberately not implemented

- Sprint 1 product functionality.
- Authentication, persistence, Firestore, Supabase, or IndexedDB integration.
- Feature routes, domain services, or acceptance-test suites.
- Later-sprint functionality.
- Changes to the existing README because it contains an explicit repository
  instruction prohibiting agent continuation while that text remains present.

## Verification

Structural and whitespace checks were run after creation. Dependencies were not
installed and application builds/tests were not run.
