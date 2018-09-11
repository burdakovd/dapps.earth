#!/bin/bash -xe
export INIT_SCRIPT_SOURCE="curl --silent --fail 'https://raw.githubusercontent.com/burdakovd/dapps.earth/1611eb12b0193e60f7c1ee0a24f50c3a2d249c19/scripts/initialize-instance.sh'"
bash -o pipefail -c "$INIT_SCRIPT_SOURCE" > /root/dapps.earth-init.sh
chmod +x /root/dapps.earth-init.sh
mkdir -p /var/log/dapps.earth-integrity
date
echo ''
export MAINTAINER_KEY='ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCDBPllnfZm4CcIu4XHjoMHNHAtUgijPn8RSY6dzL3FM1Ry6TmLJapf68jXiiDWu3aRdc6w+PGLBKIdGd7fVs+q1wnXptEwrxfnMUWFomOutgpblbopqHXjnoekazBbsXiN1Clvq54eco/HFWTjQwIubgjXtWKWle+CjU8pJhgB5Oo3/lj6OQlD/bPDsVR+wlSCXFw1Fh2loOrImvUbWdpJr95Ccr4Kx/5Z1mzf++GYy+zuVT77Oj6hOL6Sh6zYXH0kt5VFNM1Irt0HlCvL1LO5R4eU6qNGbxfIpt8gy513fX/t5/uE6LmUbHrJ3v4Mz0/lj42g3PQc2z5vxyUdaROF'
(
        echo "This machine has monitoring key <$MAINTAINER_KEY> attached"
        echo "Holder of that key has unprivileged access to the machine"
        echo "The key allows basic read-only commands, "
        echo "such as df -h, free, top -s, etc."
        echo ''
      ) >> /var/log/dapps.earth-integrity/provision.txt
export DEPLOY_BRANCH='release'
export DEPLOY_ENV='.env'
(
      echo "This machine will accept deployments from Travis for:"
      echo "  - branch: release"
      echo "  - env: .env"
      echo ''
    ) >> /var/log/dapps.earth-integrity/provision.txt
(
        echo "This machine has no debug key attached"
        echo "Access is restricted to only for Travis deploys"
      ) >> /var/log/dapps.earth-integrity/provision.txt
export HAS_DEBUG_KEY=0
echo '' >> /var/log/dapps.earth-integrity/provision.txt
(
      echo "Source of init script:"
      echo "  $INIT_SCRIPT_SOURCE"
    ) >> /var/log/dapps.earth-integrity/provision.txt
cp /root/dapps.earth-init.sh /var/log/dapps.earth-integrity/init.script.txt
time /root/dapps.earth-init.sh >       >(tee /var/log/dapps.earth-integrity/init.stdout.txt)       2> >(tee /var/log/dapps.earth-integrity/init.stderr.txt >&2)     
echo "Exit code of init script: $?"       >> /var/log/dapps.earth-integrity/provision.txt     
