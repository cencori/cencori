#!/usr/bin/env bash
# Copies Cencori's Supabase database into a Brimble (or rehearsal) Postgres
# (RFC-0001 §6). Supabase is only read: SOURCE_DATABASE_URL must be the
# read-only migration_reader user.
#
#   SOURCE_DATABASE_URL=...  TARGET_DATABASE_URL=...  scripts/migrate-data-to-brimble.sh
#
# Optional:
#   EXCLUDE_DATA_TABLES="ai_requests web_documents"  copy these tables' structure but not rows
#   PG_BIN=/opt/homebrew/opt/postgresql@17/bin        Postgres 17 client tools (must match the source major)
#
# Order matters: users are copied into Better Auth's auth_users before the
# foreign keys are recreated, because the 41 FKs that pointed at Supabase's
# auth.users are repointed to public.auth_users (same ids, same ON DELETE).
set -euo pipefail

: "${SOURCE_DATABASE_URL:?set SOURCE_DATABASE_URL}"
: "${TARGET_DATABASE_URL:?set TARGET_DATABASE_URL}"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$(dirname "$0")/.."

log() { printf '[migrate-data] %s\n' "$*"; }
target() { "$PG_BIN/psql" "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }

# Supabase-only grants (roles that don't exist on the target) and the FK
# repoint. Everything else in the dump is applied as is.
clean_schema() {
  sed -E \
    -e '/^(GRANT|REVOKE) .* (TO|FROM) (migration_reader|postgres|supabase_[a-z_]+|dashboard_user|pgsodium_[a-z_]+);$/d' \
    -e '/^ALTER DEFAULT PRIVILEGES /d' \
    -e 's/REFERENCES auth\.users\(id\)/REFERENCES public.auth_users(id)/g'
}

log "1/6 apply database/brimble/*.sql"
BETTER_AUTH_DATABASE_URL="$TARGET_DATABASE_URL" node scripts/brimble-apply-sql.mjs

log "2/6 copy users into Better Auth"
SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" BETTER_AUTH_DATABASE_URL="$TARGET_DATABASE_URL" \
  node scripts/migrate-users-to-better-auth.mjs --apply

log "3/6 schema: tables, functions, policies, grants"
"$PG_BIN/pg_dump" "$SOURCE_DATABASE_URL" --schema=public --no-owner --section=pre-data > "$WORK/pre.sql"
clean_schema < "$WORK/pre.sql" > "$WORK/pre.clean.sql"
target -f "$WORK/pre.clean.sql"

log "4/6 data${EXCLUDE_DATA_TABLES:+ (skipping rows of: $EXCLUDE_DATA_TABLES)}"
exclude_args=()
for t in ${EXCLUDE_DATA_TABLES:-}; do exclude_args+=(--exclude-table-data="public.$t"); done
"$PG_BIN/pg_dump" "$SOURCE_DATABASE_URL" --schema=public --data-only --no-owner "${exclude_args[@]}" > "$WORK/data.sql"
# replica mode: no triggers (audit/ledger triggers must not re-fire on copied
# rows) and no FK checks while loading in dump order.
{ echo "set session_replication_role = replica;"; cat "$WORK/data.sql"; } | target

log "5/6 indexes, constraints, foreign keys (auth.users -> auth_users)"
"$PG_BIN/pg_dump" "$SOURCE_DATABASE_URL" --schema=public --no-owner --section=post-data > "$WORK/post.sql"
clean_schema < "$WORK/post.sql" > "$WORK/post.clean.sql"
target -f "$WORK/post.clean.sql"

log "6/6 re-apply locks and verify row counts"
BETTER_AUTH_DATABASE_URL="$TARGET_DATABASE_URL" node scripts/brimble-apply-sql.mjs > /dev/null
count_sql="select string_agg(format('%s|%s', relname, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', relname), false, true, '')))[1]::text), E'\n' order by relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and relname not like 'auth\_%'"
"$PG_BIN/psql" "$SOURCE_DATABASE_URL" -Atc "$count_sql" > "$WORK/source.counts"
target -Atc "$count_sql" > "$WORK/target.counts"
mismatches=0
while IFS='|' read -r table src; do
  tgt="$(grep -E "^${table}\|" "$WORK/target.counts" | cut -d'|' -f2 || true)"
  if [[ " ${EXCLUDE_DATA_TABLES:-} " == *" $table "* ]]; then
    [[ "$tgt" == "0" ]] || { log "MISMATCH $table: expected 0 (excluded), got ${tgt:-missing}"; mismatches=$((mismatches+1)); }
  elif [[ "$src" != "$tgt" ]]; then
    log "MISMATCH $table: source $src, target ${tgt:-missing}"; mismatches=$((mismatches+1))
  fi
done < "$WORK/source.counts"
log "verified $(wc -l < "$WORK/source.counts" | tr -d ' ') tables, $mismatches mismatches"
[[ "$mismatches" == "0" ]]
