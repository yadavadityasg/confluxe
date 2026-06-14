#!/bin/sh
# Idempotent first-admin bootstrap.
# Runs as a one-shot compose service. Exits 0 if:
#   - no BOOTSTRAP_ADMIN_USERNAME/PASSWORD set (nothing to do), OR
#   - an admin already exists in public.user_roles, OR
#   - we successfully create the admin via GoTrue + grant the admin role.
set -eu

if [ -z "${BOOTSTRAP_ADMIN_USERNAME:-}" ] || [ -z "${BOOTSTRAP_ADMIN_PASSWORD:-}" ]; then
  echo "[bootstrap] BOOTSTRAP_ADMIN_USERNAME / _PASSWORD not set; skipping."
  exit 0
fi

# Wait for GoTrue
echo "[bootstrap] waiting for auth service..."
i=0
until curl -fsS "$GOTRUE_URL/health" >/dev/null 2>&1; do
  i=$((i+1)); [ "$i" -gt 60 ] && { echo "[bootstrap] auth never became ready"; exit 1; }
  sleep 2
done

# Need psql for the role check + grant. Install on the fly (curlimages/curl is alpine).
command -v psql >/dev/null 2>&1 || apk add --no-cache postgresql-client >/dev/null

ADMIN_COUNT=$(psql -tAc "SELECT count(*) FROM public.user_roles WHERE role = 'admin'" || echo 0)
if [ "${ADMIN_COUNT:-0}" -gt 0 ]; then
  echo "[bootstrap] admin already exists; nothing to do."
  exit 0
fi

EMAIL="${BOOTSTRAP_ADMIN_USERNAME}@wikispace.local"
echo "[bootstrap] creating admin user '${BOOTSTRAP_ADMIN_USERNAME}'..."

RESP=$(curl -fsS -X POST "$GOTRUE_URL/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$BOOTSTRAP_ADMIN_PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"username\":\"$BOOTSTRAP_ADMIN_USERNAME\",\"display_name\":\"$BOOTSTRAP_ADMIN_USERNAME\"}}")

USER_ID=$(echo "$RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n1)
if [ -z "$USER_ID" ]; then
  echo "[bootstrap] failed to create user. Response: $RESP"
  exit 1
fi

psql -v ON_ERROR_STOP=1 -c \
  "INSERT INTO public.user_roles (user_id, role) VALUES ('$USER_ID', 'admin') ON CONFLICT DO NOTHING;"

echo "[bootstrap] done. Login with username='$BOOTSTRAP_ADMIN_USERNAME'."
