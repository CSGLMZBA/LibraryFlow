# Sprint 3 - Complete LibraryFlow Platform

## Goal

Complete every in-scope product capability and deliver a stable, accessible,
deployed platform ready for real users, with publisher approval retained as a
mandatory security boundary.

## Absolute Completion Gate

Sprint 3 is complete only when all items below are true:

- every Sprint 1, 2, and 3 user story is implemented or formally excluded;
- registration never grants publisher privileges;
- approved publishers are the only accounts that can upload books;
- collections, favorites, follows, ratings, dummy purchases, and prices work;
- all moderation, account, notification, and audit flows work;
- Netlify, Render, Firebase, Firestore, and Supabase are live and healthy;
- acceptance suites pass and manual evidence is dated;
- no critical or high unresolved security findings remain;
- no real secrets are committed;
- the final demo works from registration through moderation and offline reading.

## Scope

| Area | Stories | Deliverable |
|---|---|---|
| Personal organization | US-REA-004, US-REA-006 | Collections and collection membership |
| Favorites and updates | US-REA-008, US-REA-009 | Private favorites and update notifications |
| Ratings | US-REA-016 | 1–5 stars, average, update, delete |
| Publisher following | Add follow/unfollow stories to the backlog | Private follows and publisher update notifications |
| Pricing and purchases | US-PUB-007, US-REA-014 | Dollar price and dummy purchase ownership |
| User safety | US-MOD-004, US-MOD-008, US-MOD-011 | Bans, restoration, permanent book removal |
| Account lifecycle | US-REA-017, US-REA-019, US-REA-020 | Deletion grace period, token lifecycle, logout |
| Quality and release | Cross-cutting | Accessibility, responsive UI, backup, rollback, monitoring |

## Team Responsibilities

| Owner | Independent deliverable | Small collaboration | Maximum dependencies |
|---|---|---|---|
| Carlos Gabriel Martinez Bazaldua | Release branch, final integration, demo, acceptance sign-off | Review with Cesar/Jorge | One integration handoff |
| Bryan Alessandro Peralta Gutierrez | Account deletion, token/session lifecycle, logout, banned-user enforcement | Share auth result contract with Juan | Juan for account record |
| Juan Carlos Zuniga Alfaro | Ratings, collections, favorites, follows, dummy purchases, data contracts | Share types with Dante/Karlo | None for UI implementation |
| Karlo Silvestre de la Cruz Flores | Catalog collections, favorites, follows, ratings UI | Use Juan's services and shared types | One contract handoff |
| Dante Uriel Juarez Tolentino | Publisher pricing, purchase UI, account settings, publisher dashboard | Use Juan's DTOs and Bryan's session | One contract handoff |
| Cesar Cutberto Hortelano Jimenez | Full acceptance register, browser suite, security regression, defects | Re-test owner fixes; no feature implementation | Carlos for final evidence |
| Jorge Enriquez Rico | Backup/restore, moderation operations, deployment monitoring, final security review | Coordinate deletion cleanup with Juan | One infrastructure handoff |

## Independent Work Packages

1. Juan: collections/favorites/follows/ratings/purchases DTO and repository layer.
2. Karlo: reader collections, favorites, follow controls, and catalog empty states.
3. Dante: publisher pricing/purchase demo UI and account settings.
4. Bryan: account deletion grace period and session revocation.
5. Jorge: permanent deletion, backup/restore, monitoring, and deployment hardening.
6. Cesar: final cross-role acceptance suite and defect log.
7. Carlos: integrate, resolve only real conflicts, run final demo, and sign off.

## Collaboration Minimization

- Karlo and Dante consume shared frontend services; they do not implement
  Firestore or Supabase data access.
- Juan owns all new domain persistence contracts.
- Bryan owns authentication lifecycle only.
- Jorge owns infrastructure operations only.
- Cesar owns verification and traceability only.
- Carlos owns integration and release acceptance only.

## Dependencies

```text
Sprint 1/2 baselines
        |
        +--> Juan domain persistence contracts
        |       +--> Karlo reader feature UI
        |       +--> Dante publisher/account UI
        |
        +--> Bryan auth/account lifecycle
        |
        +--> Jorge moderation infrastructure/deployment
        |
        +--> Cesar acceptance suites
        +--> Carlos integration and final demo
```

## Acceptance Evidence

Create:

- `docs/testing/S3-ACCEPTANCE-REGISTER.md`
- complete browser verification and defect evidence;
- live deployment URLs and health evidence;
- backup/restore evidence;
- moderator UID provisioning evidence;
- final product-owner sign-off.

The sprint is not complete if an item is documented but never executed.
