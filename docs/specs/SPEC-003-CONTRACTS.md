# SPEC-003 Implementation Contract

For the reduced Sprint 3, the common rules and the favorites and ratings
sections below are normative only to the extent described in
[SPRINT-003.md](../sprints/SPRINT-003.md). Other feature sections are deferred
backlog contracts, not sprint requirements. Where a deferred purchase or
notification requirement conflicts with the reduced scope, the explicit
exceptions below take precedence. UI agents consume these contracts and do not
implement repositories or direct Firestore access.

## 1. Common Rules

- API base path is `/api/v1`.
- Protected requests use `Authorization: Bearer <id-token>`.
- Responses use the shared `ApiResponse<T>` envelope.
- Validation errors use `400 VALIDATION_ERROR` and include `field`.
- Missing/invalid auth uses `401 AUTH_REQUIRED` or `401 AUTH_INVALID`.
- Wrong role or ownership uses `403 FORBIDDEN`.
- Banned/deletion-pending accounts use `403 ACCOUNT_RESTRICTED`.
- Duplicate records use `409 DUPLICATE_RESOURCE`.
- Revision mismatches use `409 REVISION_CONFLICT`.
- All mutable records have a stable ID and integer `revision`.
- Mutations require the observed revision and increment it atomically.
- All timestamps are UTC ISO-8601 strings.
- All user-facing text, errors, tests, and logs are English.

The Sprint 2 publisher approval boundary remains mandatory. Only an approved
`publisher` may create or update books. Sprint 3 features never grant roles.

## 2. Collections

Collections are stored at `collections/{collectionId}` and membership is stored
at `collections/{collectionId}/members/{bookId}`.

```ts
type Collection = {
  id: string;
  ownerUid: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

type CollectionMember = {
  collectionId: string;
  bookId: string;
  addedAt: string;
};
```

Rules:

- name is required, trimmed, and 1-100 characters;
- names are unique per owner, case-insensitive;
- only approved/non-deleted books may be added;
- only the owner may create, rename, delete, add, or remove;
- another user's collection returns `403 FORBIDDEN`;
- an empty collection returns `200` with `members: []`, never `404`.

Routes:

| Method | Route | Body |
|---|---|---|
| POST | `/collections` | `{ name }` |
| GET | `/collections` | none |
| PATCH | `/collections/:id` | `{ name, revision }` |
| DELETE | `/collections/:id` | `{ revision }` |
| POST | `/collections/:id/members` | `{ bookId }` |
| DELETE | `/collections/:id/members/:bookId` | `{ revision }` |

## 3. Favorites and Notifications

Favorite document ID is deterministic: `{readerUid}_{bookId}`. Collection:
`favorites/{favoriteId}`.

```ts
type Favorite = {
  id: string;
  readerUid: string;
  bookId: string;
  createdAt: string;
};
```

Routes:

| Method | Route | Result |
|---|---|---|
| PUT | `/books/:bookId/favorite` | creates or returns existing favorite |
| DELETE | `/books/:bookId/favorite` | removes the caller's favorite |
| GET | `/favorites` | caller's available favorites only |

Favorite lists never expose another user's records. A deleted, rejected, or
hidden book is omitted from the list but the favorite may remain for audit
purposes. Re-favoriting the same book is idempotent.

Favorite update notifications are deferred; creating or removing a favorite
does not require a notification in this sprint.

## 4. Ratings

Rating document ID is deterministic: `{readerUid}_{bookId}`. Collection:
`ratings/{ratingId}`.

```ts
type Rating = {
  id: string;
  readerUid: string;
  bookId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

type RatingSummary = {
  bookId: string;
  count: number;
  average: number;
  updatedAt: string;
};
```

Authenticated readers may rate approved, available books. Purchases and the
purchase-ownership gate are deferred. The backend enforces identity, applicable
account restrictions, book availability, and ownership of rating mutations.
Create, update, and delete use a transaction to update the summary without
lost updates.

Routes:

| Method | Route | Body |
|---|---|---|
| PUT | `/books/:bookId/rating` | `{ stars, revision?: number }` |
| DELETE | `/books/:bookId/rating` | `{ revision }` |
| GET | `/books/:bookId/ratings` | none |

Invalid stars return `400 VALIDATION_ERROR`. A second create returns the
existing rating with `409 DUPLICATE_RESOURCE`; update must be used instead.
Average is rounded to two decimal places. Individual rating responses expose
the reader display name only when that public field still exists.

## 5. Publisher Follows

Follow document ID is deterministic: `{readerUid}_{publisherUid}`. Collection:
`follows/{followId}`.

```ts
type PublisherFollow = {
  id: string;
  readerUid: string;
  publisherUid: string;
  createdAt: string;
};
```

Routes:

