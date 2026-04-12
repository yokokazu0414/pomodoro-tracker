#!/usr/bin/env bash
# Cloud Run に本リポジトリの Vite 静的ビルドをデプロイする。
# 前提: gcloud 認証済み、.env.local に VITE_* / VITE_FIRESTORE_DATABASE_ID が入っている。
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env.local ]]; then
  echo "Missing .env.local (copy from .env.example)" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env.local
set +a

BUILD_ENV_FILE="$(mktemp)"
trap 'rm -f "$BUILD_ENV_FILE"' EXIT

{
  echo "VITE_FIREBASE_API_KEY: '${VITE_FIREBASE_API_KEY}'"
  echo "VITE_FIREBASE_AUTH_DOMAIN: '${VITE_FIREBASE_AUTH_DOMAIN}'"
  echo "VITE_FIREBASE_PROJECT_ID: '${VITE_FIREBASE_PROJECT_ID}'"
  echo "VITE_FIREBASE_STORAGE_BUCKET: '${VITE_FIREBASE_STORAGE_BUCKET}'"
  echo "VITE_FIREBASE_MESSAGING_SENDER_ID: '${VITE_FIREBASE_MESSAGING_SENDER_ID}'"
  echo "VITE_FIREBASE_APP_ID: '${VITE_FIREBASE_APP_ID}'"
  if [[ -n "${VITE_FIREBASE_MEASUREMENT_ID:-}" ]]; then
    echo "VITE_FIREBASE_MEASUREMENT_ID: '${VITE_FIREBASE_MEASUREMENT_ID}'"
  fi
  echo "VITE_FIRESTORE_DATABASE_ID: '${VITE_FIRESTORE_DATABASE_ID}'"
} >"$BUILD_ENV_FILE"

exec gcloud run deploy pomodoro-tracker \
  --source=. \
  --region=us-west1 \
  --project=abstract-botany-438907-v2 \
  --allow-unauthenticated \
  --clear-env-vars \
  --build-env-vars-file="$BUILD_ENV_FILE" \
  --quiet
