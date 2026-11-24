# SPEC-002 Implementation Contract

This document is normative for Sprint 2 implementation. If an existing Sprint
1 implementation uses a different name, the shared `ApiResponse` shape and the
rules in this document take precedence. No agent may add a new public route or
state without updating this contract and the acceptance register.

## 1. Common API Contract

### 1.1 Transport

- API base path: `/api/v1`.
- JSON request and response bodies use UTF-8.
- Protected requests send `Authorization: Bearer <id-token>`.
- Firebase ID tokens are verified by the backend. The decoded UID is the only
  identity used for ownership checks.
- Local and test authentication must expose the same session and role
  contract. A local token must never be accepted by a deployed environment.
- Successful responses use:

```json
{ "success": true, "data": {} }
```

- Failed responses use:

```json
{
  "success": false,
  "error": { "code": "ERROR_CODE", "message": "Safe English message", "field": "optionalField" }
}
```

- `field` is present only for a field-specific validation error.
- Error messages never contain tokens, credentials, private storage URLs, or
  internal stack traces.

### 1.2 Required status codes

| Situation | Status | Error code |
|---|---:|---|
| Invalid JSON | 400 | `INVALID_JSON` |
| Invalid field | 400 | `VALIDATION_ERROR` |
| Missing authentication | 401 | `AUTH_REQUIRED` |
| Invalid or revoked token | 401 | `AUTH_INVALID` |
| Authenticated but wrong role | 403 | `FORBIDDEN` |
| Authenticated but banned/deletion-pending | 403 | `ACCOUNT_RESTRICTED` |
| Resource does not exist or is not visible | 404 | `NOT_FOUND` |
| Duplicate active record | 409 | `DUPLICATE_RESOURCE` |
| Meaningful revision conflict | 409 | `REVISION_CONFLICT` |
| Invalid state transition | 409 | `INVALID_STATE` |
| Unexpected server failure | 500 | `INTERNAL_ERROR` |

### 1.3 Authentication and roles

The only Sprint 2 roles are `reader`, `publisher`, and `moderator`. A public
registration request may create only `reader` or `publisher-applicant`
account state. It may never set the `publisher` role or upload permission.
Role claims are changed only by an authenticated administrator/moderator
operation on the server.

Every protected handler must perform all of these checks in order:

1. Verify the token.
2. Load the account by token UID.
3. Reject an account with `deletionRequestedAt` or an active ban.
4. Check the required role.
5. Check resource ownership and current resource state.

## 2. Publisher Application Contract

### 2.1 Data model

Collection: `publisherApplications/{applicationId}`.

```ts
type PublisherApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired";

type PublisherApplication = {
  id: string;
  applicantUid: string;
  publisherName: string;
  legalRepresentativeName: string;
  independentPublisher: boolean;
  publisherEmail: string;
  website?: string;
  status: PublisherApplicationStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  expiresAt: string;
  reviewerUid?: string;
  decisionReason?: string;
  revision: number;
};
```

`expired` is a terminal application status. It resolves the inconsistency
between US-REA-013 and the original status list. Expiration never grants
publisher privileges and leaves the account as `reader`.

Validation:

| Field | Rule |
|---|---|
| `publisherName` | required, trimmed, 1-100 characters |
| `legalRepresentativeName` | required, trimmed, 1-100 characters |
| `independentPublisher` | required boolean |
| `publisherEmail` | required valid email, maximum 50 characters |
| `website` | optional valid `https` URL, maximum 200 characters |
| `decisionReason` | required for rejection/revocation, 1-500 characters |

The default 25-character field rule does not override the explicit limits in
this table. All text is trimmed before validation and persistence.

### 2.2 State transitions

| Current | Action | Next | Actor | Side effects |
|---|---|---|---|---|
| none | submit | `pending` | authenticated reader | one application, `expiresAt = createdAt + 30 days` |
| `pending` | approve | `approved` | moderator/admin | transaction sets role claim to `publisher`, audit, notification |
| `pending` | reject | `rejected` | moderator/admin | reason, audit, notification; role remains `reader` |
| `pending` | withdraw | `withdrawn` | applicant | audit; role remains `reader` |
| `pending` | expire | `expired` | scheduled worker | audit, notification; role remains `reader` |

No terminal state may transition to another state. A reader may submit a new
application only after `rejected`, `withdrawn`, or `expired`. An account with
an `approved` application may not submit another application.

