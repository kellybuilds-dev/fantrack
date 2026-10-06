# fantrack

## Local PostgreSQL and API

Prerequisites: Node.js 24 or later, npm, Docker, and Docker Compose.

1. Copy `.env.example` to `.env` and set a local-only `PGPASSWORD`. Keep `.env` private and never reuse its development password elsewhere.
2. Install the Node dependencies with `npm install`.
3. Start the local PostgreSQL container with `docker compose up -d`.
4. Apply the database migrations with `npm run db:migrate`.
5. Import and verify the canonical artist/update data with `npm run db:import`. The importer reads the shared JavaScript modules and fails rather than overwriting conflicting records.
6. Check the imported data with `npm run db:verify`.
7. Start the API with `npm start` (default port `3000`).

The PostgreSQL data is stored in the named `fantrack-postgres-data` Docker volume, outside the repository. Stop the database with `docker compose down`. To reset this development database, run `docker compose down -v` and then repeat the startup, migration, and import steps. **Resetting with `-v` permanently deletes the local database volume.**

Database connection settings can be provided through `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` in `.env`, as shown in `.env.example`. The API connection module also supports `DATABASE_URL`; when it is set, it is used instead of those individual connection settings. Docker Compose uses the `PG*` settings.

## API

The API returns JSON. Catalog routes use PostgreSQL for response data. The frontend currently loads `fantrack-artists.js` and `fantrack-updates.js` directly instead of fetching these API routes. Those canonical JavaScript modules are still used by the API to preserve legacy ordering and public update-ID compatibility.

### Endpoints

| Method and path | Purpose and parameters | Success response |
|---|---|---|
| `GET /api/health` | Check PostgreSQL readiness. No parameters; runs a database connectivity check. | `{"success":true,"service":"FANTRACK API","status":"ok"}` |
| `POST /api/auth/register` | Register with JSON `email`, `username`, and `password`; email and username are trimmed and lowercased, username must be 3–30 ASCII letters/digits/underscores, and password must be 12–128 Unicode code points. Request body limit is 8 KiB. Registration does not create a session. | `201`: `{"success":true,"data":{"id":"...","email":"...","username":"...","createdAt":"..."}}` |
| `POST /api/auth/login` | Log in with JSON `email` and `password`; email is normalized as during registration. Request body limit is 8 KiB. Success sets an HttpOnly, SameSite=Lax, Path=/ cookie with a seven-day lifetime; production also sets Secure. | `200`: `{"success":true,"data":{"id":"...","email":"...","username":"..."}}` |
| `GET /api/me` | Identify the current user using a valid, unexpired server-side session from the `fantrack_session` cookie. | `200`: `{"success":true,"data":{"id":"...","email":"...","username":"..."}}` |
| `GET /api/artists` | List artists. No query parameters, filtering, or pagination. | `{"success":true,"data":[{"id":"...","name":"...","type":"...","music":"...","image":"..."}]}` |
| `GET /api/artists/:id` | Get one artist by its path `id`. | `{"success":true,"data":{"id":"...","name":"...","type":"...","music":"...","image":"..."}}` |
| `GET /api/updates` | List artist updates. No query parameters, filtering, or pagination. | `{"success":true,"data":[{"id":"...","artistId":"...","artistName":"...","type":"...","title":"...","description":"...","date":"...","link":"..."}]}` |
| `GET /api/updates/:id` | Get one update by its public path `id`. | `{"success":true,"data":{"id":"...","artistId":"...","artistName":"...","type":"...","title":"...","description":"...","date":"...","link":"..."}}` |

Artist responses contain `id`, `name`, `type`, and `music`; `image` is omitted when there is no image value. Update responses contain `id`, `artistId`, `artistName`, `type`, `title`, `description`, `date`, and `link`. The public update `id` is the URL-safe Base64 encoding of the JSON array `[artistId, type, title]`; it is not the database UUID.

List paths must match exactly: trailing-slash variants such as `/api/artists/` and `/api/updates/` do not match the list routes.

### Error responses

Errors use these generic JSON envelopes:

| HTTP status | When returned | Response |
|---|---|---|
| `400 Bad Request` | Malformed request URL or detail path, or invalid registration/login JSON or fields. | `{"success":false,"error":"Bad request"}` |
| `404 Not Found` | Unknown route, missing artist/update, or invalid public update ID. | `{"success":false,"error":"Not found"}` |
| `405 Method Not Allowed` | Method other than the method supported by a recognized endpoint. Includes the appropriate `Allow` header. | `{"success":false,"error":"Method not allowed"}` |
| `401 Unauthorized` | Login email/password pair is invalid, or `/api/me` has no valid session. Login does not distinguish an unknown email from a wrong password; `/api/me` does not distinguish a missing, invalid, expired, or orphaned session. | Login: `{"success":false,"error":{"code":"INVALID_CREDENTIALS","message":"Invalid email or password"}}`; `/api/me`: `{"success":false,"error":"Unauthorized"}` |
| `409 Conflict` | Registration email or username conflicts with an existing account. Does not identify which value conflicted. | `{"success":false,"error":{"code":"REGISTRATION_CONFLICT","message":"Unable to register with these details"}}` |
| `413 Content Too Large` | Registration or login request body exceeds 8 KiB. | `{"success":false,"error":"Request body too large"}` |
| `415 Unsupported Media Type` | Registration or login request does not use `application/json`. | `{"success":false,"error":"Unsupported content type"}` |
| `503 Service Unavailable` | PostgreSQL connectivity or query failure. | `{"success":false,"error":"Service unavailable"}` |
| `500 Internal Server Error` | Unexpected request-handler failure. | `{"success":false,"error":"Internal server error"}` |

Login creates a database-backed session and sets its opaque token in an HttpOnly cookie; only a SHA-256 hash of the token is stored in PostgreSQL. The cookie is Secure when `NODE_ENV=production`, so production must use HTTPS. The API has no logout or follow write endpoints yet.
