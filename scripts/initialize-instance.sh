#!/bin/bash -e

date

while ! curl -f http://169.254.169.254/latest/meta-data/instance-id; do
  echo "Waiting for metadata service to initialize" >&2
  sleep 5;
done

EC2_INSTANCE_ID=$(curl -f http://169.254.169.254/latest/meta-data/instance-id)
EC2_AVAIL_ZONE=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)
EC2_REGION=$(echo "$EC2_AVAIL_ZONE" | sed 's/[a-z]$//')

# Basic set up
dd if=/dev/zero of=/mnt/swap count=2048 bs=1MiB
chmod 600 /mnt/swap
mkswap /mnt/swap
echo '/mnt/swap none swap defaults 0 0' >> /etc/fstab
swapon -a
free

# set up cloudwatch
mkdir /root/cloudwatch-install && cd /root/cloudwatch-install
yum update -y
yum install -y perl-Switch perl-DateTime perl-Sys-Syslog \
  perl-LWP-Protocol-https perl-Digest-SHA.x86_64
curl -f https://aws-cloudwatch.s3.amazonaws.com/downloads/CloudWatchMonitoringScripts-1.2.2.zip -O
unzip CloudWatchMonitoringScripts-1.2.2.zip && \
  rm -f CloudWatchMonitoringScripts-1.2.2.zip && \
  cd aws-scripts-mon
ln -sf $(pwd)/mon-put-instance-data.pl /bin/mon-put-instance-data.pl
cd /

echo "*/5 * * * * root cd /root/cloudwatch-install/aws-scripts-mon && \
  ./mon-put-instance-data.pl --mem-util --mem-used --mem-avail --swap-util \
    --swap-used --disk-path=/ --disk-space-util --disk-space-used \
    --disk-space-avail --from-cron" \
  > /etc/cron.d/send-cloudwatch-stats

# set up cloudwatch logs
yum install -y awslogs

declare -A aws_monitored_logs=(
  # (by default) [/var/log/messages]="%b %d %H:%M:%S"
  [/var/log/secure]="%b %d %H:%M:%S"
  [/var/log/audit/audit.log]=""
  [/var/log/execsnoop.log]=""
  [/var/log/dapps.earth-integrity/deployments.txt]="%Y-%m-%dT%H:%M:%S%z"
  [/var/log/dapps.earth-integrity/init.script.txt]=""
  [/var/log/dapps.earth-integrity/init.stderr.txt]=""
  [/var/log/dapps.earth-integrity/init.stdout.txt]=""
  [/var/log/dapps.earth-integrity/maintenance.txt]="%Y-%m-%dT%H:%M:%S%z"
  [/var/log/dapps.earth-integrity/provision.txt]=""
)

for log in "${!aws_monitored_logs[@]}"; do \
  echo "
[$log]
file = $log
buffer_duration = 5000
log_stream_name = {instance_id}
initial_position = start_of_file
log_group_name = $log
" >> /etc/awslogs/awslogs.conf
  if [ ! -z "${aws_monitored_logs[$log]}" ]; then
    echo "datetime_format = ${aws_monitored_logs[$log]}" >> \
      /etc/awslogs/awslogs.conf
  fi
done

systemctl start awslogsd
systemctl enable awslogsd.service

# Docker
yum update -y
yum install -y docker htop
usermod -a -G docker ec2-user
curl -f -L https://github.com/docker/compose/releases/download/1.22.0/docker-compose-`uname -s`-`uname -m` \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
chkconfig docker on
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
docker --version
docker-compose --version
mkdir /etc/docker
echo "
{
  \"log-driver\": \"awslogs\",
  \"log-opts\": {
    \"awslogs-region\": \"${EC2_REGION}\",
    \"awslogs-group\": \"docker.${EC2_INSTANCE_ID}\",
    \"awslogs-create-group\": \"true\",
    \"tag\": \"{{.Name}}-{{.ID}}\"
  }
}
" > /etc/docker/daemon.json
service docker start

# Travis

yum install -y ruby ruby-devel libffi-devel gcc
gem install travis -v 1.8.9 --no-rdoc --no-ri

