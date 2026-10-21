#!/bin/sh
# ローカルのPostgreSQLに使い捨てのDBを作り、マイグレーションを流してRLSのテストをする。
# 使い方: sh db-test/run.sh   （環境変数 PSQL で psql の呼び方を変えられる）
set -e
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}
DB=hidecobo_rls_test_$$
$PSQL -q -c "create database $DB" postgres
trap '$PSQL -q -c "drop database if exists $DB" postgres' EXIT
$PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f db-test/supabase-shim.sql
for f in supabase/migrations/*.sql; do $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
$PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f db-test/rls-test.sql
