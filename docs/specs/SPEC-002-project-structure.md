# SPEC-002: LibraryFlow — Project Structure and File Responsibilities

## 1. Purpose and status

This specification defines the file and directory responsibilities for the
LibraryFlow monorepo. It establishes a predictable separation between the
backend REST API, frontend application, and shared TypeScript contracts.

**Status:** Approved structure baseline  
**Applies to:** `apps/backend`, `apps/frontend`, and `packages/shared`  
**Related specifications:** `SPEC-000-foundation.md` and `SPEC-001.md`

This is an organizational specification. It does not add product behavior or
authorize implementation of features outside the approved sprint scope.

## 2. General organization rules

- Deployable applications live under `apps/`.
- Reusable contracts and utilities live under `packages/`.
- Source code for each application lives under its `src/` directory.
- A file has one primary responsibility and belongs in the directory that
  owns that responsibility.
- Cross-layer imports must follow the dependency direction in this document.
- Feature code should use descriptive lowercase kebab-case file names.
- TypeScript symbols use the conventions in `SPEC-000`; React components and
  pages use PascalCase symbols.
- `.gitkeep` files only preserve an intentionally empty directory. They must be
  removed when the first real file is added to that directory.

## 3. Backend structure

The backend is a Node.js REST API. Request handling is separated from
business rules and persistence so that HTTP, storage, and domain behavior can
be tested independently.

```text
apps/backend/
└── src/
    ├── controllers/
    ├── middleware/
    ├── repositories/
    ├── routes/
    ├── schemas/
    ├── services/
    ├── types/
    ├── utils/
    └── server.ts
```

### 3.1 Backend directory responsibilities

| Directory | Responsibility | Must not contain |
|---|---|---|
| `controllers/` | Translate an HTTP request into a service call and translate the service result into an HTTP response. | Database queries, authorization rules duplicated from services, or complex domain workflows. |
| `middleware/` | Cross-cutting request processing such as JSON parsing, authentication context, authorization guards, validation adapters, error handling, and request logging. | Feature workflows or direct repository orchestration. |
| `repositories/` | Persist and retrieve domain data through Firestore, local adapters, or another approved storage implementation. | HTTP request/response objects or presentation concerns. |
| `routes/` | Declare URL paths, HTTP methods, middleware order, and controller handlers. | Business rules or persistence logic. |
| `schemas/` | Define and execute input/output validation schemas for request bodies, parameters, queries, and serialized responses. | Side effects, database access, or authentication state changes. |
| `services/` | Implement domain use cases, authorization decisions, invariants, synchronization, and orchestration between repositories and external adapters. | Express-specific response formatting or route declarations. |
| `types/` | Backend-only domain, request-context, adapter, and infrastructure types that are not public shared contracts. | Runtime validation or mutable application state. |
| `utils/` | Small, stateless, reusable backend helpers such as ID generation, normalization, error conversion, and time utilities. | Hidden I/O, request handling, or feature-level workflows. |

### 3.2 Backend entry point

`src/server.ts` is the composition root. It creates the Express application,
registers global middleware, mounts routes, registers the final error
handler, and starts the server. It must not contain feature-specific business
logic.

The expected request flow is:

```text
route -> middleware -> controller -> service -> repository
                         ^             |
                         └── schemas ─┘
```

Controllers may call services only. Services may call repositories and
approved infrastructure adapters. Repositories must not call controllers,
routes, or frontend code.

### 3.3 Backend naming and file patterns

- `book-controller.ts`, `auth-service.ts`, and `book-repository.ts` use
  kebab-case file names.
- A controller exports handlers; a service exports use cases; a repository
  exports a persistence port and/or adapter implementation.
- Request schemas are named for their boundary, for example
  `create-book-schema.ts` or `login-schema.ts`.
- Backend-only types are named for the concept, for example
  `auth-types.ts` or `repository-types.ts`.
- Do not create index-barrel files solely to hide unclear ownership.

## 4. Frontend structure

The frontend is a React/Vite application. Presentation, navigation, client
use cases, persistence, and shared contracts remain separate so UI components
do not own data access or domain rules.

```text
apps/frontend/
└── src/
    ├── assets/
    ├── components/
    ├── contexts/
    ├── hooks/
    ├── layouts/
    ├── pages/
    ├── repositories/
    ├── routes/
    ├── schemas/
    ├── services/
    ├── styles/
    ├── types/
    ├── utils/
    ├── App.tsx
    ├── main.tsx
    └── styles.css
```

### 4.1 Frontend directory responsibilities

