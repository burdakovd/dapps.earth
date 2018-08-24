#!/bin/bash -e

[ ! -z "$HOSTS" ]
[ ! -z "$BASE_DOMAIN" ]
[ ! -z "$NS_DOMAIN" ]
[ ! -z "$ADMIN_EMAIL" ]

function get_credentials() {
  CREDENTIALS_FILE='/acme-dns-auth/credentials'
  export ACMEDNS_UPDATE_URL="http://acme-dns/update"

  if [ ! -f $CREDENTIALS_FILE ]; then
    /usr/bin/curl -X POST --silent --show-error --fail \
        "http://acme-dns/register" \
        -o $CREDENTIALS_FILE.staging && \
      mv $CREDENTIALS_FILE.staging $CREDENTIALS_FILE || return 1
  fi

  export ACMEDNS_USERNAME="$(jq -r '.username' < $CREDENTIALS_FILE)"
  export ACMEDNS_PASSWORD="$(jq -r '.password' < $CREDENTIALS_FILE)"
  export ACMEDNS_SUBDOMAIN="$(jq -r '.subdomain' < $CREDENTIALS_FILE)"

  ! [ -z "$ACMEDNS_USERNAME" ] || return 1
  ! [ -z "$ACMEDNS_PASSWORD" ] || return 1
  ! [ -z "$ACMEDNS_SUBDOMAIN" ] || return 1
}

CACHE_VERSION=5

function record_success() {
  HOST="$1"
  encoded=$(echo "$CACHE_VERSION.$HOST" | base64)
  date >> "/successes/$encoded"
}

function is_fresh() {
  HOST="$1"
  encoded=$(echo "$CACHE_VERSION.$HOST" | base64)
  file="/successes/$encoded"
  if [ ! -f "$file" ]; then
    echo "We haven't ever received a certificate for $HOST"
    return 1
  fi

  lastModificationSeconds=$(date +%s -r "$file")
  currentSeconds=$(date +%s)
  elapsedDays=$(echo "scale=3; ($currentSeconds - $lastModificationSeconds) / 86400" | bc)

  echo "Domain $HOST was issued a certificate $elapsedDays days ago"
  fresh=$(echo "$elapsedDays<7" | bc)

  if [ "$fresh" -eq "1" ]; then
    return 0;
  else
    return 1;
  fi
}

while true; do
  wait-for acme-dns:80

  if get_credentials; then
    echo "In order for automatic SSL certificate management to work, "
    echo "the following DNS records need to be made manually once:"
    SANITIZED_HOSTS=$((for HOST in $HOSTS; do echo $HOST | sed 's/^[*].//'; done) | sort | uniq)
    for HOST in $SANITIZED_HOSTS; do
      echo "  _acme-challenge.$HOST CNAME => $ACMEDNS_SUBDOMAIN.acme-dns.$BASE_DOMAIN"
    done
    echo "  acme-dns.$BASE_DOMAIN NS => $NS_DOMAIN"
    echo "  $NS_DOMAIN should resolve to a public IP address of this server"

    if ! is_fresh "$HOSTS"; then
      echo "Making certificate request for $HOSTS..."
      acme.sh \
        --force \
        --issue \
        --dns dns_acmedns \
        -d $(echo $HOSTS | sed 's/ / -d /g') \
        &
      if wait $!; then
        echo "Got certificate for $HOSTS..."
        mkdir -p /etc/nginx/certs/$SANITIZED_HOST
        for HOST in $(echo $HOSTS | awk '{print $1}'); do
          SANITIZED_HOST=$(echo $HOST | sed 's/[*]/wildcard/')
          acme.sh --install-cert -d $HOST \
            --cert-file /etc/nginx/certs/$SANITIZED_HOST/cert \
            --key-file /etc/nginx/certs/$SANITIZED_HOST/key \
            --fullchain-file /etc/nginx/certs/$SANITIZED_HOST/fullchain \
            --reloadcmd "true"
        done
        date >> /etc/nginx/certs/signal
        record_success "$HOSTS"
      else
        echo "Renewal for $HOSTS failed!"
      fi
    else
      echo "Skipping certificate request for $HOSTS as it is fresh enough"
    fi
  else
    echo "Failed to get credentials..."
  fi

  echo "Waiting before next attempt..."
  sleep 86400 & wait $!
done
