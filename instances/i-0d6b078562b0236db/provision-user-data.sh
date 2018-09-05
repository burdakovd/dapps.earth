#!/bin/bash -xe
export INIT_SCRIPT_SOURCE="echo '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' | base64 -d | gunzip"
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
export DEPLOY_BRANCH='master'
export DEPLOY_ENV='.env.staging-2'
(
      echo "This machine will accept deployments from Travis for:"
      echo "  - branch: master"
      echo "  - env: .env.staging-2"
      echo ''
    ) >> /var/log/dapps.earth-integrity/provision.txt
(
        echo "This machine has debug key <tst> attached"
        echo "Holder of that key has ROOT access to the machine"
      ) >> /var/log/dapps.earth-integrity/provision.txt
export HAS_DEBUG_KEY=1
echo '' >> /var/log/dapps.earth-integrity/provision.txt
(
      echo "Source of init script:"
      echo "  $INIT_SCRIPT_SOURCE"
    ) >> /var/log/dapps.earth-integrity/provision.txt
cp /root/dapps.earth-init.sh /var/log/dapps.earth-integrity/init.script.txt
time /root/dapps.earth-init.sh >       >(tee /var/log/dapps.earth-integrity/init.stdout.txt)       2> >(tee /var/log/dapps.earth-integrity/init.stderr.txt >&2)     
echo "Exit code of init script: $?"       >> /var/log/dapps.earth-integrity/provision.txt     
