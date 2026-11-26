# SPEC-003 - LibraryFlow Sprint 3

## 1. Purpose

The current reduced Sprint 3 delivers cloud cutover verification, private
favorites, ratings, and their release evidence. See
[SPRINT-003.md](../sprints/SPRINT-003.md) for scope and completion gates.
Other sections in this document describe deferred backlog, not requirements
for this sprint. In particular, purchase-gated ratings and favorite update
notifications are deferred; the reduced-scope rules in
[SPEC-003-CONTRACTS.md](./SPEC-003-CONTRACTS.md) take precedence.

## 2. Collections

- Collection names are required and unique per owning reader.
- Collections may contain approved/public books only.
- Ownership checks are enforced on create, update, and delete.
- Collection membership is persisted and reload-safe.
- Empty collections display an explicit empty state.
- Collaborative and shared collections remain excluded.

## 3. Favorites and Update Notifications

- One reader may have at most one favorite entry for a book.
- Favorite records are private to their reader.
- Removing a favorite stops future update notifications.
- Updating a favorited book creates at most one notification per reader per
  update event.
- Notification generation must be idempotent.

## 4. Ratings

- The platform must allow 1–5 star ratings.
- Each reader has at most one rating per book.
- Approved books may be rated only according to the user story purchase rule.
- Average and individual ratings are recalculated without silent data loss.
- Users may update or delete their own rating.
- Moderator removal and account deletion must preserve audit-safe invariants.

## 5. Publisher Following

- Only approved publishers may be followed.
- One reader may follow a publisher once.
- Follow/unfollow is private to the reader.
- Publisher updates may create an in-app notification.
- Following is not an authorization mechanism.

## 6. Pricing and Dummy Purchases

- Publishers may set a non-negative dollar price for owned books.
- No real payment or financial credential handling is included.
- Dummy purchase records prove book ownership and unlock rating behavior.
- Currency display uses USD.
- A refund or real checkout integration remains excluded.

## 7. Complete Moderation

Sprint 3 includes:

- temporary/permanent bans;
- ban lifting;
- public-content hiding;
- publisher revocation;
- permanent book deletion and bucket cleanup;
- account deletion and grace-period cleanup;
- moderator audit records;
- notification of every selected moderation decision.

## 8. Platform Quality

The final platform must provide:

- responsive, keyboard-accessible English UI;
- loading, empty, error, retry, and offline states;
- consistent field validation and API error shapes;
- automated tests and manual acceptance evidence;
- backup and restore procedures;
- release, rollback, and environment procedures;
- no known critical or high security finding;
- no Sprint 2 or Sprint 3 feature left disabled or mock-only.

## 9. Sprint 3 Completion Gate

The product is complete only if all of these are true:

- local and deployed flows work;
- every in-scope backlog item is traceable;
- the Sprint 1–3 acceptance suites pass;
- no repository secrets exist;
- all moderation actions are audited;
- publisher approval is mandatory;
- Netlify and Render are healthy;
- Firebase, Firestore, and Supabase are configured and verified;
- the final browser demo passes from registration through moderation and offline use.

## 10. Normative Implementation Contract

The detailed Sprint 3 implementation contract is in
[SPEC-003-CONTRACTS.md](./SPEC-003-CONTRACTS.md). It defines shared DTOs,
routes, validation, authorization, idempotency, offline mutation behavior,
error codes, empty/loading/error/offline UI states, handoffs, and verification
evidence. That contract is part of SPEC-003 and must be updated before any
agent introduces a new route, state, or persistence shape.
