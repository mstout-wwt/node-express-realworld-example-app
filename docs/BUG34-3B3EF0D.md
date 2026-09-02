# BUG34-3B3EF0D — Auth Token Header Handling

## Overview

This note describes how the Conduit API reads and validates JSON Web Tokens (JWTs)
from incoming HTTP request headers.

---

## Token Extraction (`src/app/routes/auth/auth.ts`)

All protected and optionally-protected routes share a single helper,
`getTokenFromHeaders`, that inspects the standard `Authorization` header:

```
Authorization: Token <jwt>
Authorization: Bearer <jwt>
```

Both the **`Token`** scheme (required by the RealWorld spec) and the conventional
**`Bearer`** scheme are accepted.  The function splits the header value on a
single space and returns the second segment (the raw JWT string).  If the header
is absent or uses any other scheme, the function returns `null`.

```ts
const getTokenFromHeaders = (req: express.Request): string | null => {
  if (
    (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Token') ||
    (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer')
  ) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};
```

---

## JWT Verification (`express-jwt` middleware)

The extracted token is verified by `express-jwt` (`expressjwt`) using:

| Setting | Value |
|---|---|
| **Secret** | `process.env.JWT_SECRET` (falls back to the hard-coded string `"superSecret"` when the env var is unset) |
| **Algorithm** | `HS256` (HMAC-SHA-256 symmetric signing) |

Two middleware variants are exported from `auth.ts`:

| Export | `credentialsRequired` | Behaviour |
|---|---|---|
| `auth.required` | `true` (default) | Rejects the request with **401 Unauthorized** if no valid token is present |
| `auth.optional` | `false` | Allows the request to proceed even without a token; `req.auth` will be `undefined` |

---

## Token Generation (`src/app/routes/auth/token.utils.ts`)

Tokens are minted with `jsonwebtoken.sign` and carry a single claim:

```json
{ "user": { "id": <numeric user id> } }
```

They expire after **60 days**.  Downstream handlers read the authenticated user's
id via `req.auth?.user?.id`.

---

## Error Handling (`src/main.ts`)

If `express-jwt` rejects a token it throws an `UnauthorizedError`
(`err.name === 'UnauthorizedError'`).  The global Express error handler catches
this and responds with:

```json
{ "status": "error", "message": "missing authorization credentials" }
```

HTTP status code **401**.

---

## Affected Routes

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/users` | None |
| `POST` | `/api/users/login` | None |
| `GET` | `/api/user` | `auth.required` |
| `PUT` | `/api/user` | `auth.required` |
| `GET` | `/api/profiles/:username` | `auth.optional` |
| `POST` | `/api/profiles/:username/follow` | `auth.required` |
| `DELETE` | `/api/profiles/:username/follow` | `auth.required` |
| `GET` | `/api/articles` | `auth.optional` |
| `POST` | `/api/articles` | `auth.required` |
| `GET` | `/api/articles/feed` | `auth.required` |
| `GET` | `/api/articles/:slug` | `auth.optional` |
| `PUT` | `/api/articles/:slug` | `auth.required` |
| `DELETE` | `/api/articles/:slug` | `auth.required` |
| `POST` | `/api/articles/:slug/comments` | `auth.required` |
| `GET` | `/api/articles/:slug/comments` | `auth.optional` |
| `DELETE` | `/api/articles/:slug/comments/:id` | `auth.required` |
| `POST` | `/api/articles/:slug/favorite` | `auth.required` |
| `DELETE` | `/api/articles/:slug/favorite` | `auth.required` |
| `GET` | `/api/tags` | None |
