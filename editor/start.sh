#!/bin/sh
set -eu
# This service uses a NEW volume; the old editor stays running for existing sessions.
store="${ALTOFFICE_DATA_DIR:-/data}"
mkdir -p "$store"
persist() {
 target="$1"; name="$2"
 if [ -L "$target" ]; then return; fi
 if [ ! -e "$store/$name" ]; then
  mkdir -p "$store/$name"
  if [ -d "$target" ]; then cp -a "$target/." "$store/$name/"; fi
 fi
 if [ -e "$target" ]; then mv "$target" "$target.image-default"; fi
 mkdir -p "$(dirname "$target")"
 ln -s "$store/$name" "$target"
}
persist /var/www/euro-office/Data secrets
persist /var/lib/euro-office/documentserver cache
persist /var/lib/postgresql postgresql
chown -R ds:ds "$store/secrets" "$store/cache"
chown -R postgres:postgres "$store/postgresql"
# Remove Debian's default site, which can retain an IPv6 listener on Railway.
rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf
# Print nginx's actual error if upstream startup fails.
sed -i 's/^service nginx start$/service nginx start || { nginx -t; exit 1; }/' /entrypoint.sh
echo 'AltOffice: Euro-Office editor with persistent state and upstream notices.'
exec /entrypoint.sh "$@"

