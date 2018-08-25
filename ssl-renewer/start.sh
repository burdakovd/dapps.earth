#!/bin/bash -e

[ ! -z "$HOSTS" ]
[ ! -z "$BASE_DOMAIN" ]
[ ! -z "$NS_DOMAIN" ]
[ ! -z "$ADMIN_EMAIL" ]

function load_credentials() {
  export ACMEDNS_USERNAME="$(jq -r '.username' < $1)"
  export ACMEDNS_PASSWORD="$(jq -r '.password' < $1)"
  export ACMEDNS_SUBDOMAIN="$(jq -r '.subdomain' < $1)"

  ! [ -z "$ACMEDNS_USERNAME" ] || return 1
  ! [ -z "$ACMEDNS_PASSWORD" ] || return 1
  ! [ -z "$ACMEDNS_SUBDOMAIN" ] || return 1
}

function get_credentials() {
  CREDENTIALS_FILE='/acme-dns-auth/credentials'
  export ACMEDNS_UPDATE_URL="http://acme-dns/update"

  if [ ! -f $CREDENTIALS_FILE ]; then
    /usr/bin/curl -X POST --silent --show-error --fail \
        "http://acme-dns/register" \
        -o $CREDENTIALS_FILE.staging || return 1

    mv $CREDENTIALS_FILE.staging $CREDENTIALS_FILE || return 1
  fi

  load_credentials $CREDENTIALS_FILE || return 1
}

CACHE_VERSION=6

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
  fresh=$(echo "$elapsedDays<$MAX_SSL_CERTIFICATE_AGE_DAYS" | bc)

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
    IS_DNS_GOOD=1
    echo "  acme-dns.$BASE_DOMAIN NS => $NS_DOMAIN"
    echo "  acme-challenge.$BASE_DOMAIN CNAME => $ACMEDNS_SUBDOMAIN.acme-dns.$BASE_DOMAIN"
    echo "  $NS_DOMAIN should resolve to a public IP address of this server"
    # Add a test record to later verify that things work well
    if curl --fail --show-error -X POST \
      -H "X-Api-User: $ACMEDNS_USERNAME" \
      -H "X-Api-Key: $ACMEDNS_PASSWORD" \
      -d "{\"subdomain\": \"$ACMEDNS_SUBDOMAIN\", \"txt\": \"$(echo test-blah-blah-$ACMEDNS_SUBDOMAIN | cut -c1-43)\"}" \
      $ACMEDNS_UPDATE_URL; then
      sleep 120
      for HOST in $SANITIZED_HOSTS; do
        echo "    _acme-challenge.$HOST CNAME => acme-challenge.$BASE_DOMAIN"
        if grep $(echo test-blah-blah-$ACMEDNS_SUBDOMAIN | cut -c1-43) < <(dig txt +short _acme-challenge.$HOST); then
          echo "      DNS for $HOST seems to be OK"
        else
          echo "      DNS for $HOST is not configured correctly"
          IS_DNS_GOOD=0
        fi
      done
    else
      echo "Failed to set up test TXT record"
      IS_DNS_GOOD=0
    fi

    if [ "$IS_DNS_GOOD" -eq "1" ]; then
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
          sleep 3600 & wait $!
        fi
      else
        echo "Skipping certificate request for $HOSTS as it is fresh enough"
        sleep 3600 & wait $!
      fi
    else
      echo "Skipping certificate request for $HOSTS as DNS is not configured"
    fi
  else
    echo "Failed to get credentials..."
  fi

  echo "Waiting before next attempt..."
  sleep 60 & wait $!
done