| Method | Route | Result |
|---|---|---|
| PUT | `/publishers/:publisherUid/follow` | creates or returns existing follow |
| DELETE | `/publishers/:publisherUid/follow` | removes caller's follow |
| GET | `/follows` | caller's approved publisher follows |

The target must currently have approved `publisher` status. Following is never
used as an authorization check. Follow records are private to the reader.
Publisher update notification key:
`publisher-update:{readerUid}:{publisherUid}:{bookId}:{bookRevision}`.

## 6. Prices, Credits, and Dummy Purchases

Prices are stored on the book as integer `priceCents`, never floating-point
dollars. `priceCents` must be an integer from `0` through `99999999`. UI
displays USD with two decimal places.

Routes:

| Method | Route | Auth | Body |
|---|---|---|---|
| PUT | `/books/:bookId/price` | owner publisher | `{ priceCents, revision }` |
| POST | `/credit-requests` | authenticated user | `{ amountCents }` |
| GET | `/credit-requests/me` | authenticated user | none |
| POST | `/moderation/credit-requests/:id/approve` | moderator | `{ revision }` |
| POST | `/moderation/credit-requests/:id/reject` | moderator | `{ revision, reason }` |
| POST | `/books/:bookId/purchase` | authenticated reader | `{ revision? }` |
| GET | `/purchases` | authenticated reader | none |

Credit requests use `amountCents` as a positive integer from 1 through
100000000, with status `pending | approved | rejected`. A rejection reason is
required. Approval and balance update are one transaction. A reader may
purchase a book once; a repeated purchase returns the existing ownership
without charging again. Purchase and balance decrement are one transaction and
must reject insufficient balance with `409 INSUFFICIENT_FUNDS`.

Purchase document:

```ts
type Purchase = {
  id: string;
  readerUid: string;
  bookId: string;
  priceCents: number;
  purchasedAt: string;
};
```

No real payment provider, card data, refund, or financial credential is
permitted. Dummy purchases exist only to demonstrate ownership and unlock
ratings.

## 7. Moderation and Account Lifecycle

Sprint 2 contracts remain authoritative for bans, publisher revocation,
permanent book deletion, account deletion, restoration, audit records, and
notifications. Sprint 3 adds these enforcement requirements:

- banned users cannot create collections, favorites, follows, ratings, credits,
  or purchases;
- deleted/hidden books cannot be added to collections or purchased;
- account restoration requires a moderator and immutable audit record;
- account deletion removes private collections, favorites, follows, ratings,
  notifications, credit requests, and purchases according to the retention
  policy, while aggregate reporting records remain non-identifying;
- moderation notification creation uses an idempotency key and is safe to
  retry.

## 8. Shared Error and Empty-State Contract

Required Sprint 3 error codes:

`VALIDATION_ERROR`, `AUTH_REQUIRED`, `AUTH_INVALID`, `FORBIDDEN`,
`ACCOUNT_RESTRICTED`, `NOT_FOUND`, `DUPLICATE_RESOURCE`,
`REVISION_CONFLICT`, `INVALID_STATE`, `INSUFFICIENT_FUNDS`, and
`INTERNAL_ERROR`.

Every screen consuming a Sprint 3 endpoint must implement:

- loading state;
- empty state with an English explanation;
- error state with safe message and retry action;
- offline state that distinguishes cached data from unsent mutations;
- keyboard-accessible controls and visible focus;
- responsive layout at 320px, 768px, and 1280px widths.

## 9. Persistence and Idempotency

Firestore is authoritative online. IndexedDB stores cached records and an
offline mutation queue. Queue entries contain `mutationId`, `resourceType`,
`resourceId`, `baseRevision`, `payload`, `createdAt`, and `status`.

Mutations with the same `mutationId` return the original result. A revision
conflict returns the server value and never silently overwrites it. Notification
generation, favorites, follows, purchases, credit approvals, and moderation
decisions must all be retry-safe.

## 10. Sprint 3 Work Handoffs and Verification

| Owner | Deliverable | Handoff condition |
|---|---|---|
| Bryan | deletion grace period and session enforcement | auth result and restriction tests |
| Juan | domain repositories, DTOs, transactions | shared types and idempotency tests |
| Karlo | reader collections/favorites/follows/ratings UI | consumes shared services only |
| Dante | pricing, purchase, and account UI | consumes shared services only |
| Jorge | deletion, backup/restore, monitoring, deployment | operational evidence |
| Cesar | browser/security/traceability suite | dated S3 evidence |
| Carlos | final integration/demo/sign-off | all S3 rows passed or exception-approved |

Required local verification before handoff:

```text
npm run typecheck
npm run build
npm test
```

Focused tests must cover each S3 acceptance row. Manual evidence must include
the viewport, account role, route, date, expected result, actual result, and
artifact or screenshot reference.
