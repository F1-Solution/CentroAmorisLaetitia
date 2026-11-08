#!/bin/sh
# Crea o aggiorna i due utenti di servizio dell'archivio (1F-W4 T6g): API e backup.
# Idempotente: a ogni avvio ripete la policy, la password e il collegamento fra i due.
#
# - `amoris-api`: legge, scrive e cancella oggetti nei due bucket, senza altri poteri.
# - `amoris-backup`: legge gli oggetti dei due bucket, senza scrivere.
set -eu

for name in S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET_PUBLIC S3_BUCKET_PRIVATE S3_API_USER S3_API_SECRET_KEY S3_BACKUP_USER S3_BACKUP_SECRET_KEY; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "manca $name" >&2
    exit 78
  fi
done

mc alias set local http://objects:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

buckets="\"arn:aws:s3:::$S3_BUCKET_PUBLIC\", \"arn:aws:s3:::$S3_BUCKET_PUBLIC/*\", \"arn:aws:s3:::$S3_BUCKET_PRIVATE\", \"arn:aws:s3:::$S3_BUCKET_PRIVATE/*\""

cat >"$work/api.json" <<JSON
{"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Action": ["s3:GetBucketLocation", "s3:ListBucket", "s3:ListBucketMultipartUploads", "s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"], "Resource": [$buckets]}]}
JSON

cat >"$work/backup.json" <<JSON
{"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Action": ["s3:GetBucketLocation", "s3:ListBucket", "s3:GetObject"], "Resource": [$buckets]}]}
JSON

# Utente, policy e collegamento: ogni passo si può ripetere senza errore.
ensure_user() {
  user=$1
  secret=$2
  policy=$3
  file=$4
  mc admin policy create local "$policy" "$file" >/dev/null
  mc admin user add local "$user" "$secret" >/dev/null
  if ! mc admin user info local "$user" | grep -q "^PolicyName: .*$policy"; then
    mc admin policy attach local "$policy" --user "$user" >/dev/null
  fi
  echo "utente pronto: $user"
}

ensure_user "$S3_API_USER" "$S3_API_SECRET_KEY" amoris-api "$work/api.json"
ensure_user "$S3_BACKUP_USER" "$S3_BACKUP_SECRET_KEY" amoris-backup "$work/backup.json"
