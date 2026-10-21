#!/bin/bash
set -euo pipefail
export NGINX_WORKER_PROCESSES="${NGINX_WORKER_PROCESSES:-2}"
export NGINX_WORKER_CONNECTIONS="${NGINX_WORKER_CONNECTIONS:-1024}"
rm -f /etc/nginx/sites-enabled/default /etc/supervisor/conf.d/ds-adminpanel.conf
sed -i 's/COMPANY_NAME/onlyoffice/g' /etc/supervisor/conf.d/*.conf
store=/var/lib/onlyoffice/amerika-runtime-data
mkdir -p "$store"
if [ ! -L /var/www/onlyoffice/Data ]; then
 cp -an /var/www/onlyoffice/Data/. "$store/"
 rm -rf /var/www/onlyoffice/Data
 ln -s "$store" /var/www/onlyoffice/Data
fi
chown -R ds:ds "$store"
(sleep 20; nginx -t; supervisorctl status) &
echo 'Amerika editor startup: persistent state and nginx prepared.'
exec /app/ds/run-document-server.sh "$@"
