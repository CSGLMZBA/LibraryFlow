# Bryan Sprint 2 gap review

Owner: Bryan Alessandro Peralta Gutierrez. Assistant: Codex.
Scope: Sprint 2 only, following the owner's explicit correction. No Sprint 3
implementation is included. Reviewed develop 18f2970 and Bryan's local branch.

## Assigned work and current evidence

| Task | Existing implementation | Remaining work | Status |
|---|---|---|---|
| S2-T01 | Firebase SDK persistence, role verification, token renewal, logout revocation, local reader-only registration, protected route codes | 30-minute idle policy, authoritative session tracking and old-token handling on refresh, live Firebase/browser evidence | In progress |
| S2-T06 | No account lifecycle routes or persistence exist yet | Deletion request, blocked login/refresh, 30-day cancellation, moderator restore/audit hooks and public-field cleanup | Blocked on account/session contract clarification |

The default test suite previously contained 51 placeholder assertions. It must
not be used to declare the Sprint 2 acceptance register complete. New HTTP
router tests exercise actual Express route dispatch with mocked auth services:
refresh bearer identity, missing/revoked credentials, logout-to-access denial,
restricted-login error propagation and safe provider-outage errors.
The restricted-login route test checks error propagation only; it is not proof
of an implemented deletion restriction service.

## Contract decisions requested from the owner

SPEC-002-CONTRACTS.md section 6 defines lifecycle URLs but does not specify an
account/session persistence model or the proof required to cancel deletion
when ordinary login is blocked. Starter.md sections 4 and 9 require owner
approval before adding a persistence shape or resolving an ambiguous security
boundary. A question has been sent to the owner proposing:

1. Persistent Firestore account and session records, with a 30-minute inactivity
   limit checked server-side, not just a browser timer.
2. Credential-verified cancellation within the grace period, without issuing a
   normal application session while the account remains restricted.
3. Moderator-only administrative restoration, with an immutable audit record.
4. Document the chosen models and exact request/response details before code.

The approval question is pending. No account or session schema has been added
to the normative contract and no dependent lifecycle code has been generated.

## Integration dependencies that remain visible

- Juan owns shared domain DTOs and Firestore-backed books/applications.
  The merged repositories are still in memory. Public-field anonymization must
  cover their eventual authoritative cloud representation and current readers;
  account flags alone cannot be claimed as removal of all public personal data.
- Jorge owns the scheduled permanent-deletion worker (S2-T08). Bryan supplies
  the account restriction and restore hooks; do not fabricate completion of a
  permanent worker belonging to Jorge.
- No outbound email provider or account-deletion email contract is configured,
  although US-REA-017 CA-002 requires confirmation email. This needs a real
  integration, not an email-sent flag or success-shaped stub.
- Firebase/Firestore live project configuration and independent review remain
  required for acceptance evidence.
- Existing 5 high dependency findings are release blockers for the team; no
  unrelated dependency upgrades are included in this auth/account increment.

## Verification and changed files for this review

- Baseline typecheck/build/npm test passed before the router-test increment.
- New focused command: node --import tsx --test docs/testing/s2-auth-routes.test.mjs
- Focused result: 5 passed, 0 failed, using Express router dispatch and mocked
  backend auth services without opening a network listener.
- Changed: apps/backend/src/routes/auth-routes.ts (injectable router factory;
  production default services and public URLs preserved), package.json,
  docs/testing/s2-auth-routes.test.mjs, and this log.
- Public routes added in this review: none. No files or requirements for
  Sprint 3 changed. No remote push, PR reopen/create or merge performed.

Final verification of this increment: npm run typecheck passed; npm run build
passed; npm test reported Sprint 1 19/19 and Sprint 2 80/80, for 99 tests with
0 failures. The 51 inherited placeholder assertions remain unchanged.
git diff --check passed. Build retains the previously documented main-bundle
size warning. These results do not remove the account/session design blocker.

## Owner direction for publication

The owner subsequently requested that the two blocked implementation areas stay
pending and asked for the proposed MD design to be reviewable by its owner.
Prepared docs/specs/S2-AUTH-ACCOUNT-PROPOSAL.md without editing Starter.md or
SPEC-002-CONTRACTS.md. It is a proposal, not a normative amendment or implemented
account/session model. The owner authorized publishing only Bryan's branch and
requested a normal, non-draft PR to develop. No merge is authorized.
