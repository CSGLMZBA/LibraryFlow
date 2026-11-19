# S1-AUTH-01 - Pre-PR verification checklist

## Automated, without Firebase

1. From the repository root, run `npm install`.
2. Run `npm run typecheck`.
3. Run `node --import tsx --test docs/testing/auth-validation.test.mjs`.
4. Save dated output and do not mark QA passed without executed evidence.

## Mock IndexedDB

1. Run `npm run dev:frontend`, open `http://localhost:5173`, and open the browser console.
2. Import `const { localAuthService: auth, seedLocalModeratorForTests } = await import('/src/services/auth-service.ts')`.
3. Register a unique reader email with a valid test password and verify `hasRole('reader')`.
4. Run `await auth.logout()` and verify `await auth.getCurrentSession() === null`.
5. Log in again and verify the session survives reload.
6. Test duplicate email, invalid format, weak password, and public `moderator` registration.
7. Create a moderator with `await seedLocalModeratorForTests('TestModerator123!')`, sign in with `moderator@libraryflow.local`, and verify the moderator role.
8. Log out. Never use a real production credential as a test password.

## Cloud mode

1. Prepare Firebase Authentication email/password and Firestore.
2. Configure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_WEB_API_KEY` securely.
3. Start the backend and frontend with `VITE_AUTH_MODE=cloud`.
4. Verify reader/publisher registration, duplicate-email `409`, invalid-login `401`, missing-token `401`, and token revocation.
5. Integrate the authentication context with the selected adapter and verify login and role rendering.
6. Verify reader/publisher/moderator route guards.
7. Record evidence for `US-REA-010` and `US-MOD-010`.

## Explicit limitations

- No Firebase keys are included in source.
- Cloud persistence after reload requires Firebase SDK/refresh-token integration.
- External credentials are required for live Firebase and Firestore verification.
