
# Self-Host on EC2 via Docker

Goal: produce a Docker image (and a `docker-compose.yml`) that bundles the TanStack Start app, a PostgreSQL database, and a self-hosted Supabase auth/API stack, so you can run everything on one EC2 instance and reach it via the instance's public IP.

## Important caveats

- **Lovable Cloud data does not migrate automatically.** Your existing pages, comments, spaces, profiles, and users live in Lovable's managed Supabase. To run "everything bundled," I'll add a one-time SQL dump/restore step you run manually (I'll generate the schema migration; data export needs your action from Cloud).
- **Auth + Storage need self-hosted Supabase**, not just Postgres. The app uses `@supabase/supabase-js`, RLS policies, and `auth.users`. Easiest path: include the official `supabase/postgres` + GoTrue + PostgREST images via docker-compose rather than a single bespoke image. The "one image" experience is delivered as one `docker compose up`.
- **No HTTPS via raw IP.** Browsers will work over `http://<ec2-ip>`, but Google OAuth and secure cookies require a domain + TLS. For IP-only access, use email/password auth.
- **Server runtime**: the app currently targets Cloudflare Workers. For Node/EC2 we'll switch the Vite/Nitro preset to `node-server` so it runs as a normal Node process in the container.

## Deliverables

1. `Dockerfile` — multi-stage build of the TanStack Start app (Bun install → Vite build with `node-server` preset → slim Node runtime serving `.output/server/index.mjs` on port 3000).
2. `docker-compose.yml` with services:
   - `db` — `supabase/postgres` (Postgres 15 + required extensions), volume-mounted data
   - `auth` — `supabase/gotrue` (email/password enabled, signup confirm off for IP setup)
   - `rest` — `postgrest/postgrest` (the Data API)
   - `studio` (optional) — `supabase/studio` for DB admin
   - `app` — built from the Dockerfile, depends on `db`/`auth`/`rest`
3. `.env.example` — all required vars (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SUPABASE_URL=http://<ec2-ip>:8000`, etc.) + a helper script `scripts/gen-keys.sh` to mint the JWT keys.
4. `supabase/migrations/` consolidated initial schema (tables, RLS policies, functions, triggers) generated from current Lovable Cloud schema, auto-applied on first `db` boot.
5. `README-deploy.md` — step-by-step EC2 guide:
   - Launch Ubuntu 22.04 t3.small+ instance, open security group ports 22, 80, 3000, 8000
   - Install Docker + Compose
   - `git clone` → fill `.env` → `docker compose up -d`
   - Access app at `http://<ec2-public-ip>:3000`
   - (Optional) put Caddy/Nginx in front for port 80 + a domain later
6. Minor app change: switch the Supabase client to read `VITE_SUPABASE_URL` from runtime env so the same image works against any EC2 IP without rebuilding.

## Out of scope (ask if you want them)

- Automated data migration from Lovable Cloud (I'll document `pg_dump`/`pg_restore` instead)
- HTTPS/domain setup (Caddy auto-TLS config) — needs a domain
- Google OAuth on self-hosted (needs domain + provider redirect URLs)
- CI/CD pipeline, ECR push, Terraform

## Technical notes

- The PostgREST + GoTrue combo is what Supabase actually is under the hood, so RLS policies and the JS client keep working unchanged once `VITE_SUPABASE_URL` points at your EC2 host.
- `auth-attacher` and `requireSupabaseAuth` server middleware continue to work — they only depend on the Supabase JWT format, which GoTrue produces.
- Postgres data persists in a named Docker volume (`db-data`); back it up with `docker exec ... pg_dump`.

Confirm and I'll generate all the files.
