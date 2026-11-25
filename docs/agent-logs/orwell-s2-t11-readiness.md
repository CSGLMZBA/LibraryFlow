# Orwell — S2-T11 Integration Readiness

Date: 2026-11-25

## Assignment

- Agent: Orwell
- Owner: Carlos Gabriel Martinez Bazaldúa
- Task: S2-T11 integration readiness and Sprint 2 remaining-work review
- Scope: Inspect outstanding Sprint 2 tasks and prepare an operator-fillable
  environment template without reading or changing local secret values.
- Branch: `develop`

## Owner decisions

- The owner selected `book-files` as the canonical bucket, matching
  SPEC-002 §4 and `render.yaml`.
- The owner selected updating `.env.example`.
- The owner authorized `git pull --ff-only origin develop` and the required
  baseline checks.

## Preflight

- `git pull --ff-only origin develop`: passed; branch was already up to date.
- `npm run typecheck`: failed with 64 TypeScript diagnostics.
- Diagnostics include unresolved `@library-flow/shared` exports/types for
  publisher applications and book-file DTOs, plus missing Firebase client
  modules (`firebase/app` and `firebase/auth`). Additional dependent type
  errors were reported across backend and frontend code.
- `npm run build` and `npm test` were not run because the Starter baseline
  stop condition applies after a failed typecheck.

## Environment review

Only variable names and empty/set state were inspected; no `.env` values were
printed or recorded.

- Current `.env` includes legacy `CORS_ORIGIN` and `SUPABASE_BUCKET` names;
  Sprint 2 reads `FRONTEND_ORIGIN` and `SUPABASE_BOOK_BUCKET`.
