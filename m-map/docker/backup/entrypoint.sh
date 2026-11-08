#!/bin/sh
set -eu
chmod 700 /backups
echo "${BACKUP_CRON:-15 3 * * *} /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
# Первый дамп сразу: видно, что бэкапы работают.
/usr/local/bin/backup.sh || echo "backup: первый дамп не удался"
exec crond -f -l 8