# Generate keys for Travis
# password name is just to avoid collisions in Travis environment variables
TRAVIS_PASSWORD_NAME="$(openssl rand -hex 8)"
TRAVIS_KEY=/root/travis.key
TRAVIS_PASSWORD="$(openssl rand -base64 48)"
ssh-keygen \
  -f "$TRAVIS_KEY" \
  -N "$TRAVIS_PASSWORD" \
  -t ecdsa -b 521 -o -a 256
chmod 600 $TRAVIS_KEY
export HOME=/root
# Apparently Travis has annoying migration of all repositories to pro accounts,
# and encryption logic isn't migrated well yet, and at the moment in order
# to encrypt data for pro project (even an open source one), one has to have
# a travis pro account.
# So this token gives access to an empty Github account that is authenticated
# agains Travis Pro (no payment plan, just regular account).
# The token gives read access to all private repositories of the account
# (which this account has none), so it is safe to hardcode it here.
# This is a mess, and Github deactivates it if finds it as cleartext in
# public repository, so here we do a little bit of encryption.
travis login --pro --github-token "$(
  echo U2FsdGVkX18FzRWMB/gCSkqljed4wAOwBY0eo+pDi0kK5249quoqXTtBh5Ln0bGN7jvLjfSlk6foxuTf8iINCQ== | \
    openssl aes-256-cbc -pass pass:1234 -a -d
)"
travis encrypt -r burdakovd/dapps.earth --pro \
  "TRAVIS_PASSWORD_$TRAVIS_PASSWORD_NAME=$TRAVIS_PASSWORD" > \
  $TRAVIS_KEY.password.enc
rm -rf ~/.travis
TRAVIS_PASSWORD=""

echo "Here are the credentials for Travis to log in and deploy code."
echo "Encrypted private key (requires password to decrypt)"
cat $TRAVIS_KEY
echo "Name of environment variable that will contain password during Travis run:"
echo " TRAVIS_PASSWORD_$TRAVIS_PASSWORD_NAME"
echo "Encrypted contents of that variable (only Travis can decrypt this)"
cat $TRAVIS_KEY.password.enc
echo "These two secrets need to be committed to repository in order to"
echo "be able to deploy to this server"

yum install -y git

adduser --gid docker -m travis
mkdir /home/travis/.ssh
( \
  echo -n \
    'command="/home/travis/deploy",restrict ' && \
    cat $TRAVIS_KEY.pub \
) > /home/travis/.ssh/authorized_keys
chmod 400 /home/travis/.ssh/authorized_keys
chmod 500 /home/travis/.ssh/
chown -R travis /home/travis/.ssh/

[ ! -z $DEPLOY_BRANCH ]
[ ! -z $DEPLOY_ENV ]

cat << EOF > /home/travis/deploy
#!/bin/bash -e

echo "[\$(date -Iseconds)] Received command \$SSH_ORIGINAL_COMMAND from [\$SSH_CLIENT]" \\
  | tee -a /var/log/dapps.earth-integrity/deployments.txt

[[ "\$SSH_ORIGINAL_COMMAND" =~ ^[a-z0-9]+\$ ]]
COMMIT="\$SSH_ORIGINAL_COMMAND"

echo "[\$(date -Iseconds)] Attempt to deploy \$COMMIT from [\$SSH_CLIENT]" \\
  | tee -a /var/log/dapps.earth-integrity/deployments.txt

WORKDIR=\$(mktemp -d)
echo "Working directory: \$WORKDIR"

[ ! -z "\$COMMIT" ]

(
  trap "cd; rm -rf \$WORKDIR" EXIT

  cd \$WORKDIR
  mkdir dapps.earth
  cd dapps.earth
  git init
  git remote add origin https://github.com/burdakovd/dapps.earth.git
  git fetch origin "$DEPLOY_BRANCH"
  git reset --hard FETCH_HEAD
  LATEST_COMMIT=\$(git rev-parse HEAD)
  echo "latest commit in branch $DEPLOY_BRANCH: \$LATEST_COMMIT"
  if [ ! "\$COMMIT" = "\$LATEST_COMMIT" ]; then
    echo "[\$(date -Iseconds)] Refused to deploy \$COMMIT from [\$SSH_CLIENT] because latest in $DEPLOY_BRANCH is \$LATEST_COMMIT" \
      | tee -a /var/log/dapps.earth-integrity/deployments.txt
    false
  fi

  . $DEPLOY_ENV
  docker-compose up --build --remove-orphans -d
  docker image prune -a -f
  # Sad story, but the output is less messed up in this case
  sleep 5
)

