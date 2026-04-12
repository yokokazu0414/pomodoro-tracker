#!/usr/bin/env bash
# Cloud Run に本リポジトリの Vite 静的ビルド（dist）を nginx で配信する。
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

npm ci
npm run build

exec gcloud run deploy pomodoro-tracker \
  --source=. \
  --region=us-west1 \
  --project=abstract-botany-438907-v2 \
  --allow-unauthenticated \
  --clear-env-vars \
  --quiet
