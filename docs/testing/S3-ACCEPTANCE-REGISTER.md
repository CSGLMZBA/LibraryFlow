# Sprint 3 Acceptance Register

## Status

Sprint 3 includes cutover, favorites, ratings, authorization, operations,
verification and release sign-off. Deferred rows are backlog, not passed.

| ID | Scope | Required Evidence | Status |
|---|---|---|---|
| S3-AC-001 | Collections | Create, update, private ownership, empty state | Deferred (backlog) |
| S3-AC-002 | Favorites | Add/remove/list/private behavior | Pending |
| S3-AC-003 | Favorite notifications | Idempotent update notification | Deferred (backlog) |
| S3-AC-004 | Ratings | One per reader, update/delete, average | Pending |
| S3-AC-012 | Sprint 2 cutover | Cloud mode verified live in a browser; test TODOs reconciled under S3-AC-016 | Pending |
| S3-AC-013 | Reader authorization | Anonymous and restricted accounts denied as applicable; another reader cannot modify private records | Pending |
| S3-AC-014 | Storage and worker operations | Private storage checks, secret rotation and successful scheduled workflow, without exposing secrets | Pending |
| S3-AC-015 | Release and decisions | Account-deletion scope and retention decision, baseline checks, deployed demo and Carlos's sign-off | Pending |
| S3-AC-016 | Acceptance reconciliation | Each previously reported TODO and outstanding Sprint 2 row has evidence or an owner-approved disposition; in-scope cases pass | Pending |
| S3-AC-005 | Publisher follows | Follow/unfollow/list/update notification | Deferred (backlog) |
| S3-AC-006 | Pricing | Valid/invalid USD price and ownership | Deferred (backlog) |
| S3-AC-007 | Dummy purchases | Purchase record unlocks permitted rating behavior | Deferred (backlog) |
| S3-AC-008 | Full moderation | Ban, lift, hide content, delete, restore | Deferred (backlog) |
| S3-AC-009 | Account lifecycle | 30-day deletion and blocked login | Deferred (backlog) |
| S3-AC-010 | Platform quality | Accessibility, responsive UI, backup/restore, monitoring | Deferred (backlog) |
| S3-AC-011 | Final deployment | Netlify/Render live health and complete demo | Deferred (backlog) |

Sprint 3 is complete only when every non-deferred row passes with evidence.
An owner-approved deferral must identify the specific out-of-scope item and
does not turn a skipped test or pending acceptance result into a pass.

### S3-AC-014 partial evidence

On 2026-11-25, Carlos reported updating the worker secret in Render and
GitHub while the workflow was disabled. After re-enabling it, a
[manual run](https://github.com/CSGLMZBA/LibraryFlow/actions/runs/45736168783)
on `main` completed successfully against the deployed backend: it claimed
zero deletion jobs and reported zero failures. Application expiry reported
`enabled: false`, so that run did not verify expiration. A successful scheduled
run and remaining storage evidence are still required; S3-AC-014 stays
pending.

### S3-AC-015 partial evidence

On 2026-11-25, Carlos selected a 30-day grace period, deletion of personal data
and user contributions where permitted, and retention of only necessary audit
records. The retention duration, legal obligations and detailed data scope
remain for review; permanent account deletion remains deferred. This records
the decision only, not a verified deletion implementation. Baseline checks,
deployed demo and release sign-off remain pending.

## Evidence Record Format

For every passed item, record:

- acceptance ID and linked story/contract section;
- date and environment;
- actor role and test account type;
- route or UI path;
- exact command or manual steps;
- expected result and actual result;
- artifact path, screenshot, or deployment URL;
- reviewer and disposition.

An item remains `Pending` when any required field is missing. A failed item
must include the failure, owner, issue reference, and retest date.