echo "[\$(date -Iseconds)] Deployed $DEPLOY_ENV from \$COMMIT from [\$SSH_CLIENT]" \\
  | tee -a /var/log/dapps.earth-integrity/deployments.txt
EOF

chmod 555 /home/travis/deploy

touch /var/log/dapps.earth-integrity/deployments.txt
chown travis /var/log/dapps.earth-integrity/deployments.txt

# Serve credentials for Travis
# Again, it is OK that we serve them publicly. They are supposed to be public.
# Only Travis build can decrypt them.

echo "
{
  \"key\": \"$(base64 -w0 < $TRAVIS_KEY)\",
  \"secure_password\": $(cat $TRAVIS_KEY.password.enc),
  \"secure_password_name\": \"$TRAVIS_PASSWORD_NAME\"
}
" > /home/travis/credentials

yum install -y nc
echo '
#!/bin/bash
while true; do
  (echo -e "HTTP/1.1 200 OK\n" && cat /home/travis/credentials) | nc -l 0.0.0.0 8080 >/dev/null
done
' > /home/travis/serve_credentials && chmod +x /home/travis/serve_credentials

echo "@reboot travis /home/travis/serve_credentials" > \
  /etc/cron.d/serve_travis_credentials

(su travis -c /home/travis/serve_credentials >/dev/null 2>&1 </dev/null &) &

# Create maintainer user

if [ ! -z "$MAINTAINER_KEY" ]; then
  echo "Setting up unprivileged maintenance access for $MAINTAINER_KEY"
  adduser -m maintainer
  mkdir /home/maintainer/.ssh
  ( \
    echo -n \
      'command="/home/maintainer/maintain",restrict,pty ' && \
      echo "$MAINTAINER_KEY" maintainer \
  ) > /home/maintainer/.ssh/authorized_keys
  tail -vn +1 /home/maintainer/.ssh/authorized_keys
  [ $(wc -l < /home/maintainer/.ssh/authorized_keys) -eq "1" ]
  chmod 400 /home/maintainer/.ssh/authorized_keys
  chmod 500 /home/maintainer/.ssh/
  chown -R maintainer /home/maintainer/.ssh/
  cat << 'EOF' > /home/maintainer/maintain
#!/bin/sh

echo "[$(date -Iseconds)] Received command $SSH_ORIGINAL_COMMAND" \
  | tee -a /var/log/dapps.earth-integrity/maintenance.txt

case "$SSH_ORIGINAL_COMMAND" in
    "top -s")
        top -s
        ;;
    "df -h")
        df -h
        ;;
    "free")
        free
        ;;
    "cat /var/log/awslogs.log")
        cat /var/log/awslogs.log
        ;;
    *)
        echo "[$(date -Iseconds)] Denied command $SSH_ORIGINAL_COMMAND" \
          | tee -a /var/log/dapps.earth-integrity/maintenance.txt
        exit 1
        ;;
esac
EOF

  chmod 555 /home/maintainer/maintain
  touch /var/log/dapps.earth-integrity/maintenance.txt
  chown maintainer /var/log/dapps.earth-integrity/maintenance.txt
fi

# finally, catch all process creation and log for audit
mkdir -p /root/perf-tools
cd /root/perf-tools
git init
git remote add origin https://github.com/brendangregg/perf-tools.git
git fetch origin 98d42a2a1493d2d1c651a5c396e015d4f082eb20
git reset --hard FETCH_HEAD
echo "@reboot root /root/perf-tools/execsnoop -rt >> /var/log/execsnoop.log" \
  > /etc/cron.d/execsnoop
(/root/perf-tools/execsnoop -rt >> /var/log/execsnoop.log 2>/dev/null </dev/null &) &

# delete ece2-user if it is not needed
if [ ! "$HAS_DEBUG_KEY" = "1" ]; then
  echo "deleting ec2-user"
  userdel ec2-user
fi
