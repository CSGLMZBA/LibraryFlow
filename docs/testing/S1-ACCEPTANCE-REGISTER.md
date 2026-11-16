# Sprint 1 Acceptance-Criteria Register

This register is the QA starting point for Sprint 1. Each row links a scope,
story, specification area, owner, and required evidence. The owner records the
actual command, test name, or manual scenario before marking the result
`Passed`.

| ID | Scope / story | Acceptance coverage | Specification | Owner | Evidence required | Status |
|---|---|---|---|---|---|---|
| S1-AC-001 | PB-001 / `US-REA-010` | Registration, login, validation, roles, seeded moderator, session persistence | SPEC-001 §§3, 6, 11 | Bryan, Dante | Auth tests and invalid-credential manual check | Not started |
| S1-AC-002 | PB-002 / `US-PUB-001` | EPUB/PDF validation, 20 MB boundary, ownership, pending state, metadata update | SPEC-001 §§5, 8, 9 | Juan, Dante | API/service tests and upload boundary checks | Not started |
| S1-AC-003 | PB-002 / `US-MOD-006` | Approval/rejection visibility, reason, notification, deletion job | SPEC-001 §§8, 11.2 | Juan, Jorge | Moderation tests and scheduled-job retry evidence | Not started |
| S1-AC-004 | PB-003 / search stories | Case-insensitive query, combined filters, approved-only catalog, empty state | SPEC-001 §9 | Juan, Karlo | Query tests and empty-state manual check | Not started |
| S1-AC-005 | PB-004 / `US-PUB-004` | Owner-only metadata update and identity preservation | SPEC-001 §§5, 9 | Juan, Dante | Authorization and persistence tests | Not started |
| S1-AC-006 | PB-005 / classification stories | Controlled category/genre references, rename preservation, filters | SPEC-001 §§5, 9, 12 | Juan, Dante, Karlo | Valid/invalid reference tests | Not started |
| S1-AC-007 | PB-006 / comment stories | Reader creation, publisher visibility, newest-first order, moderator removal audit and notification | SPEC-001 §§3, 9, 12 | Juan, Dante, Jorge | Comment and moderation tests | Not started |
| S1-AC-008 | PB-007 / `US-REA-003` | Download states, retry, quota failure cleanup, offline reading | SPEC-001 §§5, 10 | Juan, Karlo | IndexedDB/download tests and offline manual check | Not started |
| S1-AC-009 | Cross-cutting | Reload persistence, local/cloud boundary, malformed-data recovery, error shape | SPEC-001 §§7, 11.2 | Cesar, Jorge | Regression and configuration evidence | Not started |

## Execution record

No acceptance item is marked passed until implementation exists and the
verification has actually run. The QA owner adds date, command/scenario, and
result details in the pull request or linked test evidence.
