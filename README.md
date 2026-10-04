# fantrack

## Local PostgreSQL foundation

Prerequisites: Node.js 24 or later, npm, Docker, and Docker Compose.

1. Copy `.env.example` to `.env` and set a local-only `PGPASSWORD`. Keep `.env` private and never reuse its development password elsewhere.
2. Install the Node dependencies with `npm install`.
3. Start the local PostgreSQL container with `docker compose up -d`.
4. Apply the database migrations with `npm run db:migrate`.
5. Import and verify the canonical artist/update data with `npm run db:import`. The importer reads the shared JavaScript modules and fails rather than overwriting conflicting records.
6. Check the imported data with `npm run db:verify`.

The PostgreSQL data is stored in the named `fantrack-postgres-data` Docker volume, outside the repository. Stop the database with `docker compose down`. To reset this development database, run `docker compose down -v` and then repeat the startup, migration, and import steps. **Resetting with `-v` permanently deletes the local database volume.**

The current API remains backed by its shared JavaScript modules. This database foundation does not add authentication, provider connections, personal listening data, or database-backed API routes.
