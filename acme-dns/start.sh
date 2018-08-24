#!/bin/bash -e

[ ! -z "$BASE_DOMAIN" ]
[ ! -z "$NS_DOMAIN" ]
[ ! -z "$ADMIN_EMAIL" ]

sed "s/BASE_DOMAIN/$BASE_DOMAIN/g" config-template.cfg | \
  sed "s/ADMIN_EMAIL_DOT/$(echo $ADMIN_EMAIL | sed 's/@/./g')/g" | \
  sed "s/NS_DOMAIN/$NS_DOMAIN/g" \
  > config.cfg

exec ./acme-dns
