# Architecture

This document describes the structure and design of the `node-express-realworld-example-app` backend — a Node.js / Express / Prisma implementation of the [RealWorld](https://github.com/gothinkster/realworld) API specification ("Conduit").

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Component Diagram](#2-component-diagram)
3. [Directory & Module Map](#3-directory--module-map)
4. [Middleware Stack](#4-middleware-stack)
5. [Routing & Controllers](#5-routing--controllers)
6. [Services](#6-services)
7. [Mappers & Utilities](#7-mappers--utilities)
8. [Data Model](#8-data-model)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Error Handling](#10-error-handling)
11. [Request Lifecycle](#11-request-lifecycle)
12. [Environment Variables](#12-environment-variables)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. High-Level Overview

The application is a **single-process REST API**. There are no microservices, background workers, or message queues — all logic runs in one Node.js process. The only external dependency is a **PostgreSQL** database, accessed exclusively through the **Prisma ORM**.

```
HTTP Client  ──►  Express (Node.js)  ──►  PostgreSQL
```

Key technology choices:

| Concern | Choice |
|---|---|
| Language | TypeScript |
| HTTP framework | Express 4 |
| ORM / DB access | Prisma |
| Database | PostgreSQL |
| Authentication | JWT (HS256) via `express-jwt` |
| Password hashing | bcrypt (10 rounds) |
| Build tooling | Nx |
| Test runner | Jest |

---

## 2. Component Diagram

```mermaid
flowchart TD
    Client["HTTP Client"]
    MW["Express Middleware\nCORS · body-parser · express-jwt"]
    Router["Top-level Router\n/api"]
    AC["ArticleController\n/articles, /articles/:slug\n/articles/:slug/comments\n/articles/:slug/favorite"]
    AuthC["AuthController\n/users, /users/login, /user"]
    PC["ProfileController\n/profiles/:username\n/profiles/:username/follow"]
    TC["TagController\n/tags"]
    AS["ArticleService"]
    AuS["AuthService"]
    PS["ProfileService"]
    TS["TagService"]
    Prisma["PrismaClient (singleton)"]
    DB[("PostgreSQL")]

    Client -->|HTTP| MW
    MW --> Router
    Router --> AC & AuthC & PC & TC
    AC --> AS
    AuthC --> AuS
    PC --> PS
    TC --> TS
    AS & AuS & PS & TS --> Prisma
    Prisma -->|SQL| DB
```

---

## 3. Directory & Module Map

```
.
├── src/
│   ├── main.ts                  # Express app setup & HTTP server entry point
│   ├── assets/                  # Static files served by express.static
│   ├── prisma/
│   │   ├── schema.prisma        # Prisma schema (source of truth for the data model)
│   │   ├── prisma-client.ts     # Singleton PrismaClient with dev-mode hot-reload guard
│   │   ├── seed.ts              # Seeds 12 demo users × 12 articles × 12 comments
│   │   └── migrations/          # SQL migration history (managed by prisma migrate)
│   ├── app/
│   │   ├── models/
│   │   │   └── http-exception.model.ts   # HttpException — carries HTTP status + message
│   │   └── routes/
│   │       ├── routes.ts        # Mounts all sub-routers under /api
│   │       ├── article/         # Article & comment feature module
│   │       ├── auth/            # User registration, login, profile update
│   │       ├── profile/         # Follow / unfollow
│   │       └── tag/             # Tag listing
│   └── tests/
│       ├── prisma-mock.ts       # Deep-mocks PrismaClient via jest-mock-extended
│       ├── services/            # Unit tests for all four services
│       └── utils/               # Unit tests for mapper utilities
├── e2e/                         # End-to-end tests (separate Nx project, Jest + axios)
├── project.json                 # Nx project config (build, serve, lint, test, docker-build)
├── Dockerfile                   # Copies dist/api, runs node api
└── tsconfig.json / tsconfig.app.json / tsconfig.spec.json
```

### Feature module layout (example: `article/`)

Each feature module follows the same four-file pattern:

| File | Role |
|---|---|
| `*.controller.ts` | Thin Express route handlers — extract params, call service, return JSON |
| `*.service.ts` | All business logic — validation, Prisma queries, `HttpException` throws |
| `*.mapper.ts` / `*.utils.ts` | Pure functions that shape raw Prisma results into API response objects |
| `*.model.ts` | TypeScript interfaces for the domain type |

---

## 4. Middleware Stack

Defined in `src/main.ts`, applied globally in this order:

| # | Middleware | Purpose |
|---|---|---|
| 1 | `cors()` | Adds CORS headers; allows requests from any origin |
| 2 | `bodyParser.json()` | Parses `application/json` request bodies |
| 3 | `bodyParser.urlencoded()` | Parses URL-encoded bodies |
| 4 | `routes` | Top-level router (see §5) |
| 5 | `express.static` | Serves files from `src/assets/` |
| 6 | Global error handler | Converts `HttpException` / `UnauthorizedError` to JSON responses |

JWT verification is **not** a global middleware — it is applied per-route as either `auth.required` or `auth.optional` (see §9).

---

## 5. Routing & Controllers

`src/app/routes/routes.ts` mounts four sub-routers under the `/api` prefix:

| Sub-router | Prefix | Endpoints |
|---|---|---|
| `ArticleController` | `/api/articles` | `GET /articles`, `GET /articles/feed`, `POST /articles`, `GET/PUT/DELETE /articles/:slug`, `GET/POST /articles/:slug/comments`, `DELETE /articles/:slug/comments/:id`, `POST/DELETE /articles/:slug/favorite` |
| `AuthController` | `/api/users`, `/api/user` | `POST /users` (register), `POST /users/login`, `GET /user`, `PUT /user` |
| `ProfileController` | `/api/profiles` | `GET /profiles/:username`, `POST/DELETE /profiles/:username/follow` |
| `TagController` | `/api/tags` | `GET /tags` |

Controllers are intentionally thin: they extract values from `req.params`, `req.query`, `req.body`, and `req.auth`, delegate to the service, and either return the result as JSON or call `next(error)`.

---

## 6. Services

Services contain all business logic and are the only layer that talks to Prisma.

| Service | Key responsibilities |
|---|---|
| `AuthService` | Register user (validate, hash password, create, issue JWT), login (compare hash), get/update current user |
| `ArticleService` | CRUD for articles, feed (follows-based), pagination, tag filtering, favorites, comments |
| `ProfileService` | Get profile, follow user, unfollow user |
| `TagService` | Return top-10 tags by article count, scoped to demo/authenticated users |

Services throw `HttpException(statusCode, message)` for all domain errors. The global error handler in `main.ts` catches these and returns the appropriate HTTP status.

---

## 7. Mappers & Utilities

Pure transformation functions that convert raw Prisma result objects into the API response shape:

| File | What it does |
|---|---|
| `article/article.mapper.ts` | Flattens `favoritedBy[]` → `favorited: boolean`, counts `favoritesCount`, embeds author |
| `article/author.mapper.ts` | Computes `following: boolean` from the `followedBy` relation |
| `profile/profile.utils.ts` | `profileMapper` — converts a Prisma `User` into the `{ username, bio, image, following }` profile shape |
| `auth/token.utils.ts` | `generateToken(id)` — signs a JWT (HS256, 60-day expiry) with `JWT_SECRET` |

---

## 8. Data Model

Defined in `src/prisma/schema.prisma`. Database provider: **PostgreSQL**.

```mermaid
erDiagram
    User {
        Int     id        PK
        String  email     UK
        String  username  UK
        String  password
        String  image
        String  bio
        Boolean demo
    }
    Article {
        Int      id          PK
        String   slug        UK
        String   title
        String   description
        String   body
        DateTime createdAt
        DateTime updatedAt
        Int      authorId    FK
    }
    Comment {
        Int      id        PK
        DateTime createdAt
        DateTime updatedAt
        String   body
        Int      articleId FK
        Int      authorId  FK
    }
    Tag {
        Int    id   PK
        String name UK
    }

    User    ||--o{ Article : "authors (UserArticles)"
    User    }o--o{ Article : "favorites (UserFavorites)"
    User    }o--o{ User    : "follows (UserFollows)"
    Article ||--o{ Comment : "has"
    User    ||--o{ Comment : "authors"
    Article }o--o{ Tag     : "tagged with"
```

### Notable design points

- **`demo` flag on User** — seeded demo accounts are marked `demo: true`. Article and tag queries always include demo-user content so unauthenticated visitors see data; non-demo content is only visible to its owner.
- **Slug generation** — `slugify(title)-{authorId}`. Uniqueness is enforced at the database level.
- **Tags** — implicit many-to-many (`Article ↔ Tag`). Tags are created via Prisma's `connectOrCreate`, so the same tag name is never duplicated.
- **Cascade deletes** — deleting a `User` cascades to their `Article` and `Comment` rows; deleting an `Article` cascades to its `Comment` rows.

### Migrations

Four migration snapshots live in `src/prisma/migrations/`:

| Migration timestamp | Description |
|---|---|
| `20210924225358_initial` | Initial schema |
| `20211001143221_implicit_tags` | Implicit many-to-many for tags |
| `20211105153605_api_url` | API URL field update |
| `20211221184529_deprecated_preview` | Removed deprecated Prisma preview features |

---

## 9. Authentication & Authorization

Implemented in `src/app/routes/auth/auth.ts` using `express-jwt`.

### Token format

JWTs are signed with **HS256** using the `JWT_SECRET` environment variable (falls back to `"superSecret"` in development). Tokens expire after **60 days**. The payload contains `{ user: { id } }`.

### Header format

Both schemes are accepted:

```
Authorization: Token <jwt>
Authorization: Bearer <jwt>
```

### Route protection levels

| Middleware | Behaviour |
|---|---|
| `auth.required` | Rejects requests without a valid JWT with HTTP 401 |
| `auth.optional` | Decodes the JWT if present; proceeds without error if absent (`credentialsRequired: false`) |

On success, `req.auth.user.id` holds the authenticated user's database ID and is passed down to the service layer.

---

## 10. Error Handling

```mermaid
flowchart LR
    S["Service throws\nHttpException(code, msg)"]
    C["Controller calls\nnext(error)"]
    EH["Global error handler\n(main.ts)"]
    R["JSON response"]

    S --> C --> EH --> R
```

The global error handler (last middleware in `main.ts`) handles three cases:

| Error type | HTTP status | Response body |
|---|---|---|
| `UnauthorizedError` (express-jwt) | 401 | `{ status: 'error', message: 'missing authorization credentials' }` |
| `HttpException` | `err.errorCode` | `err.message` (structured, e.g. `{ errors: { field: [...] } }`) |
| Any other `Error` | 500 | `err.message` |

---

## 11. Request Lifecycle

```mermaid
sequenceDiagram
    participant C  as HTTP Client
    participant MW as Express Middleware
    participant R  as Router /api
    participant Ct as Controller
    participant S  as Service
    participant P  as PrismaClient
    participant DB as PostgreSQL

    C->>MW: HTTP Request
    MW->>MW: CORS headers
    MW->>MW: Parse JSON body
    MW->>MW: Decode JWT (auth.required / auth.optional)
    MW->>R: Route to /api/*
    R->>Ct: Match route handler
    Ct->>S: Call service function
    S->>P: Prisma query
    P->>DB: SQL
    DB-->>P: Result rows
    P-->>S: Typed result object
    S-->>Ct: Mapped response object
    Ct-->>C: JSON response
```

If any step throws, Express forwards the error to the global error handler.

---

## 12. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/db`) |
| `JWT_SECRET` | Yes (prod) | Secret used to sign and verify JWTs. Defaults to `"superSecret"` — **must be set in production** |
| `PORT` | No | HTTP port the server listens on. Defaults to `3000` |

---

## 13. Testing Strategy

### Unit tests (`src/tests/`)

- Run with `npx nx test api` (or `npm test`).
- Each service has a dedicated test file (`auth.service.test.ts`, `article.service.test.ts`, etc.).
- `src/tests/prisma-mock.ts` deep-mocks `PrismaClient` via `jest-mock-extended` and resets all mocks before each test, so no real database is needed.
- Mapper/utility functions are tested independently in `src/tests/utils/`.

### End-to-end tests (`e2e/`)

- Separate Nx project; run with `npx nx e2e e2e`.
- Uses Jest + axios against a live running server.
- `e2e/src/server/server.spec.ts` contains a smoke test (`GET /` → HTTP 200).
- Global setup/teardown hooks live in `e2e/src/support/`.

### Test configuration

| File | Purpose |
|---|---|
| `jest.config.ts` | Jest config for unit tests (ts-jest, coverage thresholds) |
| `jest.preset.js` | Shared Nx Jest preset (`@nx/jest/preset/jest-preset`) |
| `tsconfig.spec.json` | TypeScript config that includes test source files |
