# Harbor — S2-T09 Deployment Readiness (Session 1)

Date: 2026-11-24

## Assignment

- Task: `S2-T09` (Sprint 2)
- Owner: Jorge Enriquez Rico
- Agent: Harbor, AI assistant
- Branch: `feature/S2-T09-deployment-readiness` (from `develop` at `3f25f37`)
- Contract: `SPEC-002-CONTRACTS.md` §8
- Acceptance: `S2-AC-010` (TC-S2-053 to TC-S2-058)
- Dependency: `S2-T07`, implementation and live storage verification
  complete; evidence pending Cesar's review in a separate pull request.
- Status: `In progress` (live deployment evidence pending)

## Owner decisions (2026-11-24)

1. Start S2-T09 while S2-T08 waits for Juan's and Carlos's approval.
2. Close S2-T07 evidence in its own pull request, separate from S2-T09.

## Work completed

| Area | Files |
|---|---|
| Health | `apps/backend/src/routes/health-routes.ts` (same body as before, adds `Cache-Control: no-store`); `server.ts` uses it |
| Live checks | `scripts/check-deployment.mjs`, `npm run deploy:check -- <backend> <frontend>`: health, CORS allow/deny/preflight, protected route, published site, secret scan of the bundle and its lazy chunks. No credentials needed |
| Backup | `scripts/backup-firestore.mjs`, `npm run backup:firestore`: read-only export to git-ignored `backups/`, SHA-256, counts only in output |
| Guide | `docs/deployment/SPRINT-2-DEPLOYMENT.md`: variables, checklist, order, backup, rollback, drill, monitoring, troubleshooting, evidence template |
| Tests | TC-S2-053, TC-S2-056, TC-S2-057, TC-S2-058 stubs replaced in `docs/testing/s2-storage-deployment.test.mjs` |
| Config | `.gitignore` adds `backups/`; `package.json` adds two scripts |

No API route or contract change.

## Verification observed in this session

- `node --import tsx --test docs/testing/s2-storage-deployment.test.mjs`
  (Linux, Node 22.23.5): 33 tests, 32 passed, 0 failed, 1 skipped.
- Mutation check: four deliberate defects each made the suite fail.
- TypeScript `--noEmit` on `health-routes.ts` with Express stubs: no errors.

Not run here: the owner's full `npm run build`, `typecheck`, `test`; any live
deployment, backup, or rollback.

## Open items

- Bucket name: live bucket `books`; `render.yaml` and SPEC-002 §4 use
  `book-files`. Carlos aligns before deploying (guide §2).
- Restore of a Firestore backup is S3-T09.
- S2-T08 will add GitHub Actions secrets (`DELETION_WORKER_SECRET`,
  `BACKEND_URL`); the guide will be updated then.

## Next steps

1. Owner runs `npm run build`, `npm run typecheck`, `npm test`; pull request.
2. With Carlos: backup, deploy, `npm run deploy:check`, manual round trip,
   rollback drill; record evidence with the guide §8 template.
3. Cesar reviews the evidence (S2-T10).
