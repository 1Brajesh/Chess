#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUPABASE_CLI="$ROOT_DIR/node_modules/.bin/supabase"

if [[ ! -x "$SUPABASE_CLI" ]]; then
  echo "Supabase CLI not found at $SUPABASE_CLI" >&2
  exit 1
fi

read -rsp "Brajesh admin password: " PASSWORD
echo
read -rsp "Confirm password: " CONFIRM_PASSWORD
echo

if [[ "$PASSWORD" != "$CONFIRM_PASSWORD" ]]; then
  echo "Passwords do not match." >&2
  exit 1
fi

if [[ ${#PASSWORD} -lt 12 ]]; then
  echo "Use at least 12 characters." >&2
  exit 1
fi

ESCAPED_PASSWORD="${PASSWORD//\'/\'\'}"
SQL_FILE="$(mktemp)"
trap 'rm -f "$SQL_FILE"' EXIT

cat > "$SQL_FILE" <<SQL
insert into public.brajesh_admin_config (key, value)
values ('password_hash', crypt('$ESCAPED_PASSWORD', gen_salt('bf')))
on conflict (key) do update
set value = excluded.value;

delete from public.brajesh_admin_sessions;
SQL

"$SUPABASE_CLI" db query --linked -f "$SQL_FILE"
echo "Brajesh admin password updated. Existing admin sessions were signed out."