### 2.3 Routes

| Method | Route | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/publisher-applications` | reader | application fields | `201 PublisherApplication` |
| GET | `/publisher-applications/me` | reader | none | `200 PublisherApplication[]` |
| POST | `/publisher-applications/:id/withdraw` | applicant reader | `{ revision }` | `200 PublisherApplication` |
| GET | `/moderation/publisher-applications?status=pending` | moderator | query status | `200 PublisherApplication[]` |
| POST | `/moderation/publisher-applications/:id/approve` | moderator | `{ revision }` | `200 PublisherApplication` |
| POST | `/moderation/publisher-applications/:id/reject` | moderator | `{ revision, reason }` | `200 PublisherApplication` |
| POST | `/moderation/publishers/:uid/revoke` | moderator | `{ reason }` | `200 { uid, role: "reader" }` |

Duplicate active submission returns `409 DUPLICATE_RESOURCE`. Approval is one
Firestore transaction: it checks `pending` and `revision`, writes the
application, account role, audit record, and notification or writes none of
them. A failed transaction cannot partially grant a role.

## 3. Revision and Synchronization Contract

All mutable Sprint 2 records contain `revision`, starting at `1`. A mutation
must include the client-observed `revision`. The server transaction succeeds
only when the stored revision equals the supplied revision, then increments it
by one.

Conflict response:

```json
{
  "success": false,
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "The record changed. Reload it before retrying."
  },
  "data": {
    "resourceId": "id",
    "serverRevision": 4,
    "serverValue": {}
  }
}
```

The implementation must preserve the server value and must not silently apply
the client value. IndexedDB queues offline mutations with stable IDs. Replay is
idempotent by mutation ID. A successful replay removes the queue item; a
conflict remains visible to the user and is not retried indefinitely.

## 4. Books and Storage

Book status is `pending | approved | rejected | deleted`. Only `publisher`
may create or update an owned book. A `publisher-applicant`, `reader`, banned
account, revoked publisher, or deletion-pending account receives
`403 FORBIDDEN` or `403 ACCOUNT_RESTRICTED`.

Required book constraints:

- title: 1-100 characters;
- author/name: 1-100 characters;
- description: 1-2000 characters;
- file type: EPUB or PDF;
- file size: at most 20 MB;
- owner UID is taken from the token, never from request data;
- access key is generated server-side from normalized title and author plus a
  collision-safe suffix.

Supabase bucket `book-files` is private. Object key:
`books/{bookId}/{revision}/{sanitizedOriginalName}`. The browser never receives
a service-role key or a permanent public URL. Any temporary download URL is
generated server-side only for an authorized reader and expires within 10
minutes.

Book routes:

| Method | Route | Auth |
|---|---|---|
| POST | `/books` | publisher |
| PATCH | `/books/:id` | owner publisher or moderator |
| POST | `/moderation/books/:id/approve` | moderator |
| POST | `/moderation/books/:id/reject` | moderator |
| DELETE | `/moderation/books/:id` | moderator |

Rejection leaves the object private and creates one deletion job due 24 hours
after rejection. Permanent deletion marks the record `deleted`, removes all
metadata exposed to ordinary users, and creates an immediate cleanup job.

### 4.1 Book file upload and signed download (S2-T07)

> **Status: Approved on 2026-11-23.** Proposed by Jorge Enriquez Rico
> (S2-T07) in PR #27. Approved by Juan Carlos Zuniga Alfaro (route and DTO
> owner) and Carlos Gabriel Martinez Bazaldua (integration owner); PR #27
> merged into `develop`.

Book files never pass through the API. The browser uploads directly to the
private bucket through a server-issued signed upload URL, then asks the API to
verify the stored object. Every route below performs the §1.3 checks in order.

| Method | Route | Auth |
|---|---|---|
| POST | `/books/:id/file/upload-url` | owner publisher |
| POST | `/books/:id/file/complete` | owner publisher |
| GET | `/books/:id/file/download-url` | authenticated account allowed to read the book |

`POST /books/:id/file/upload-url`

```ts
type BookFileUploadUrlRequest = {
  fileName: string;            // original name, 1-255 characters
  fileType: "epub" | "pdf";    // must match the file name extension
  fileSizeBytes: number;       // integer, 1 to 20 MB (BOOK_MAX_FILE_SIZE_BYTES)
  revision: number;            // client-observed book revision
};

type BookFileUploadUrlResponse = {
  objectPath: string;          // books/{bookId}/{revision}/{sanitizedOriginalName}
  uploadUrl: string;           // single-object signed upload URL
};
```

- The book must be `pending`; otherwise `409 INVALID_STATE`.
- A stale `revision` returns `409 REVISION_CONFLICT` (§3).
- Invalid name, type, extension, or size returns `400 VALIDATION_ERROR` with
  `field`.
- `sanitizedOriginalName` keeps only `[A-Za-z0-9._-]`, replaces other
  characters with `-`, and keeps the `.pdf` or `.epub` extension.
- The upload URL is valid only for `objectPath`, cannot overwrite an existing
  object, and its lifetime is set by Supabase. It contains no service-role key.
- The browser uploads with `PUT uploadUrl`, the raw file as the body, and
  `Content-Type: application/pdf` or `application/epub+zip`.

`POST /books/:id/file/complete`

```ts
type BookFileCompleteRequest = {
  objectPath: string;          // value returned by upload-url
  revision: number;            // same revision sent to upload-url
};
// 200: { success: true, data: Book } with revision incremented by one
```

- The server reads the object metadata from Supabase. A missing object returns
  `409 INVALID_STATE`. An object larger than 20 MB or with a MIME type that
  does not match `fileType` is deleted and returns `400 VALIDATION_ERROR`.
- `objectPath` must start with `books/{bookId}/{revision}/`; otherwise
  `400 VALIDATION_ERROR` with `field: "objectPath"`.
- On success the book stores `fileObjectPath`, the verified `fileSizeBytes`,
  and `fileType`, and increments `revision`. A replaced previous object is
  queued for deletion under §5 (`kind: "deleted-book-file"`).

`GET /books/:id/file/download-url`

```ts
type BookFileDownloadUrlResponse = {
  downloadUrl: string;         // signed URL for one object
  expiresAt: string;           // ISO timestamp, at most 10 minutes from issue
};
```

- Any authenticated, non-restricted account may request an `approved` book.
- The owner publisher and moderators may also request a `pending` or
  `rejected` book.
- A `deleted` book, a book without `fileObjectPath`, or a book the requester
  cannot read returns `404 NOT_FOUND`.

Shared type change (owner: Juan): `Book` gains optional
`fileObjectPath?: string`, the object key inside the private bucket. It is not
a URL and grants no access without a signed URL. `Book.fileUrl` stays an empty
string and must never contain a storage URL.

Bucket configuration (applied with the service-role key by the operations
owner, never from the browser): `public: false`,
`file_size_limit: 20971520`, and
`allowed_mime_types: ["application/pdf", "application/epub+zip"]`. The bucket
limits are the enforcement point for direct uploads; the `complete` check is
the second line of defense.

Storage provider failures return `500 INTERNAL_ERROR` with a safe message.
Signed URLs, tokens, and the service-role key are never logged.

## 5. Deletion Jobs

Collection: `deletionJobs/{jobId}`.

```ts
type DeletionJob = {
  id: string;
  kind: "rejected-book-file" | "deleted-book-file" | "account-data";
  targetId: string;
  dueAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  claimedAt?: string;
  completedAt?: string;
};
```

Workers claim a `pending` or retryable `failed` job in a transaction by writing
`processing` and a claim timestamp. A completed job is never processed again.
Failures increment `attempts`, store a safe error, and schedule exponential
backoff. Jobs are not deleted from the database, so cleanup is auditable and
idempotent.

## 6. Account, Session, Ban, and Audit Contract

Account deletion:

- `POST /account/deletion-request` sets `deletionRequestedAt` and
  `permanentDeletionAt = now + 30 days`;
- personal public fields are removed immediately;
- login and token refresh return `403 ACCOUNT_RESTRICTED` during the grace
  period;
- `POST /account/deletion-cancel` creates a pending moderator-review request during the grace period; it never restores the account;
- the scheduled worker permanently removes account-owned personal data after
  `permanentDeletionAt`;
- `POST /moderation/accounts/:uid/restore` is moderator-only and audited.

Session routes:

| Method | Route | Behavior |
|---|---|---|
| POST | `/auth/refresh` | returns a refreshed session through the auth adapter |
| POST | `/auth/logout` | revokes refresh/session tokens and clears local session |
| POST | `/account/deletion-request` | starts the deletion grace period |
| POST | `/account/deletion-cancel` | submits cancellation for moderator approval (202) |
| GET | `/moderation/account-recovery-requests` | moderator-only pending requests |

Ban records require `actorUid`, `targetUid`, `reason`, `startsAt`, and either
`endsAt` or `permanent: true`. Active bans block comments, uploads, moderation
targets, and authenticated restricted actions. Every ban, lift, revocation,
deletion, restore, and application decision writes an immutable audit record
with actor, target, reason, action, and timestamp.

## 7. Notifications

Collection: `notifications/{notificationId}` with a unique idempotency key
`{recipientUid}:{eventType}:{resourceId}:{resourceRevision}`.

Sprint 2 notification types:
`publisher_application_approved`, `publisher_application_rejected`,
`publisher_application_expired`, `publisher_revoked`, `book_rejected`,
`book_deleted`, `account_restored`, `ban_changed`.

Notifications are private to the recipient, created in the same transaction as
the decision where possible, and never contain private file URLs or another
user's data.

## 8. Environment and Deployment Contract

Required backend environment variables:

```text
NODE_ENV
PORT
FRONTEND_ORIGIN
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_BOOK_BUCKET
DELETION_WORKER_SECRET
```

Required frontend variables contain only public configuration:

```text
VITE_API_BASE_URL
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
```

No service-role key, Firebase private key, worker secret, or database
credential may use a `VITE_` name or appear in source control.

`GET /health` returns the existing `HealthResponse`. It must be unauthenticated
and return HTTP 200 only when the process is ready to serve. CORS allows only
the configured `FRONTEND_ORIGIN` values, never `*` in production.

`FRONTEND_ORIGIN` is a comma-separated list of exact origins
(`scheme://host[:port]`, no path, no wildcard). When `NODE_ENV=production`,
the backend refuses to start if `FRONTEND_ORIGIN` is empty or contains `*` or
a wildcard host. Outside production, an empty value defaults to
`http://localhost:5173`. Requests from other origins receive no CORS headers,
and their preflight requests are answered without them.

