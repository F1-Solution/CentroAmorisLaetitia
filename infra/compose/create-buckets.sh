#!/bin/sh
# Crea i due bucket di ADR-004 §3.6. Idempotente: rieseguirlo non cambia nulla.
#
# Nessuno dei due bucket e' leggibile in modo anonimo, nemmeno quello
# "pubblico": ADR-004 §3.6 stabilisce che i file li serve l'applicazione,
# con uno stream, cosi' che il controllo di accesso resti in un punto solo.
set -eu

mc alias set local http://objects:9000 "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null

for bucket in "$S3_BUCKET_PUBLIC" "$S3_BUCKET_PRIVATE"; do
  if mc ls "local/$bucket" >/dev/null 2>&1; then
    echo "bucket gia' presente: $bucket"
  else
    mc mb "local/$bucket"
    echo "bucket creato: $bucket"
  fi
  # Nessun accesso anonimo, su entrambi.
  mc anonymous set none "local/$bucket" >/dev/null
done

echo "bucket pronti."
