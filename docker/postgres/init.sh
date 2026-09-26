#!/bin/sh
# Runs once, on an empty data volume. CI runs roles.sql the same way with psql.
set -eu

psql --username "$POSTGRES_USER" --dbname postgres \
  -v db_name="${DB_NAME:-bhoomisetu}" \
  -v owner_pass="${DB_OWNER_PASSWORD:-owner_pass}" \
  -v app_pass="${DB_APP_PASSWORD:-app_pass}" \
  -v worker_pass="${DB_WORKER_PASSWORD:-worker_pass}" \
  -f /bhoomisetu/roles.sql
