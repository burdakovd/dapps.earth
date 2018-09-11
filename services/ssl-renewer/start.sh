#!/bin/bash -e

[ ! -z "$HOSTS" ] || (echo 'HOSTS var is missing' >&2 && false)
[ ! -z "$BASE_DOMAIN" ]
[ ! -z "$NS_DOMAIN" ]

SCRIPT="$( cd "$(dirname "$0")" ; pwd -P )/start.sh"
user=$(whoami)

whoami

if test "$user" = 'root'; then
  ls -lh /etc/nginx
  ls -lh /etc/nginx/certs || true
  mkdir -p /etc/nginx/certs/ssl/$BASE_DOMAIN
  chown -R renewer:users /etc/nginx/certs/ssl
  chmod -R u=rwx,g=rx,o= /etc/nginx/certs/ssl
  mkdir -p /etc/nginx/certs/signals
  chown -R renewer:users /etc/nginx/certs/signals
  chown -R renewer:users /successes

  mkdir -p /nanodns
  chown -R renewer:users /nanodns
  # give nanodns permission to read the config
  chmod o+rx /nanodns

  echo "dropping root privileges"
  cd /
  exec su renewer -c "exec bash -e $SCRIPT"
fi

test "$user" = 'renewer'

umask 027

ls -lh /etc/nginx
ls -lh /etc/nginx/certs
ls -lh /etc/nginx/certs/ssl

rm -f /etc/nginx/certs/ssl/perm-test
: > /etc/nginx/certs/ssl/perm-test

if sudo -nu nano-dns /bin/cat /etc/nginx/certs/ssl/perm-test; then
  echo "bad user setup"
  false
else
  echo "good, nano-dns can't read certs"
fi
rm -f /etc/nginx/certs/ssl/perm-test

CACHE_VERSION=8

function record_success() {
  HOST="$1"
  encoded=$(echo "$CACHE_VERSION.$HOST" | sha256sum | awk '{print $1}')
  date >> "/successes/$encoded"
}

function is_fresh() {
  HOST="$1"
  encoded=$(echo "$CACHE_VERSION.$HOST" | sha256sum | awk '{print $1}')
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

NANODNS_CONFIG="/nanodns/config.txt"
rm -f $NANODNS_CONFIG

nanodns_start() {
  : > $NANODNS_CONFIG || return 1
  chmod o+r $NANODNS_CONFIG
  sudo -n /bin/nano-dns.py nano-dns $NANODNS_CONFIG || return 1
}

nanodns_stop() {
  rm -f $NANODNS_CONFIG
  sleep 2
}

mkdir -p ~/.acme.sh

cat << EOF > ~/.acme.sh/dns_nano.sh
#!/bin/bash -e

dns_nano_add() {
  fulldomain="\$1"
  txtvalue="\$2"
  echo \$txtvalue >> $NANODNS_CONFIG
}

dns_nano_rm() {
  grep -v -- "\$2" $NANODNS_CONFIG > $NANODNS_CONFIG.f
  mv $NANODNS_CONFIG.f $NANODNS_CONFIG
}
EOF

while true; do
  echo "In order for automatic SSL certificate management to work, "
  echo "the following DNS records need to be made manually once:"
  SANITIZED_HOSTS=$((for HOST in $HOSTS; do echo $HOST | sed 's/^[*].//'; done) | sort | uniq)
  IS_DNS_GOOD=1
  echo "  acme-dns.$BASE_DOMAIN NS => $NS_DOMAIN"
  echo "  $NS_DOMAIN should resolve to a public IP address of this server"
  nanodns_start || exit 1
  TEST_SUB="test-$(date +%s)"
  # Add a test record to later verify that things work well
  echo $TEST_SUB >> $NANODNS_CONFIG
  sleep 120
  for HOST in $SANITIZED_HOSTS; do
    echo "    _acme-challenge.$HOST CNAME => challenge.acme-dns.$BASE_DOMAIN"
    if grep $TEST_SUB < <(dig txt +short _acme-challenge.$HOST) >/dev/null; then
      echo "      DNS for $HOST seems to be OK"
    else
      echo "      DNS for $HOST is not configured correctly"
      IS_DNS_GOOD=0
    fi
  done

  if [ "$IS_DNS_GOOD" -eq "1" ]; then
    if ! is_fresh "$HOSTS"; then
      echo "Making certificate request for $HOSTS..."
      ~/.acme.sh/acme.sh \
        --debug \
        --force \
        --issue \
        --dns dns_nano \
        -d $(echo $HOSTS | sed 's/ / -d /g') \
        &
      if wait $!; then
        echo "Got certificate for $HOSTS..."
        ls -lh /etc/nginx/certs
        ~/.acme.sh/acme.sh --install-cert -d $BASE_DOMAIN \
          --cert-file /etc/nginx/certs/ssl/$BASE_DOMAIN/cert \
          --key-file /etc/nginx/certs/ssl/$BASE_DOMAIN/key \
          --fullchain-file /etc/nginx/certs/ssl/$BASE_DOMAIN/fullchain \
          --reloadcmd "true"
        date >> /etc/nginx/certs/signals/signal
        record_success "$HOSTS"
      else
        echo "Renewal for $HOSTS failed!"
        nanodns_stop
        sleep 86400 & wait $!
      fi
    else
      echo "Skipping certificate request for $HOSTS as it is fresh enough"
      nanodns_stop
      sleep 86400 & wait $!
    fi
  else
    echo "Skipping certificate request for $HOSTS as DNS is not configured"
  fi

  nanodns_stop

  echo "Waiting before next attempt..."
  sleep 60 & wait $!
done
