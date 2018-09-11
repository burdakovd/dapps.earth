#!/bin/bash -e

[ ! -z "$BASE_DOMAIN" ]

if [ ! -z "$DEBUG_KEY_NAME" ]; then
  # If it is local deployment, then just do ssh, forward docker socket
  # and run docker-compose
  ssh -M -S ctrl-socket -fnNT -o "ExitOnForwardFailure yes" \
    -i ~/.ssh/$DEBUG_KEY_NAME.pem \
    -L $(pwd)/docker.sock:/var/run/docker.sock ec2-user@$BASE_DOMAIN
  chmod 600 docker.sock
  chmod 600 ctrl-socket
  (
    trap "echo cleaning up tunnel; ssh -S ctrl-socket -O exit ec2-user@$BASE_DOMAIN; rm -f docker.sock ctrl-socket" EXIT
    export DOCKER_HOST=unix://$(pwd)/docker.sock

    docker-compose up -d --build --remove-orphans
  )
else
  # When deployment is from travis, connect to destination, get credentials,
  # and decrypt them using secure variables mechanism
  [ ! -z "$TRAVIS" ]
  [ ! -z "$ENV" ]
  echo "My IP: $(dig +short myip.opendns.com @resolver1.opendns.com)"
  IPS="$(dig +short _deploy.$BASE_DOMAIN a)"
  echo "Will deploy code to the following addresses of _deploy.$BASE_DOMAIN: $(echo $IPS)"

  for IP in $IPS; do
    set +e
    (
      set -e
      echo "Deploying to $IP"
      CREDENTIALS="$(curl --silent --fail --show-error $IP:8080)"
      KEY="$(echo "$CREDENTIALS" | jq -r '.key')"
      SECURE_PASSWORD="$(echo "$CREDENTIALS" | jq -r '.secure_password')"
      PASSPHRASE_VAR_NAME="TRAVIS_PASSWORD_$(echo "$CREDENTIALS" | jq -r '.secure_password_name')"

      echo "Using passphrase from var $PASSPHRASE_VAR_NAME";
      PASSPHRASE="${!PASSPHRASE_VAR_NAME}";
      if [ -z "$PASSPHRASE" ]; then
        echo "$PASSPHRASE_VAR_NAME is unset!";
        echo "If the server was reprovisioned, add the following to secure variables section:"
        echo "    # $PASSPHRASE_VAR_NAME (to deploy $ENV)"
        echo "    - secure: \"$SECURE_PASSWORD\""
        false
      fi

      echo "Passphrase length is ${#PASSPHRASE}";
      KEY_FILE=$(mktemp)
      (
        trap "rm -f $KEY_FILE" EXIT

        base64 -d < <(echo "$KEY") > $KEY_FILE
        if ! ssh-keygen -o -p -P "$PASSPHRASE" -N "" -f "$KEY_FILE"; then
          echo "Failed to unlock key";
          false
        fi;

        echo "Attempting to use the key to deploy on $BASE_DOMAIN ($IP)..."
        # Ideally server fingerprint would be delivered in archive
        # together with client certificate, but I was too lazy.
        # There isn't an attack surface here anyway, as we are just pushing
        # the code.
        if \
          ssh -oStrictHostKeyChecking=no \
            -i "$KEY_FILE" \
            "travis@$IP" \
            "$(git rev-parse HEAD)"; \
        then
          echo "Succeeded deploying."
        else
          echo "Failed deploying."
        fi
      )
    )
    set -e
  done
fi
