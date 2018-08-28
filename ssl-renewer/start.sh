#!/bin/bash -e

[ ! -z "$HOSTS" ]
[ ! -z "$BASE_DOMAIN" ]
[ ! -z "$NS_DOMAIN" ]

CACHE_VERSION=7

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

  echo "Domain set $HOST was issued a certificate $elapsedDays days ago"
  fresh=$(echo "$elapsedDays<$MAX_SSL_CERTIFICATE_AGE_DAYS" | bc)

  if [ "$fresh" -eq "1" ]; then
    return 0;
  else
    return 1;
  fi
}

mkdir -p /nanodns
NANODNS_CONFIG="/nanodns/config.txt"
rm -f $NANODNS_CONFIG

nanodns_start() {
  : > $NANODNS_CONFIG || return 1
  python nano-dns.py nano-dns $NANODNS_CONFIG || return 1
}

nanodns_stop() {
  rm -f $NANODNS_CONFIG
  sleep 2
}

mkdir -p ~/.acme.sh

cat << EOF > ~/.acme.sh/dns_nano.sh
#!/bin/bash -e

dns_myapi_add() {
  fulldomain="\$1"
  txtvalue="\$2"
  echo \$txtvalue >> $NANODNS_CONFIG
  return 1
}

dns_myapi_rm() {
  # whole file will be deleted upon DNS start/stop
  true
}
EOF

while true; do
  echo "In order for automatic SSL certificate management to work, "
  echo "the following DNS records need to be made manually once:"
  SANITIZED_HOSTS=$((for HOST in $HOSTS; do echo $HOST | sed 's/^[*].//'; done) | sort | uniq)
  IS_DNS_GOOD=1
  echo "  acme-dns.$BASE_DOMAIN NS => $NS_DOMAIN"
  echo "  $NS_DOMAIN should resolve to a public IP address of this server"
  nanodns_start
  # Add a test record to later verify that things work well
  if echo $(echo test-blah-blah-$ACMEDNS_SUBDOMAIN | cut -c1-43) >> $NANODNS_CONFIG; then
    sleep 120
    for HOST in $SANITIZED_HOSTS; do
      echo "    _acme-challenge.$HOST CNAME => challenge.acme-dns.$BASE_DOMAIN"
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
        --dns dns_nano \
        -d $(echo $HOSTS | sed 's/ / -d /g') \
        &
      if wait $!; then
        echo "Got certificate for $HOSTS..."
        HOST=$(echo $HOSTS | awk '{print $1}')
        SANITIZED_HOST=$(echo $HOST | sed 's/[*]/wildcard/')
        mkdir -p /etc/nginx/certs/$SANITIZED_HOST
        acme.sh --install-cert -d $HOST \
          --cert-file /etc/nginx/certs/$SANITIZED_HOST/cert \
          --key-file /etc/nginx/certs/$SANITIZED_HOST/key \
          --fullchain-file /etc/nginx/certs/$SANITIZED_HOST/fullchain \
          --reloadcmd "true"
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

  nanodns_stop

  echo "Waiting before next attempt..."
  sleep 60 & wait $!
done
