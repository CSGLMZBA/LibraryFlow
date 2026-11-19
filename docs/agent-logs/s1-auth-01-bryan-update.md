# S1-AUTH-01 - Authentication integration

## Purpose

Complete the Sprint 1 authentication boundary without adding unassigned reader,
publisher, or moderation features.

## Changes

- Added a development-only local seeded moderator fixture.
- Added HTTP registration/login validation for SPEC-001.
- Added Firebase Admin token verification and role custom claims.
- Added auth registration, login, logout, and session endpoints.
- Created a cloud adapter that preserves the local `AuthPort` interface.
- Added credential-free validation and guard tests.

## Dependencies

- Configure Firebase Authentication and Firestore.
- Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_WEB_API_KEY`.
- Use HTTPS in deployment and manage secrets through the platform dashboard.
- Integrate Dante's AuthContext with the selected cloud adapter.
- Verify Juan's routes and Jorge's moderation permissions use the server guard.

## Known risks

- Cloud endpoints require external credentials and cannot be declared live-tested without configuration.
- Cloud reload persistence depends on Firebase SDK refresh-token integration.
- The local moderator does not exist in Firebase cloud mode.

## Verification

Credential-free guard and validation tests are available in
`docs/testing/auth-validation.test.mjs`. Live evidence remains pending until
Firebase and browser verification are executed.
