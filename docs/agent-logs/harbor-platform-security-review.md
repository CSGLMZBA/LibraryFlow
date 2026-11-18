# S1-PLAT-01 — Local setup and security review

## Owner and agent
- Owner: Jorge Enriquez Rico — Platform, security, and delivery engineer
- Agent: Harbor

## Date
2026-11-18

## Scope
Fresh-clone local execution, environment configuration, deployment readiness,
and security findings for the Sprint 1 increment on `develop`.

## Verification performed
Manual run on Windows, Node.js 24, from a fresh clone of `develop`:

1. `npm install` — completed (394 packages).
2. `npm run dev:backend` — **failed** with `ERR_MODULE_NOT_FOUND`
   (`@library-flow/shared/dist/index.js`).
3. `npx tsc -b packages/shared --force` — generated `dist`.
4. `npm run dev:backend` — started; `GET /health` returned `{"status":"ok"}`.
5. `npm run dev:frontend` — started.
6. `npm run build` — succeeded for shared, backend, and frontend.
7. `npm run start --workspace @library-flow/backend` — production build started.

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| PLAT-001 | High | `packages/shared/tsconfig.tsbuildinfo` was committed although `.gitignore` excludes `*.tsbuildinfo`. `tsc -b` treats the build as up to date and never emits `dist`, so the backend cannot start on a fresh clone. | Fixed in PR #13 |
| PLAT-002 | Medium | README did not document the required shared-package build step. | Fixed in PR #13 |
| PLAT-003 | Medium | No `.env.example`; required variables from SPEC-001 §11.2 were undocumented. | Fixed in PR #13 |
| PLAT-004 | Medium | `npm install` reports 10 vulnerabilities (9 moderate, 1 high) and deprecated packages (`@xmldom/xmldom@0.7.13`, `uuid@9`). `npm audit fix --force` was not run because it may introduce breaking changes. | Open — review with team |
| PLAT-005 | Medium | Backend had no CORS policy. A Netlify frontend calling a Render backend would be blocked by the browser. | Fixed in PR #13 (`CORS_ORIGIN` allowlist) |
| PLAT-006 | Low | `APP_MODE` and `VITE_API_BASE_URL` (SPEC-001 §11.2) are not read anywhere. `createCloudAuthService` exists but is not wired; the frontend runs in local mode only. | Open — needs integration decision |
| PLAT-007 | Low | Backend reads `FIREBASE_WEB_API_KEY`, which is not in the approved SPEC-001 configuration list. | Open — needs product owner approval |
| PLAT-008 | Low | No backend production start script, Supabase configuration, or deployment files existed. | Start script and config added in PR #13 (`netlify.toml`, `render.yaml`); live deployment pending credentials |
| PLAT-009 | Info | Vite warns that the frontend bundle is 554 kB (above 500 kB). | Not blocking |

## Positive observations
- `.env` and `.env.*` are ignored by Git; no secrets were found committed.
- Backend limits JSON bodies to 100 KB.
- The local moderator seed only runs in Vite development mode.
- The frontend keeps the auth token in memory, not in localStorage or URLs.

## Next steps
1. Review `npm audit` output with the team (PLAT-004).
2. Create Netlify and Render projects and load secrets in their dashboards (PLAT-008).
3. Decide how `APP_MODE` selects the cloud adapter (PLAT-006).
4. Re-run fresh-clone verification after integration (sprint close).