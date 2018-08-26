#!/bin/bash -e

date

# Basic set up
dd if=/dev/zero of=/mnt/swap count=2048 bs=1MiB
chmod 600 /mnt/swap
mkswap /mnt/swap
echo '/mnt/swap none swap defaults 0 0' >> /etc/fstab
swapon -a
free

# Docker
yum update -y
yum install -y docker htop
usermod -a -G docker ec2-user
curl -f -L https://github.com/docker/compose/releases/download/1.21.0/docker-compose-`uname -s`-`uname -m` \
  -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
service docker start
chkconfig docker on
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
docker-compose --version

# Travis

yum install -y ruby ruby-devel libffi-devel gcc
gem install travis -v 1.8.9 --no-rdoc --no-ri

# Generate keys for Travis
# password name is just to avoid collisions in Travis environment variables
TRAVIS_PASSWORD_NAME="$(openssl rand -hex 8)"
TRAVIS_KEY=~/travis.key
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
travis login --pro --github-token $(
  echo U2FsdGVkX18FzRWMB/gCSkqljed4wAOwBY0eo+pDi0kK5249quoqXTtBh5Ln0bGN7jvLjfSlk6foxuTf8iINCQ== | \
    openssl aes-256-cbc -pass pass:1234 -a -d
)
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

rm $TRAVIS_KEY $TRAVIS_KEY.password.enc

yum install -y git

adduser --gid docker -m travis
mkdir /home/travis/.ssh
( \
  echo -n \
    'command="/home/travis/deploy",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ' && \
    cat $TRAVIS_KEY.pub \
) > /home/travis/.ssh/authorized_keys
chmod 400 /home/travis/.ssh/authorized_keys
chmod 500 /home/travis/.ssh/
chown -R travis /home/travis/.ssh/

cat << 'EOF' > /home/travis/deploy
#!/bin/bash -e

echo "Connection: $SSH_CONNECTION"

[[ "$SSH_ORIGINAL_COMMAND" =~ ^[a-z0-9]+\ \.env(\.[a-z]+)?$ ]]
COMMIT=$(echo "$SSH_ORIGINAL_COMMAND" | cut -f1 -d' ')
ENV=$(echo "$SSH_ORIGINAL_COMMAND" | cut -f2 -d' ')

echo "Commit: $COMMIT"
echo "Env: $ENV"

WORKDIR=$(mktemp -d)
echo "Working directory: $WORKDIR"

[ ! -z "$COMMIT" ]

(
  trap "cd; rm -rf $WORKDIR; echo cleaned up temp directory" EXIT

  cd $WORKDIR
  mkdir dapps.earth
  cd dapps.earth
  git init
  git remote add origin https://github.com/burdakovd/dapps.earth.git
  git fetch origin "$COMMIT"
  git reset --hard FETCH_HEAD
  echo "current commit: $(git rev-parse HEAD)"
  . $ENV
  docker-compose up --build --remove-orphans -d
  # Sad story, but the output is less messed up in this case
  sleep 5
)

echo "Success!"
EOF

chmod 555 /home/travis/deploy

# Create monitor user
