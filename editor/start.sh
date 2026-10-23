#!/bin/bash
set -euo pipefail
export NGINX_WORKER_PROCESSES="${NGINX_WORKER_PROCESSES:-2}"
export NGINX_WORKER_CONNECTIONS="${NGINX_WORKER_CONNECTIONS:-1024}"
rm -f /etc/nginx/sites-enabled/default /etc/supervisor/conf.d/ds-adminpanel.conf
sed -i 's/COMPANY_NAME/euro-office/g' /etc/supervisor/conf.d/*.conf
store=/var/lib/euro-office/documentserver/makk-runtime-data
mkdir -p "$store"
if [ ! -L /var/www/euro-office/Data ]; then
 cp -an /var/www/euro-office/Data/. "$store/"
 rm -rf /var/www/euro-office/Data
 ln -s "$store" /var/www/euro-office/Data
fi
chown -R ds:ds "$store"
(sleep 20; nginx -t; supervisorctl status) &
echo 'AltOffice editor startup: persistent state and nginx prepared.'
exec /app/ds/run-document-server.sh "$@"
