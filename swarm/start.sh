#!/bin/bash -xeu

set -o pipefail

JSONRPC=(curl --silent --fail --show-error -H "Content-Type: application/json" -X POST geth:8545 --data)
DATADIR=/home/swarmuser/data

while ! "${JSONRPC[@]}" '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'; do
  echo "geth JSONRPC hasn't started yet, waiting"
  sleep 5
done

ACCOUNT_FILE=$DATADIR/account

if [ ! -f $ACCOUNT_FILE ]; then
  geth --datadir $DATADIR \
    console --exec 'personal.newAccount("1234")' \
      | jq -r > $ACCOUNT_FILE.staging
  mv $ACCOUNT_FILE.staging $ACCOUNT_FILE
fi

# store size is in chunks of size 5KB
exec swarm \
  --bzzaccount $(cat $ACCOUNT_FILE) \
  --ens-api http://geth:8545 \
  --bootnodes \
    $(cat /etc/bootnodes.txt | grep -v '#' | grep '.' | paste -sd,) \
  --nat \
    extip:$(/usr/bin/dig +short myip.opendns.com @resolver1.opendns.com) \
  --datadir $DATADIR \
  --httpaddr 0.0.0.0 \
  --bzzport 8500 \
  --store.size 40000 \
  --store.cache.size 40000 \
  --verbosity 4 \
  --maxpeers 25 \
  --password /etc/1234 \
