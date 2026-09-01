# API Route Reference

## Authentication

### POST /api/users/login

| Property | Value |
|---|---|
| Full path | `POST /api/users/login` |
| Controller | `src/app/routes/auth/auth.controller.ts` (lines 30–37) |
| Service | `src/app/routes/auth/auth.service.ts` → `login()` |
| Mounted via | `src/app/routes/routes.ts` (prefix: `/api`) |
| Auth required | None |

**Request body:**
```json
{
  "user": {
    "email": "string",
    "password": "string"
  }
}
```

**Success response:** `200 OK` — returns `{ user: { ... } }`

**Error handling:** Errors are forwarded to Express `next(error)` for centralised handling.

---

#### Code Location Details

- **JSDoc comment:** `src/app/routes/auth/auth.controller.ts` lines 23–29
- **Route handler:** `src/app/routes/auth/auth.controller.ts` lines 30–37
  ```ts
  router.post('/users/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await login(req.body.user);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });
  ```
- **Service function:** `src/app/routes/auth/auth.service.ts` line 84 — `export const login = async (userPayload: any) => { ... }`
- **Router mounting:** `src/app/routes/routes.ts` — the auth controller is composed into the `/api` prefix via:
  ```ts
  const api = Router()
    .use(tagsController)
    .use(articlesController)
    .use(profileController)
    .use(authController);

  export default Router().use('/api', api);
  ```
