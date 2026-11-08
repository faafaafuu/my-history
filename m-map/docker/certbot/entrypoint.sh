#!/bin/sh
# Выпуск и продление Let's Encrypt через webroot. Без LETSENCRYPT_EMAIL или с
# DOMAIN=localhost ничего не делает (локальный запуск — самоподписанный).
set -u
DOMAIN="${DOMAIN:-localhost}"
EMAIL="${LETSENCRYPT_EMAIL:-}"

if [ "$DOMAIN" = "localhost" ] || [ -z "$EMAIL" ]; then
  echo "certbot: DOMAIN=localhost или нет LETSENCRYPT_EMAIL — пропускаю"
  exec sleep infinity
fi

sleep 10 # nginx должен успеть подняться и отдавать /.well-known
while :; do
  if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
      --email "$EMAIL" --agree-tos --non-interactive ${LETSENCRYPT_STAGING:+--staging} \
      || echo "certbot: выпуск не удался, повтор через час"
  else
    certbot renew --webroot -w /var/www/certbot --quiet
  fi
  sleep 3600
done
