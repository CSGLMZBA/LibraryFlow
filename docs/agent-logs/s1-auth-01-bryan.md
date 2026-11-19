# S1-AUTH-01 - Authentication boundary

## Scope

Registration, login, passwords, sessions, roles, and guards. The visual Reader,
Publisher, and moderation UI belong to the corresponding frontend workstreams.

## Files

- `apps/frontend/src/types/auth.ts`: authentication contract and session types.
- `apps/frontend/src/schemas/auth-schema.ts`: credential and role validation.
- `apps/frontend/src/repositories/auth-indexeddb.ts`: IndexedDB users and sessions.
- `apps/frontend/src/services/auth-service.ts`: local implementation and role checks.
- `apps/backend/src/middleware/auth-guard.ts`: server-side injectable token guard.
- `docs/testing/S1-AUTH-01-TEST-PLAN.md`: verification cases and evidence.

## Security boundaries

- Local passwords use PBKDF2-SHA256 with a random 16-byte salt and 210,000 iterations.
- Public registration allows only `reader` and `publisher`.
- A locally stored role does not authorize protected REST operations.
- The backend requires a real Firebase-compatible token verifier.
- Live Firebase, Firestore, and the seeded cloud moderator require configuration.

## Verification

Frontend type checking and the offline authentication implementation are prepared.
Live browser, Express, Firebase, and Firestore verification remains credential-dependent.
