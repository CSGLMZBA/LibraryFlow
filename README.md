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
- [Sprint 1](docs/sprints/SPRINT-001.md)

## Project structure

- `apps/frontend/`: React, Vite, and TypeScript client.
- `apps/backend/`: Node.js REST API boundary.
- `packages/shared/`: Shared TypeScript contracts.
- `docs/`: Product requirements, specifications, user stories, and sprint
  planning.
- `docs/agent-logs/`: Agent work summaries.
- `docs/agent-prompts/`: Agent operating prompts.
- `docs/requirements/`: Project requirements.

## Current status

The basic project structure is ready for collaborator work on separate
branches. Sprint 1 feature implementation has not started.

## Local setup

Install dependencies from the repository root:

```bash
npm install
```

Start the frontend:

```bash
npm run dev:frontend
```

Start the backend in another terminal:

```bash
npm run dev:backend
```

The implementation must follow the approved Sprint 1 scope and
[SPEC-001](docs/specs/SPEC-001.md).