| Directory | Responsibility | Must not contain |
|---|---|---|
| `assets/` | Static images, icons, fonts, and other imported application assets. | Runtime data or service logic. |
| `components/` | Reusable presentational and interaction components that receive data and callbacks through props or approved hooks. | Page-level routing or direct persistence calls. |
| `contexts/` | React context providers for app-wide state such as session, notifications, or connectivity. | Unrelated feature UI or persistence implementations. |
| `hooks/` | Reusable React hooks that coordinate component state, effects, and frontend services. | JSX page layouts or direct backend route declarations. |
| `layouts/` | Shared page shells, navigation regions, and authenticated/role-aware layout composition. | Feature-specific data mutations. |
| `pages/` | Route-level screens that compose layouts, components, hooks, and services for a user-facing flow. | Low-level reusable UI or repository implementation. |
| `repositories/` | Client persistence and transport adapters for REST, IndexedDB, local mode, or other approved data sources. | JSX, route declarations, or user-facing notifications. |
| `routes/` | Route definitions, protected-route composition, and navigation metadata. | API calls or feature business rules. |
| `schemas/` | Client-side form and response validation schemas aligned with API contracts. | React rendering or persistence side effects. |
| `services/` | Frontend use cases, authentication coordination, synchronization, download orchestration, and user-facing domain operations. | JSX or route registration. |
| `styles/` | Shared CSS modules, tokens, and feature-independent styling. | API or state logic. |
| `types/` | Frontend-only view-model, navigation, and UI state types. | Runtime validation or API-specific contracts that belong in `packages/shared`. |
| `utils/` | Small, stateless browser helpers such as formatting, accessibility, and URL utilities. | Hidden network/storage I/O or feature workflows. |

### 4.2 Frontend entry points

- `src/main.tsx` mounts the React application and global styles.
- `src/App.tsx` composes the top-level application providers, layout, and
  route tree. It should not contain feature-specific data access.
- `src/styles.css` remains the global stylesheet. New reusable or scoped
  styles belong under `src/styles/` when they are introduced.

The expected frontend flow is:

```text
route -> page -> hook/service -> repository
          |                    |
          └── components       └── REST / IndexedDB / local adapter
```

Components and pages may consume services through hooks, but must not bypass
the repository boundary for persistence or transport.

### 4.3 Frontend naming and file patterns

- React components and pages use PascalCase symbols and `.tsx` files:
  `BookCard.tsx`, `CatalogPage.tsx`.
- Non-component modules use kebab-case names and `.ts` files:
  `use-auth-session.ts`, `book-service.ts`, `route-guards.ts`.
- Hooks begin with `use`; providers end with `Provider`; schemas identify the
  validated operation.
- Keep styles in CSS files or the established styling approach; do not embed
  unrelated global styles in components.

## 5. Shared package structure

Shared code contains contracts that must remain identical between backend and
frontend. It must not depend on Express, React, browser APIs, Firestore, or
Supabase.

```text
packages/shared/
└── src/
    ├── schemas/
    ├── types/
    ├── utils/
    └── index.ts
```

- `schemas/` contains shared serializable validation definitions or schema
  contracts when both applications must use the same boundary.
- `types/` contains API DTOs, domain enums, and response/error contracts.
- `utils/` contains environment-neutral helpers only.
- `index.ts` is the public package entry point and should export only intended
  shared API members.

## 6. Dependency and ownership rules

1. `packages/shared` has no dependency on either deployable application.
2. Backend and frontend may depend on `packages/shared`.
3. Routes depend on middleware and controllers; controllers depend on services.
4. Services depend on repositories and shared/backend types; repositories do
   not depend on services.
5. Frontend pages depend on components, hooks, services, schemas, and types.
6. Frontend repositories own transport and persistence details.
7. UI components do not import backend modules or call `fetch` directly.
8. Shared types describe contracts; they do not replace runtime validation.
9. Circular dependencies are prohibited. Extract a shared contract or helper
   when two modules would otherwise import each other.

## 7. Adding a new file

Before adding a file, identify its primary responsibility and place it in the
corresponding directory. A feature may have one module in several layers
(for example `book-controller.ts`, `book-service.ts`, and
`book-repository.ts`), but each module must preserve its layer boundary.

When a directory is empty, retain it with `.gitkeep` until its first real file
is added. A structure-only change must not create placeholder implementation
files, exports, or runtime behavior.

## 8. Verification

Structure changes are verified by:

- confirming every directory listed in this specification exists;
- confirming each empty directory contains `.gitkeep`;
- confirming `npm run typecheck` remains unchanged by placeholder files; and
- reviewing new files against the dependency and ownership rules.
