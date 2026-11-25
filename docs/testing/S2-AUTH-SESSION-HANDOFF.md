# S2-T01 / S2-T06 implementation handoff

Owner: Bryan Alessandro Peralta Gutierrez. Scope: Sprint 2 only.
Status: Backend implementation and automated checks ready for review; live
acceptance and cross-owner integrations remain pending.

## Contract change

SPEC-002-CONTRACTS.md section 10 now defines the account/session records,
30-minute idle boundary, bearer-token rotation, deletion confirmation, recovery
requests and moderator approval, redaction, audit and email-outbox handoff. Bryan explicitly authorized
this amendment. The PR must disclose it for integration-owner review.

The public transport remains Authorization: Bearer <id-token>. No new header
or application session ID must be added by Dante's PR #18. getAccessToken()
returns string | null synchronously, as that PR expects. The Firebase SDK
onIdTokenChanged listener updates its token cache. Backend verification remains
authoritative; a cached token is never proof of access by itself.

## Configuration

Cloud frontend uses VITE_AUTH_MODE=cloud, VITE_API_BASE_URL,
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN and VITE_FIREBASE_PROJECT_ID.
Backend uses the existing Firebase project, Admin credentials and
FIREBASE_WEB_API_KEY. Use the same project and enable email/password login.
Secrets never belong in VITE_ variables. Firestore must be available; policy
reads fail closed instead of falling back to memory.

All account/session/audit/outbox collections require private rules. The backend
uses Admin SDK, while browser clients have no direct writes to these records.
See docs/deployment/S2-AUTH-PRIVATE-COLLECTIONS.md before deployment.

## Implemented APIs and service hooks

| Method / URL | Proof / body | Behavior |
|---|---|---|
| POST /api/v1/auth/register | Valid registration | Reader-only claims |
| POST /api/v1/auth/login | Email/password | Restriction check and session bootstrap |
| GET /api/v1/auth/session | Verified bearer | Restore/check; does not touch idle time |
| POST /api/v1/auth/refresh | SDK-renewed bearer | Existing session check, rotation and user-activity touch |
| POST /api/v1/auth/logout | Verified bearer | Account-wide application and Firebase revocation |
| POST /api/v1/account/deletion-request | Verified bearer; {confirm:true} | Restrict, redact, schedule 30-day job and queue email |
| POST /api/v1/account/deletion-cancel | {email,password} | 202 pending request; no restoration/session |
| GET /api/v1/moderation/account-recovery-requests | Active moderator | Pending queue, current revision and approval eligibility |
| POST /api/v1/moderation/accounts/:uid/restore | Active moderator; {revision} | Transactional grace-period restoration/audit/notification |

The frontend accountLifecycleService exports requestDeletion(confirm),
requestCancellation(email,password), pendingRecoveries() and
restoreAccount(uid,revision). A restricted sign-in exposes the request button
only after verified deletion-pending credentials; the moderator dashboard lists
and approves requests. Account-settings remains a separate consumer. Consumers must clear their session state after deletion and
prompt for a fresh login after recovery. Email status is queued, never sent.

SDK persistence owns refresh tokens; app session records store SHA-256 digests
only. Session families use the signed UID/auth_time. Newer iat replaces the
accepted digest; identical same-second Firebase refresh is a no-op. Account
logout revokes all existing families and can conservatively require retrying a
same-second new login after the next second. This is documented in the MD.

Public redaction removes current comment names/content, restricts book views,
redacts matching Firestore records, deletes the public profile and clears the
Firebase display name/photo. Failed cleanup remains a visible failure and
blocks restoration until successfully retried. Redacted content is not
reconstructed by restoration. Worker-claimed jobs and the exact 30-day deadline
prevent cancellation. Ban flags remain authoritative after cancellation.

## Observed validation

```sh
npm run typecheck
npm run build
npm test
```

All passed. Sprint 1: 20 passed; Sprint 2: 97 passed; total 117, 0 failed.
The inherited suites still include 42 unrelated assert.ok(true) placeholders;
those are not acceptance proof. Bryan's nine session/lifecycle placeholder
cases were replaced by behavioral policy/router suites with controlled clocks,
transactional test storage and mocked Firebase/HTTP boundaries.

Focused suites include s2-account-policy.test.mjs, s2-account-routes.test.mjs,
s2-auth-lifecycle.test.mjs and s2-auth-routes.test.mjs. They cover expiry,
refresh/replay, revocation, deletion deadlines, audit/email/job creation,
restricted access, cancellation, moderator authorization, revision conflicts,
claimed-job races, public redaction and PR #18's synchronous token contract.
No Firebase/Firestore emulator or live deployed Firebase was run.

## Cross-owner handoff and limits

- Juan: merged PR #15 is preserved. Future cloud repositories must honor
  account restrictions/redaction; in-memory domain storage is not proof of
  deployed persistence. Restore does not grant publisher claims.
- Dante: open PR #18 remains unmerged and unmodified. Its synchronous token
  call is preserved. The added sign-in request and moderator approval UI use
  the lifecycle service with loading/offline/error states. Settings must use
  requestDeletion(confirm) and clear session state after deletion.
- Jorge: consume account-data deletionJobs transactionally, honor completed
  cancellation metadata and configure the trusted accountEmailOutbox delivery
  worker. This PR does not claim delivered emails, completed permanent erasure
  or recovery of already removed Firebase identities.
- Carlos/Cesar: review the MD amendment and run independent live/browsing
  evidence before accepting S2-AC-009. Outbox delivery must deduplicate by ID.
- npm audit previously reported 14 findings, including 5 high; no dependency
  security clearance or unrelated upgrade is included.

S2-AC-009 stays Pending until the real project, UI, delivery and operational
scenarios have dated evidence. A normal PR is a request for review, not a
claim that Sprint 2 or deployment is complete.


## 2026-11-22 — PR #18 merged during publication

PR #18 was merged into develop (b21b9af) while this branch was being
published. Integrated that base into Bryan's branch only. Preserved Dante's
application form, service, validation, dependencies, App navigation and logs.
Resolved the two auth-service conflicts using the persistent Firebase adapter,
which already supplies the synchronous bearer getter expected by the consumer;
removed an automatically merged duplicate optional getter declaration.
Earlier references to #18 as open describe the initial review state.

## Run the isolated browser acceptance check

From the repository root, with Node.js, Java 21, Python 3.11+, Bash and curl
available (Git Bash also works on Windows), use the same Python for both
Playwright commands. The app, auth provider and database run on loopback.
Each run uses a fresh demo project and disposable reader and moderator accounts.

```sh
npm ci
npm run build
python -m pip install playwright
python -m playwright install chromium
npx --yes firebase-tools@14 emulators:exec --project demo-libraryflow --config docs/testing/auth-emulators/firebase.json --only auth,firestore "bash docs/testing/auth-emulators/run.sh"
```

An existing Chromium installation can be selected with CHROMIUM_PATH.
The test exercises the sign-in and moderator pages, starts deletion via the
account API and simulates inactivity by backdating the reader's emulator
session. The emulator rules deny direct client reads and writes. This suite
does not verify the team's deployed rules, actual email delivery or erasure.
