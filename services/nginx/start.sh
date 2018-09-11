#!/bin/bash -e

if [ ! -z "$JUST_PRINT_AUDIT_PAGE" ]; then
  cat /var/www/static/audit.html
  exit 0
fi

[ ! -z "$BASE_DOMAIN" ]

sed "s/BASE_DOMAIN/$BASE_DOMAIN/g" /etc/nginx/nginx-template.conf \
  > /etc/nginx/nginx.conf

(
  echo server_name && \
  cat /etc/nginx/blacklist.txt \
    | grep . \
    | sed "s/$/.$BASE_DOMAIN/g" \
    | sed "s/^/  /g" && \
  echo ';'
) > /etc/nginx/blacklisted-server-names.conf

tail -vn +0 /etc/nginx/blacklisted-server-names.conf

SIGNAL=/etc/nginx/certs/signals/signal

# Wait until we populate certs directory at least once
while [ ! -f $SIGNAL ]; do
  sleep 1;
done

reload() {
  echo "Reloading nginx"
  nginx -s reload
}

function watch() {
  inotifywait -q -m -e close_write --format %e $SIGNAL |
  while read events; do
    echo "Config updated"
    reload
  done
}

(watch &) &

# just to test reload works
((sleep 10 && reload) &) &

exec nginx -g "daemon off;";
