FROM postgres:16-alpine
COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