The Sprint 1 names `CORS_ORIGIN` and `SUPABASE_BUCKET` are replaced by
`FRONTEND_ORIGIN` and `SUPABASE_BOOK_BUCKET` (S2-T07). The old names are not
read.

## 9. Sprint 2 Work Handoffs and Verification

| Owner | Deliverable | Handoff condition |
|---|---|---|
| Bryan | auth/session/account restriction | shared auth result and error codes |
| Juan | applications, repositories, revisions, DTOs | shared types and transaction tests |
| Karlo | reader application/status UX | consumes application DTOs only |
| Dante | application/admin review UX | consumes application DTOs only |
| Jorge | storage/jobs/deployment | environment matrix and health evidence |
| Cesar | acceptance/security suites | dated evidence mapped to S2-AC IDs |
| Carlos | integration/demo/sign-off | merged branch and complete evidence |

Required local verification before handoff:

```text
npm run typecheck
npm run build
npm test
```

Each owner must also provide focused tests for their contract and update the
matching row in `S2-ACCEPTANCE-REGISTER.md` only after execution.

## 10. Bryan's auth/account clarification (S2-T01 and S2-T06)

This amendment was requested by Bryan for review in his PR. It retains the
existing Bearer-only transport consumed by the open S2-T04 applicant UI PR;
no new session header or shared domain DTO is required. The earlier
S2-AUTH-ACCOUNT-PROPOSAL.md is superseded for this increment by this section.

### 10.1 Authoritative account and session state

`accounts/{encodedUid}` stores uid, integer revision, updatedAt and optional
deletionRequestedAt, permanentDeletionAt, deletionJobId, tokensValidAfter
(Unix milliseconds), publicRedactionPending, and ban. Ban embeds the fields
already specified in section 6; writing ban records remains the moderation
owner's responsibility. Missing account documents are migrated only when a
recent, verified Firebase sign-in bootstraps a session. A failed Firestore read
never falls back to unrestricted local data. Role claims stay in Firebase.

`authSessions/{sha256(uid + ":" + auth_time)}` stores uid, authTime and issuedAt
(from verified Firebase auth_time/iat), tokenDigest (SHA-256), integer revision,
lastActivityAt (Unix milliseconds) and optional revokedAt. No raw token or
password is stored in these records. Devices signed in within the same
Firebase auth_time second share this conservative revocation boundary; logout
revokes the account's Firebase refresh tokens and all application sessions via
tokensValidAfter. Immediate same-second re-login may require a retry after the
next second to avoid accepting a pre-logout credential.

