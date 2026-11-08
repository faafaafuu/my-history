#!/bin/sh
# pg_dump в custom-формате, ротация BACKUP_KEEP_DAYS (14) дней.
set -eu
KEEP="${BACKUP_KEEP_DAYS:-14}"
DIR=/backups
umask 077
stamp=$(date -u +%Y%m%d-%H%M%S)
tmp="$DIR/.mmap-$stamp.dump.partial"
pg_dump -Fc --no-owner -f "$tmp"
mv "$tmp" "$DIR/mmap-$stamp.dump"
find "$DIR" -maxdepth 1 -name 'mmap-*.dump' -mtime "+$KEEP" -delete
echo "backup: mmap-$stamp.dump ($(du -h "$DIR/mmap-$stamp.dump" | cut -f1))"
