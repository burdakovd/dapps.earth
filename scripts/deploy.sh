#!/bin/bash -e

[ ! -z "$TARGET_HOST" ]

if [ ! -z "$DEBUG_KEY_NAME" ]; then
  ssh -M -S ctrl-socket -fnNT -o "ExitOnForwardFailure yes" \
    -i ~/.ssh/$DEBUG_KEY_NAME.pem \
    -L $(pwd)/docker.sock:/var/run/docker.sock ec2-user@$TARGET_HOST
  chmod 600 docker.sock
  chmod 600 ctrl-socket
  (
    trap "echo cleaning up tunnel; ssh -S ctrl-socket -O exit ec2-user@$TARGET_HOST; rm -f docker.sock ctrl-socket" EXIT
    export DOCKER_HOST=unix://$(pwd)/docker.sock

    docker-compose up -d --build --remove-orphans
    docker-compose logs -t
  )
else
  # TODO: tune it so it works for Travis
  echo Cannot deploy yet
  false
fi
