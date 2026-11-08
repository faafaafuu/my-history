# Генерируется из шаблона при старте (envsubst DOMAIN).

# Логи без query string: в адресах могут быть поисковые запросы по узлам.
log_format noquery '$remote_addr [$time_local] "$request_method $uri" $status $body_bytes_sent $request_time';

limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}

upstream web {
  server web:3000;
  keepalive 16;
}

server {
  listen 80;
  server_name ${DOMAIN};

  location /.well-known/acme-challenge/ { root /var/www/certbot; }
  location = /nginx-health { access_log off; return 200 "ok\n"; }
  location / { return 301 https://$host:${HTTPS_PORT}$request_uri; }
}

server {
  listen 443 ssl;
  http2 on;
  server_name ${DOMAIN};

  ssl_certificate     /etc/nginx/active-cert/fullchain.pem;
  ssl_certificate_key /etc/nginx/active-cert/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;

  client_max_body_size 4m;

  access_log /var/log/nginx/access.log noquery;

  # Метрики наружу не отдаются: Prometheus ходит на web:3000/metrics через
  # docker-сеть metrics. Фильтр по IP здесь не работает — docker подменяет адрес.
  location = /metrics { return 404; }

  location /api/auth/ {
    limit_req zone=auth burst=10 nodelay;
    proxy_pass http://web;
    include /etc/nginx/proxy_params.conf;
  }

  location /api/ {
    limit_req zone=api burst=40 nodelay;
    # AI-ответы через мост бывают долгими.
    proxy_read_timeout 240s;
    proxy_pass http://web;
    include /etc/nginx/proxy_params.conf;
  }

  location / {
    proxy_pass http://web;
    include /etc/nginx/proxy_params.conf;
  }
}