Expired/unknown sessions cannot be revived by refresh. GET /auth/session may
bootstrap only a verified sign-in younger than 30 minutes; an existing expired
session is never replaced by that read. Protected user actions and explicit
POST /auth/refresh touch lastActivityAt; passive /auth/session checks and
background SDK refresh do not. At exactly 30 minutes inactivity the backend
returns 401 AUTH_INVALID. Local IndexedDB mode uses the same idle boundary.

A newer verified iat advances the accepted digest transactionally. An older
token or a different digest with the same iat is rejected. When Firebase
returns the identical token within the same second, refresh is a no-op for
token replacement: TC-S2-045 checks old-token rejection after a genuinely newer
iat rather than assuming two immediate SDK calls always produce distinct JWTs.
The synchronous getAccessToken(): string | null API is preserved for Dante;
Firebase's onIdTokenChanged updates its cache, and server checks remain
mandatory on every protected request.

### 10.2 Account deletion and recovery proof

POST /account/deletion-request requires a verified bearer and `{confirm:true}`.
The restriction, 30-day deadline, immutable audit entry, account-data deletion
job and deduplicated confirmation-email outbox record are written atomically.
The response is `{deletionRequestedAt, permanentDeletionAt, revision,
emailStatus:"queued"}`. Queued is not sent: actual outbound delivery is an
explicit platform handoff. Failed public redaction fails the request safely;
publicRedactionPending prevents restoration until cleanup completes and the
same verified request can retry interrupted cleanup before token revocation.

Public profiles, comment names/content and published account-owned book views
are redacted/hidden without restoring them automatically on cancellation.
The in-memory Sprint 1 repositories and matching Firestore profiles/comments/
books paths use idempotent redaction hooks. Future cloud repositories must
preserve the same visibility restriction. The permanent worker belongs to
S2-T08; this increment creates its existing account-data job, not a new worker.

POST /account/deletion-cancel accepts `{email,password}` verified by Firebase
solely to submit a recovery request. HTTP 202 returns a pending request; it
never clears restrictions, cancels the deletion job or issues an ordinary
session. Repeated submissions for the same deletion job are idempotent.
The private `accountRecoveryRequests/{id}` record contains id, targetUid,
deletionJobId, status (pending/approved), createdAt, permanentDeletionAt and
revision. Submission writes an immutable audit entry atomically.

Login returns `403 ACCOUNT_RESTRICTED` with `error.recoveryAvailable:true`
only for a verified account pending deletion. The sign-in screen then offers
"Request deletion cancellation"; wrong credentials and bans alone do not
expose this action. A successful submission displays pending moderator review.

GET /moderation/account-recovery-requests requires an active moderator and
returns at most 100 pending requests with accountRevision and canRestore.
The moderator dashboard loads this queue and confirms an approval explicitly.
POST /moderation/accounts/:uid/restore requires an active moderator,
`{revision}` and a pending request matching the active deletion job. Wrong roles
receive 403 FORBIDDEN and stale revisions receive 409 REVISION_CONFLICT.
Approval is allowed only when now < permanentDeletionAt, redaction has finished
and the cleanup job is still pending. The transaction clears lifecycle flags,
closes the job with cancellation metadata, approves the request with reviewer
and time, increments revisions, and writes audit and account_restored
notification. A concurrent claimed/completed worker prevents restoration.
Old credentials stay invalid; a fresh login is required and bans remain
enforced. An already removed Firebase identity cannot be reconstructed here.

`accountAudit/{eventId}` is immutable and created transactionally, containing
actorUid, targetUid, reason, action and timestamp. `accountEmailOutbox/{eventId}`
contains the private recipient, uid, creation time, deletion deadline, kind and
pending delivery status. It must be readable only by the trusted delivery
worker. Account, session, audit, notification and outbox collections must deny
all direct browser writes; Admin SDK backend access is authoritative.

The account lifecycle services expose backend hooks. Sign-in recovery and
moderator approval consume these URLs. Account-settings, email dispatcher and
permanent-worker integration still require their owners' verification. S2-AC-009 remains Pending until the required live evidence exists.
