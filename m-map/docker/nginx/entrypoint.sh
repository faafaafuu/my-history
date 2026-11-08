#!/bin/sh
# TLS без ручных шагов: пока Let's Encrypt не выдал сертификат — самоподписанный,
# потом nginx сам переключается на настоящий (проверка раз в час, reload).
set -eu
DOMAIN="${DOMAIN:-localhost}"
export HTTPS_PORT="${HTTPS_PORT:-443}"
LE="/etc/letsencrypt/live/$DOMAIN"
SELF=/etc/nginx/selfsigned
ACTIVE=/etc/nginx/active-cert

mkdir -p "$SELF" "$ACTIVE" /var/www/certbot
if [ ! -f "$SELF/fullchain.pem" ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 30 -subj "/CN=$DOMAIN" \
    -keyout "$SELF/privkey.pem" -out "$SELF/fullchain.pem" >/dev/null 2>&1
fi

pick() {
  if [ -f "$LE/fullchain.pem" ]; then src="$LE"; else src="$SELF"; fi
  ln -sf "$src/fullchain.pem" "$ACTIVE/fullchain.pem"
  ln -sf "$src/privkey.pem" "$ACTIVE/privkey.pem"
}
pick

envsubst '${DOMAIN} ${HTTPS_PORT}' < /etc/nginx/mmap/site.conf.tpl > /etc/nginx/conf.d/default.conf

(
  while :; do
    sleep 3600
    pick
    nginx -s reload 2>/dev/null || true
  done
) &

exec nginx -g 'daemon off;'
