# Orwell — Sprint 1 functional MVP integration

## Owner and agent

- Owner: Carlos Gabriel Martinez Bazaldua
- Agent: Orwell
- Date: 2026-11-18

## Summary

Completed integration work that remained after the team implementation week,
with the repository baseline treated as the Sprint 1 implementation source.

## Completed

- Fixed newest-first comment ordering.
- Added malformed-JSON and internal-error JSON handling to the Express API.
- Corrected the frontend Firebase REST adapter Authorization header handling.
- Made the frontend cloud adapter use `VITE_API_BASE_URL`.
- Added moderator controls for pending-book approval/rejection.
- Added reader comment posting on approved catalog records.
- Added moderator comment removal with audit fields.
- Added the development-only seeded local moderator setup control.
- Added repository scripts for Sprint 1 tests.
- Removed populated-directory `.gitkeep` placeholders.
- Updated README and Sprint 1 acceptance evidence.
- Added a complete local/Firebase/Firestore/Supabase/Render/Netlify setup guide.

## Verification

- `npm install`: 394 packages installed.
- `npm run typecheck`: passed across shared, backend, and frontend.
- `npm run build`: passed across shared, backend, and frontend.
- `npm test`: 18/18 Sprint 1 automated tests passed.
- Backend `/health`: returned HTTP 200.
- Missing auth token: returned HTTP 401 with the standard API error shape.
- Malformed JSON: returned HTTP 400 with `INVALID_JSON`.
- Frontend Vite server: started successfully.

## External blockers

Live Firebase, Firestore, Supabase, Render, and Netlify acceptance cannot be
completed without the owner's project credentials and deployment accounts.
No credentials or secrets were added to the repository.
