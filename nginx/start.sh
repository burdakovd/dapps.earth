#!/bin/bash -e

[ ! -z "$BASE_DOMAIN" ]

sed "s/BASE_DOMAIN/$BASE_DOMAIN/g" /etc/nginx/nginx-template.conf \
  > /etc/nginx/nginx.conf

SIGNAL=/etc/nginx/certs/signal

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
