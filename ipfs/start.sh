#!/bin/sh -e

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

EXTERNAL_IP=$(/usr/bin/dig +short myip.opendns.com @resolver1.opendns.com)

ipfs config profile apply server
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
ipfs config --json Addresses.Swarm '["/ip4/0.0.0.0/tcp/4001"]'
ipfs config --json Addresses.Announce "[\"/ip4/$EXTERNAL_IP/tcp/4001\"]"
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST"]'
ipfs config Datastore.StorageMax 2GB
ipfs config --json Discovery.MDNS.Enabled false
ipfs config Gateway.RootRedirect https://dapps.earth/
ipfs config --json Swarm.DisableNatPortMap true
ipfs config --json Swarm.EnableRelayHop false
ipfs config --json Swarm.AddrFilters '[
      "/ip4/10.0.0.0/ipcidr/8",
      "/ip4/100.64.0.0/ipcidr/10",
      "/ip4/169.254.0.0/ipcidr/16",
      "/ip4/172.16.0.0/ipcidr/12",
      "/ip4/192.0.0.0/ipcidr/24",
      "/ip4/192.0.0.0/ipcidr/29",
      "/ip4/192.0.0.8/ipcidr/32",
      "/ip4/192.0.0.170/ipcidr/32",
      "/ip4/192.0.0.171/ipcidr/32",
      "/ip4/192.0.2.0/ipcidr/24",
      "/ip4/192.168.0.0/ipcidr/16",
      "/ip4/198.18.0.0/ipcidr/15",
      "/ip4/198.51.100.0/ipcidr/24",
      "/ip4/203.0.113.0/ipcidr/24",
      "/ip4/240.0.0.0/ipcidr/4",
      "/ip4/127.0.0.0/ipcidr/8",
      "/ip6/0::/ipcidr/0"
    ]'

ipfs config show

exec env IPFS_LOGGING=info ipfs daemon --enable-gc
