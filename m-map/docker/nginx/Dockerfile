FROM nginx:1.27
# openssl и envsubst уже есть в образе: сборке не нужна сеть.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY site.conf.tpl /etc/nginx/mmap/site.conf.tpl
COPY proxy_params.conf /etc/nginx/proxy_params.conf
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
