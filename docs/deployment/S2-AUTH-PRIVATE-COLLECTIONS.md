# Sprint 2 private authentication collections

Account/session policy uses trusted Firebase Admin SDK backend operations.
Before deployed testing, the platform owner must merge the following deny
matches into the project's actual Firestore rules. They are a deployment
handoff, not proof the live rules were changed or deployed:

```text
match /accounts/{document=**} { allow read, write: if false; }
match /authSessions/{document=**} { allow read, write: if false; }
match /accountRecoveryRequests/{document=**} { allow read, write: if false; }
match /accountAudit/{document=**} { allow read, write: if false; }
match /accountEmailOutbox/{document=**} { allow read, write: if false; }
match /auth-display-name-reservations/{document=**} { allow read, write: if false; }
```

Firestore permissions are additive. These matches do not override a broader
allow rule; the platform owner must remove any overlapping public allow on
these paths. Deploy and verify denied unauthenticated and authenticated browser
reads/writes against the real project or emulator. Admin SDK workers must use
least-privilege service credentials and never expose them to Vite.

accountEmailOutbox messages are private and pending. A delivery worker/provider
must claim/deduplicate them by document ID and record sent or failed accurately.
No provider is configured by this PR and no email was actually sent in tests.
The deletion worker must transactionally claim only pending account-data jobs
and never execute completed jobs containing cancellation metadata.
