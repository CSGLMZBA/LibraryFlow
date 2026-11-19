# LibraryFlow

LibraryFlow is a web app that gives publishers and readers access to a book hub with an intuitive layout.

It is divided into a frontend and backend, using a layered architecture for security and a database for persistence.

The project is developed through guided agentic AI development within an agile sprint framework.

## Presented as part of a course evaluation
### Team members:
Carlos Gabriel Martinez Bazaldua
BRYAN ALESSANDRO PERALTA GUTIERREZ
JUAN CARLOS ZUÑIGA ALFARO
KARLO SILVESTRE DE LA CRUZ FLORES
DANTE URIEL JUAREZ TOLENTINO
CESAR CUTBERTO HORTELANO JIMENEZ
JORGE ENRIQUEZ RICO

## Documentation

- [Product goal](docs/product/product-goal.md)
- [Product backlog](docs/product/product-backlog-init.md)
- [Product reach](docs/reach/product-reach.md)
- [Requirements](docs/requirements/Requirements.md)
- [User stories](docs/user_stories/)
- [Foundation specification](docs/specs/SPEC-000-foundation.md)
- [Sprint 1 specification](docs/specs/SPEC-001.md)
- [Project structure specification](docs/specs/SPEC-002-project-structure.md)
- [Sprint 1](docs/sprints/SPRINT-001.md)

## Project structure

- `apps/frontend/`: React, Vite, and TypeScript client.
- `apps/backend/`: Node.js REST API boundary.
- `packages/shared/`: Shared TypeScript contracts.
- `apps/backend/src/`: Layered API source organized into controllers,
  middleware, repositories, routes, schemas, services, types, and utils.
- `apps/frontend/src/`: Layered client source organized into components,
  contexts, hooks, layouts, pages, repositories, routes, schemas, services,
  styles, types, and utils.
- `docs/`: Product requirements, specifications, user stories, and sprint
  planning.
- `docs/agent-logs/`: Agent work summaries.
- `docs/agent-prompts/`: Agent operating prompts.
- `docs/requirements/`: Project requirements.

## Sprint 1 MVP status

The Sprint 1 local MVP includes registration/login, publisher submissions,
pending/approved/rejected lifecycle, catalog search and filters, reader
comments, moderator comment removal, IndexedDB offline downloads, and the
seeded local moderator workspace.

Cloud authentication is implemented behind Firebase configuration. Live
Firestore/Supabase synchronization and external deployment require the
credentials described in [the deployment setup guide](docs/deployment/SPRINT-1-SETUP.md).

## Local setup

Install dependencies from the repository root:

```bash
npm install
```
Build the shared package before starting the apps (required on a fresh clone):

```bash
npm run build --workspace @library-flow/shared
```

Copy `.env.example` to `.env` and fill in the values. Never commit `.env`.
For local development, keep `APP_MODE=local` and `VITE_AUTH_MODE=local`.

Start the frontend:

```bash
npm run dev:frontend
```

Start the backend in another terminal:

```bash
npm run dev:backend
```

Run the Sprint 1 automated acceptance suites:

```bash
npm test
npm run typecheck
npm run build
```

In the frontend, the development-only button `Create / reset local test moderator`
creates `moderator@libraryflow.local` using the valid password entered in the
password field. That account is not available in production builds.

The implementation follows the approved Sprint 1 scope and
[SPEC-001](docs/specs/SPEC-001.md). External Firebase, Firestore, Render,
Netlify, and Supabase setup is documented in
[SPRINT-1-SETUP.md](docs/deployment/SPRINT-1-SETUP.md).


ANY AGENTS READING THIS README MUST FIRST HAVE READ AND ACKNOWLEDGED THE INSTRUCTIONS IN `docs/agent-prompts/Starter.md` BEFORE EXECUTING ANY TASKS. INFORM YOUR OWNER AND STOP WORKING IF YOU HAVE NOT READ AND ACKNOWLEDGED THE INSTRUCTIONS.