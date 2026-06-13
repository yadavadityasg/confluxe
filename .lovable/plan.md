# Self-Host on a Single EC2 Instance (Zero Third-Party Services)

Goal: run the entire wiki — app + database + auth + REST + file storage — on **one EC2 box** using Docker. No Lovable Cloud, no Supabase SaaS, no Google/OAuth, no external SMTP, no managed services. Username + password only (already implemented).

The repo already contains most of the scaffolding (`Dockerfile`, `docker-compose.yml`, `docker/nginx.conf`, `docker/init-db.sh`, `scripts/gen-keys.sh`, `README-deploy.md`). This plan fills the remaining gaps and walks through deployment end-to-end.

---

## 1. What runs on the box

```text
                ┌────────────────────────────┐
   Browser ───▶ │  Caddy (80/443) — TLS      │
                │   ├─ /            → app    │
                │   └─ /supabase/*  → gateway│
                └──────────┬─────────────────┘
                           │
        ┌──────────────────┼─────────────────────┐
        ▼                  ▼                     ▼
   app:3000          gateway:8000 (nginx)   (internal only)
   TanStack Start    ├─ /auth/v1 → gotrue:9999
   Node SSR          ├─ /rest/v1 → postgrest:3000
                     └─ /storage/v1 → storage-api:5000
                           │
                           ▼
                     db:5432 (Postgres 15 + pgjwt + pgcrypto)
                     storage volume: /var/lib/storage
```

All containers live on a private Docker network. Only Caddy is exposed on the public interface (80/443). Postgres, GoTrue, PostgREST, Storage are **not** published to the host.

---

## 2. Gaps to close in the repo

The existing compose stack is close but missing a few pieces. We will:

1. **Add `storage-api`** (self-hosted Supabase Storage) so the `page-images` bucket works without S3. Backend = local filesystem volume.
2. **Add Caddy** as the only public-facing service, with automatic Let's Encrypt (needs a domain) OR a self-signed cert fallback (raw IP).
3. **Harden GoTrue** for username-only auth:
   - `GOTRUE_DISABLE_SIGNUP=true` (admin-only, matches app)
   - `GOTRUE_EXTERNAL_EMAIL_ENABLED=true` but **no SMTP** — `GOTRUE_MAILER_AUTOCONFIRM=true` so the synthetic `username@confluxe.local` accounts skip email verification
   - All external providers off (`GOTRUE_EXTERNAL_GOOGLE_ENABLED=false`, etc.)
4. **Wire the app's storage URL** through the same gateway so `supabase.storage.from('page-images')` resolves on-box.
5. **Add a one-shot `bootstrap` service** that waits for Postgres + GoTrue, then ensures the very first admin user exists by hitting `/setup` server-side (or by inserting directly with the service role key) — so a fresh box is usable without manual SQL.
6. **Persist volumes**: `db-data`, `storage-data`, `caddy-data`, `caddy-config`.
7. **Backups**: nightly `pg_dump` + `tar` of storage volume into `/var/backups/confluxe/`, kept 14 days, via a host cron.

No code in `src/` needs to change — the app already speaks to a Supabase-shaped gateway via `VITE_SUPABASE_URL`.

---

## 3. Files to add / update

- `docker-compose.yml` — add `storage-api`, `caddy`, `bootstrap`; remove host port bindings on `db` / `auth` / `rest` (internal only); add storage volume.
- `docker/nginx.conf` — add `/storage/v1/` proxy to `storage-api:5000`.
- `docker/Caddyfile` — new. Two server blocks: domain (auto-HTTPS) and IP fallback (`tls internal`).
- `docker/init-db.sh` — already applies our migrations; also ensure `pgjwt`, `pgcrypto`, `pg_trgm` extensions and create the `storage` schema for storage-api.
- `scripts/bootstrap-admin.sh` — idempotent: if `public.user_roles` has zero admins, create one using `SUPABASE_SERVICE_ROLE_KEY` + values from `.env` (`BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`).
- `scripts/backup.sh` + `scripts/restore.sh` — pg_dump / pg_restore + storage tarball.
- `.env.example` — add `DOMAIN=`, `BOOTSTRAP_ADMIN_USERNAME=`, `BOOTSTRAP_ADMIN_PASSWORD=`, `STORAGE_BACKEND=file`.
- `README-deploy.md` — rewrite around this plan (one path: domain + HTTPS; IP-only is a footnote).

