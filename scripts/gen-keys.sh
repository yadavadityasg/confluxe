#!/usr/bin/env bash
# Generates a JWT_SECRET plus matching anon + service_role JWTs for self-hosted Supabase.
# Usage:  ./scripts/gen-keys.sh  >> .env
set -euo pipefail

if ! command -v openssl >/dev/null; then echo "openssl required" >&2; exit 1; fi
if ! command -v python3 >/dev/null; then echo "python3 required" >&2; exit 1; fi

JWT_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)

mint() {
  local role=$1
  python3 - "$JWT_SECRET" "$role" <<'PY'
import sys, json, base64, hmac, hashlib, time
secret, role = sys.argv[1], sys.argv[2]
def b64(b): return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
header  = b64(json.dumps({"alg":"HS256","typ":"JWT"}, separators=(',',':')).encode())
payload = b64(json.dumps({"role":role,"iss":"supabase","iat":int(time.time()),"exp":int(time.time())+60*60*24*365*10}, separators=(',',':')).encode())
msg = f"{header}.{payload}".encode()
sig = b64(hmac.new(secret.encode(), msg, hashlib.sha256).digest())
print(f"{header}.{payload}.{sig}")
PY
}

ANON_KEY=$(mint anon)
SERVICE_ROLE_KEY=$(mint service_role)

cat <<EOF
# --- generated $(date) ---
JWT_SECRET=$JWT_SECRET
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOF
