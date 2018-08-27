#!/bin/sh

user=$(whoami)
repo="$IPFS_PATH"

# Test whether the mounted directory is writable for us
if [ ! -w "$repo" 2>/dev/null ]; then
  echo "error: $repo is not writable for user $user (uid=$(id -u $user))"
  exit 1
fi

ipfs version

if [ -e "$repo/config" ]; then
  echo "Found IPFS fs-repo at $repo"
else
  ipfs init
fi

ipfs config profile apply server
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'
ipfs config Datastore.StorageMax 2GB
ipfs config Discovery.MDNS --json false
ipfs config Gateway.RootRedirect https://dapps.earth/
ipfs config Swarm.DisableNatPortMap --json false

ipfs config show

exec env IPFS_LOGGING=warn ipfs daemon --enable-gc