---

## 4. Step-by-step deployment

### A. Provision the box
- AMI: Ubuntu 22.04 LTS
- Size: **t3.medium** minimum (4 GB RAM — Postgres + GoTrue + Storage + Node SSR + Caddy)
- Disk: 30 GB gp3
- Security group inbound: `22` (your IP), `80` + `443` (0.0.0.0/0). Nothing else.
- Elastic IP attached so the address survives reboots.

### B. DNS (strongly recommended)
Point an A record `wiki.yourdomain.com` at the Elastic IP. Required for real HTTPS; without it the browser will warn on the self-signed cert.

### C. Install Docker
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu && exit  # re-ssh
```

### D. Clone and configure
```bash
git clone <repo> app && cd app
cp .env.example .env
bash scripts/gen-keys.sh >> .env        # JWT_SECRET, POSTGRES_PASSWORD, ANON_KEY, SERVICE_ROLE_KEY
# edit .env:
#   DOMAIN=wiki.yourdomain.com
#   PUBLIC_BASE_URL=https://wiki.yourdomain.com/supabase
#   BOOTSTRAP_ADMIN_USERNAME=admin
#   BOOTSTRAP_ADMIN_PASSWORD=<strong>
```

### E. Boot the stack
```bash
docker compose up -d --build
docker compose logs -f bootstrap   # waits for DB+Auth, creates first admin, exits 0
```
Open `https://wiki.yourdomain.com` → log in with the bootstrap admin → create users from the in-app Users panel.

### F. Day-2 ops
| Task | Command |
| --- | --- |
| Status | `docker compose ps` |
| Update app | `git pull && docker compose up -d --build app` |
| Apply new SQL migrations | `docker compose exec db psql -U postgres -f /docker-entrypoint-initdb.d/migrations/<file>.sql` |
| Manual backup | `sudo /opt/confluxe/backup.sh` |
| Restore | `sudo /opt/confluxe/restore.sh <backup.tar.gz>` |
| Wipe everything | `docker compose down -v` |

Host cron entry installed by the README:
```
0 3 * * * /opt/confluxe/backup.sh >> /var/log/confluxe-backup.log 2>&1
```

---

## 5. Migrating data off Lovable Cloud (optional)

For each public table (`profiles`, `spaces`, `pages`, `page_versions`, `comments`, `user_roles`, `space_members`):

1. In the current Cloud project, `select * from <table>` → export CSV.
2. On EC2: `docker compose exec -T db psql -U postgres -c "\COPY public.<table> FROM STDIN CSV HEADER" < <table>.csv`.

`auth.users` rows cannot be moved (password hashes stay in Cloud). The admin re-creates accounts through the Users panel; existing usernames map 1:1 because the app derives `username@confluxe.local` deterministically.

For the `page-images` bucket: download objects from Cloud Storage, then `docker cp` them into the `storage-data` volume under `page-images/`.

---

## 6. What we explicitly do NOT use

- ❌ Lovable Cloud / hosted Supabase
- ❌ Google / Apple / Microsoft / GitHub OAuth (already removed)
- ❌ External SMTP — auto-confirm is on; no password-reset emails. Admins reset passwords through the in-app Users panel.
- ❌ S3 / R2 / GCS — Storage uses the local `file` backend on an EBS volume.
- ❌ Cloudflare / Vercel / Netlify — Caddy on the same box terminates TLS.
- ❌ External monitoring — `docker compose logs` + the backup cron are enough for a single-box deploy. Adding Prometheus/Grafana later is a separate decision.

---

## 7. Risks & trade-offs (call out before building)

- **Single point of failure.** One EC2 = one outage domain. Acceptable for an internal wiki; not for SLA-bound workloads.
- **No email = no self-serve password reset.** All resets go through an admin. This is the explicit product choice already in the app.
- **Self-signed TLS** (IP-only mode) makes browsers warn and breaks the Supabase JS client on some browsers. Domain + Let's Encrypt is strongly recommended.
- **Backups are local to the box.** Add `aws s3 cp` to `backup.sh` later if you want off-box copies — but that re-introduces a third party, so it's opt-in.
- **Scaling up = vertical only** with this layout. Splitting Postgres onto RDS later is a one-day migration if needed.

---

Reply **"go"** and I'll implement sections 2–3 (compose changes, Caddyfile, bootstrap + backup scripts, rewritten README).