- At the initial review, `FRONTEND_ORIGIN`, `VITE_FIREBASE_API_KEY`,
  `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and
  `DELETION_WORKER_SECRET` were absent from `.env`. Carlos later supplied the
  deployment values locally; no values were printed or recorded.
- `NODE_ENV` is absent locally; Render sets production mode through
  `render.yaml`.
- `RENDER_BACKEND_URL` is a GitHub Actions repository secret, not an
  application `.env` setting.
- The contract and Blueprint specify `book-files`; the pre-existing live
  bucket was `books`. The owner selected `book-files` as canonical.

## Stop condition and worktree

The initial typecheck failed, so build and tests were stopped as required.
After the owner authorized diagnosis and repair, these root causes were
confirmed:

- The shared package exports through `dist/index.d.ts`, but `dist` is not
  tracked or present in a clean checkout. The root `typecheck` script only ran
  a no-emit shared check before typechecking dependent workspaces.
- The declared Firebase frontend dependency was absent from `node_modules`.

## Changes and verification

- Updated the root `typecheck` script to build `@library-flow/shared` before
  typechecking backend/frontend workspaces.
- Ran `npm install` to restore declared dependencies; Firebase became
  available. The install reported 14 audit findings (9 moderate, 5 high);
  no automatic audit fixes were run. npm's unrelated lockfile metadata churn
  was removed.
- Updated `.env.example` with the owner-selected `book-files` bucket, optional
  emulator host entries, and a note that the worker secret must be configured
  in Render and GitHub Actions.
- Carlos then authorized cleaning the local `.env` for cloud deployment. The
  duplicate blocks and legacy `CORS_ORIGIN`/`SUPABASE_BUCKET` entries were
  removed; non-empty backend Firebase and Supabase values were preserved
  locally, and public Firebase key/project values were aligned. The local
  bucket setting is now `book-files`. File permissions are `0600`; `.env`
  remains git-ignored.
- `RENDER_BACKEND_URL` belongs in GitHub Actions repository secrets rather
  than `.env`; no repository Actions secrets were listed during the 2026-11-25
  live check.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite reports the existing >500 kB chunk warning.
- `npm test`: passed, 155 total (20 Sprint 1 + 135 Sprint 2), 0 failures.
- `node --import tsx --test docs/testing/s2-storage-deployment.test.mjs`:
  passed, 38 tests, 0 failures.
- `git diff --check`: passed.

The local `.env` was not printed. The legacy bucket `books` and its objects
were not changed. Do not delete or migrate objects based on this log alone.

## Remaining Sprint 2 findings

- The moderation router has no ban/lift-ban routes or corresponding
  moderation-service operations. `TC-S2-036`, `TC-S2-037`, and `TC-S2-039`
  currently assert local fixture/error values rather than exercising ban
  behavior; S2-AC-008 therefore needs implementation and meaningful tests.
- S2-T08 tests explicitly leave `account-data` jobs pending. Account
  permanent-deletion data cleanup remains a separate unresolved handoff.
- The S2-T07 verification below covers the owner-selected canonical
  `book-files` bucket. Acceptance evidence still needs review and registration.
- S2-T09 deployment, rollback, and browser round-trip evidence remain
  outstanding. S2-AC-010 remains Pending.
- The acceptance register summary rows and detailed test-case states still
  need Cesar's evidence reconciliation. Passing automated suites alone does
  not close those criteria.

## 2026-11-25 — Priority 1 execution

- `npm run typecheck`: passed.
- `npm run build`: passed; the existing Vite large-chunk warning remains.
- `npm test`: passed, 155 tests (20 Sprint 1 and 135 Sprint 2), 0 failures.
- `npm run backup:firestore`: completed read-only. The private, git-ignored
  backup contains 3 documents in `auth-display-name-reservations`; file mode
  is `0600`. The filename and checksum were reported to the operator and are
  not copied into this log. The backup remains local.
- Created the private `book-files` bucket with a 20 MB limit and PDF/EPUB MIME
  restrictions. `npm run storage:verify` against `book-files` passed 7/7.
  The existing `books` bucket was left untouched; read-only root and `books/`
  prefix listings returned no entries during the check.
- Live deployment check passed health, exact-origin CORS/preflight, untrusted
  origin denial, frontend availability, and bundle-secret scan. The protected
  book-file download route returned HTTP 404 instead of the expected
  unauthenticated 401. The route exists on `develop`, while the live
  `/api/v1/auth/session` endpoint responds 401; production needs a release
  containing the current backend routes before deployment acceptance can
  pass.
- The repository default branch is `main`. The deletion-worker workflow exists
  on `develop` but not `main`; GitHub listed no repository Actions secrets at
  the time of this check. No worker run was started. Carlos must configure
  `RENDER_BACKEND_URL` and `DELETION_WORKER_SECRET` through GitHub repository
  settings. The worker can permanently delete due book files.
- The deployment PR and one worker run after release prerequisites are
  authorized by Carlos. No PR was merged and no production deployment or
  destructive worker operation was performed in this session.

## 2026-11-25 — Render missing-bucket startup fix

- Branch: `fix/s2-release-readiness`, based on merged `main`.
- Render's deploy log showed the backend crashing at startup because
  `SUPABASE_BOOK_BUCKET` was absent, although the canonical private
  `book-files` bucket exists. The storage factory defaulted the absent bucket
  to `book-files`; explicit bucket overrides remain supported, and incomplete
  Supabase URL/key configuration still fails fast.
- Added a regression assertion for the missing-bucket case and retained
  coverage that explicit bucket overrides and URL/key validation work.
- Updated the deployment guide to document the canonical default.
- Focused storage/deployment tests: 38 passed, 0 failed.
- `npm run typecheck`: passed. `npm run build`: passed with the existing
  Vite large-chunk warning. `npm test`: 155 passed, 0 failed.
- No production configuration was changed and no deployment was triggered.
  The operator later clarified that the live canonical bucket is `books`;
  configuration and this default are being aligned to that existing bucket.

## 2026-11-25 — Canonical bucket correction

- Carlos clarified that the actual Supabase book bucket is `books` and selected
  it as the canonical bucket. This supersedes the earlier `book-files` choice
  recorded above.
- The backend default, Render Blueprint, `.env.example`, SPEC-002 contract,
  deployment docs, and storage test fixtures are being aligned to `books`.
- The existing `books` bucket was already confirmed private with the required
  20 MB PDF/EPUB settings and passed live verification 7/7. The previously
  created `book-files` bucket is left untouched; no bucket/object deletion or
  migration is authorized or performed.
- Render should set `SUPABASE_BOOK_BUCKET=books`. This explicit setting and
  the code default agree, preventing recurrence of the startup crash.
