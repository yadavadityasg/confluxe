# Self-Host on a Single EC2 Instance (Zero Third-Party Services)

Everything — app, database, auth, REST API, file storage, TLS — runs on **one EC2 box** via Docker. No Lovable Cloud, no managed Supabase, no Google OAuth, no external SMTP, no S3.

## What runs

```
                ┌────────────────────────────┐
   Browser ───▶ │  Caddy  (80 / 443)         │  ← only public ports
                │   ├─ /            → app    │
                │   └─ /supabase/*  → gateway│
                └──────────┬─────────────────┘
                           │ private docker network
        ┌──────────────────┼─────────────────────┐
        ▼                  ▼                     ▼
   app:3000          gateway:8000           bootstrap (one-shot)
   TanStack Start    ├─ /auth/v1  → auth:9999    (GoTrue)
                     ├─ /rest/v1  → rest:3000    (PostgREST)
                     └─ /storage/v1 → storage:5000
                           │
                           ▼
                     db:5432  (Postgres 15)
                     volumes: db-data, storage-data
```

## 1. Provision EC2

- Ubuntu 22.04 LTS, **t3.medium** or larger (4 GB RAM), 30 GB gp3
- Elastic IP attached
- Security group inbound: `22` (your IP), `80` + `443` (0.0.0.0/0)
- Point an A record at the Elastic IP, e.g. `wiki.yourdomain.com` (required for real HTTPS)

## 2. Install Docker

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu && exit   # re-ssh
```

## 3. Clone and configure

```bash
sudo mkdir -p /opt/confluxe && sudo chown $USER /opt/confluxe
git clone <your-repo-url> /opt/confluxe && cd /opt/confluxe
cp .env.example .env
bash scripts/gen-keys.sh >> .env         # appends JWT_SECRET, POSTGRES_PASSWORD, ANON_KEY, SERVICE_ROLE_KEY
```

Edit `.env` and set:

```
DOMAIN=wiki.yourdomain.com
PUBLIC_BASE_URL=https://wiki.yourdomain.com/supabase
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_PASSWORD=<strong password>
```

> **IP-only smoke test:** set `DOMAIN=:80` and `PUBLIC_BASE_URL=http://<EC2_PUBLIC_IP>/supabase`. Browsers will work but the Supabase JS client is happier over HTTPS; switch to a domain before real use.

## 4. Boot the stack

```bash
chmod +x scripts/*.sh docker/init-db.sh
docker compose up -d --build
docker compose logs -f bootstrap   # creates first admin, then exits 0
```

If the app image build looks stuck for a long time at `RUN ... vite build`, rebuild with plain progress so you can see the live phase output:

```bash
docker compose build --progress=plain app
```

This project now builds the production bundle with Node during the image build, which is more reliable on smaller EC2 instances than running the production compile step through Bun.

Open `https://wiki.yourdomain.com` → log in with the bootstrap admin → create more users from **Users** in the sidebar.

## 5. Day-2 ops

| Task | Command |
| --- | --- |
| Status | `docker compose ps` |
| Service logs | `docker compose logs -f <service>` |
| Update app after `git pull` | `docker compose up -d --build app` |
| Apply a new SQL migration | `docker compose exec db psql -U postgres -f /docker-entrypoint-initdb.d/migrations/<file>.sql` |
| Manual backup | `sudo ./scripts/backup.sh` |
| Restore | `sudo ./scripts/restore.sh <db-*.sql.gz> <storage-*.tar.gz>` |
| Wipe everything | `docker compose down -v` |

Install the nightly backup cron (host root crontab):

```
0 3 * * * /opt/confluxe/scripts/backup.sh >> /var/log/confluxe-backup.log 2>&1
```

## 6. Migrating data off Lovable Cloud (optional)

For each table — `profiles`, `spaces`, `pages`, `page_versions`, `comments`, `user_roles`, `space_members`:

1. In the Cloud SQL editor: `COPY (SELECT * FROM public.<table>) TO STDOUT WITH CSV HEADER` → save as `<table>.csv`.
2. On EC2:
   ```bash
   docker compose exec -T db psql -U postgres \
     -c "\COPY public.<table> FROM STDIN CSV HEADER" < <table>.csv
   ```

`auth.users` rows cannot be moved (password hashes stay in Cloud). Use the Users panel to recreate accounts — usernames map deterministically because the app uses `username@confluxe.local` internally.

For the `page-images` bucket: download originals from Cloud, then drop them into the storage volume:

```bash
docker cp ./page-images/. confluxe-storage-1:/var/lib/storage/page-images/
```

## 7. What we explicitly do NOT use

- ❌ Lovable Cloud / hosted Supabase
- ❌ Google / Apple / GitHub / Microsoft OAuth
- ❌ External SMTP — auto-confirm is on; password resets go through admins
- ❌ S3 / R2 / GCS — Storage uses the `file` backend on an EBS volume
- ❌ Cloudflare / Vercel / Netlify — Caddy on the same box terminates TLS

## 8. Trade-offs to know up front

- **Single point of failure.** One box = one outage domain.
- **No self-serve password reset** (no SMTP). Admins reset via the Users panel.
- **Backups stay on-box** unless you add off-site copy yourself.
- **Scaling is vertical** — bump instance size. Splitting Postgres onto RDS later is a one-day job.
