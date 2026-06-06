# Deploying to a single EC2 instance (Docker)

This bundles the app, PostgreSQL, Supabase Auth (GoTrue), and PostgREST into one
`docker compose` stack. You reach the app at `http://<EC2_PUBLIC_IP>:3000`.

> **Heads up:** raw-IP access works for email/password auth only. Google OAuth and
> secure cookies need a domain + HTTPS — see *Add a domain* at the bottom.

## 1. Launch an EC2 instance

- AMI: **Ubuntu 22.04 LTS**
- Type: **t3.small** or larger (2 GB RAM minimum — Postgres + Node + GoTrue)
- Storage: 20 GB+
- Security group inbound rules:
  | Port | Source     | Why                         |
  |------|------------|-----------------------------|
  | 22   | your IP    | SSH                         |
  | 3000 | 0.0.0.0/0  | The app                     |
  | 8000 | 0.0.0.0/0  | Supabase gateway (auth/rest)|

## 2. Install Docker

```bash
ssh ubuntu@<EC2_PUBLIC_IP>
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker ubuntu && exit   # re-ssh so the group takes effect
```

## 3. Get the code

```bash
git clone <your-repo-url> app && cd app
cp .env.example .env
bash scripts/gen-keys.sh >> .env       # appends JWT_SECRET/ANON_KEY/SERVICE_ROLE_KEY
```

Edit `.env` and set:

```
PUBLIC_BASE_URL=http://<EC2_PUBLIC_IP>:8000
```

## 4. Build and start

```bash
docker compose up -d --build
docker compose logs -f app             # ctrl-c when you see "listening on :3000"
```

Open `http://<EC2_PUBLIC_IP>:3000`. Sign up with email/password — auto-confirm is
on, so you're logged in immediately.

## 5. Daily ops

| Action                 | Command                                          |
|------------------------|--------------------------------------------------|
| Status                 | `docker compose ps`                              |
| Logs                   | `docker compose logs -f <service>`               |
| Update after git pull  | `docker compose up -d --build app`               |
| DB backup              | `docker compose exec db pg_dump -U postgres postgres > backup.sql` |
| DB restore             | `docker compose exec -T db psql -U postgres < backup.sql`          |
| Wipe everything        | `docker compose down -v`                         |

## 6. Migrate data from Lovable Cloud (optional)

1. From Lovable Cloud → Backend → Database, run a SQL dump:
   ```sql
   -- in Lovable Cloud SQL editor
   COPY (SELECT * FROM public.profiles) TO STDOUT WITH CSV HEADER;
   -- repeat for spaces, pages, page_versions, comments
   ```
2. On EC2:
   ```bash
   docker compose exec -T db psql -U postgres -c "\COPY public.profiles FROM STDIN CSV HEADER" < profiles.csv
   ```

Users in `auth.users` need to be recreated; we cannot move their hashed passwords
out of Lovable Cloud. Easiest: have users sign up again on the new instance.

## 7. Add a domain (recommended after IP smoke-test)

1. Point an A record to your EC2 IP.
2. Drop Caddy in front for automatic HTTPS:
   ```yaml
   # add to docker-compose.yml
   caddy:
     image: caddy:2
     ports: ["80:80", "443:443"]
     volumes:
       - ./Caddyfile:/etc/caddy/Caddyfile
       - caddy-data:/data
   ```
   `Caddyfile`:
   ```
   yourdomain.com {
     reverse_proxy app:3000
   }
   api.yourdomain.com {
     reverse_proxy gateway:8000
   }
   ```
3. Update `.env`: `PUBLIC_BASE_URL=https://api.yourdomain.com` → rebuild app.

## Architecture

```
  ┌──────────┐    ┌──────────┐
  │ Browser  │───▶│ app:3000 │ (TanStack Start, SSR Node)
  └────┬─────┘    └──────────┘
       │
       │ /auth/v1/*, /rest/v1/*
       ▼
  ┌──────────────┐   ┌────────────┐   ┌──────────────┐
  │ gateway:8000 │──▶│ auth:9999  │──▶│              │
  │   (nginx)    │   │ (GoTrue)   │   │  db:5432     │
  │              │──▶│ rest:3000  │──▶│ (Postgres)   │
  └──────────────┘   │ (PostgREST)│   └──────────────┘
                     └────────────┘
```
