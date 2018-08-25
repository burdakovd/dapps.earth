#!/bin/bash -e

date

# Basic set up
# TODO: add swap
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
HOME=/root travis encrypt -r burdakovd/dapps.earth \
  "TRAVIS_PASSWORD_$TRAVIS_PASSWORD_NAME=$TRAVIS_PASSWORD" > \
  $TRAVIS_KEY.password.enc
TRAVIS_PASSWORD=""

echo Here are the credentials for Travis to log in and deploy code.
echo "Encrypted private key (requires password to decrypt)"
cat $TRAVIS_KEY
echo "Name of environment variable that will contain password during Travis run:"
echo " TRAVIS_PASSWORD_$TRAVIS_PASSWORD_NAME"
echo "Encrypted contents of that variable (only Travis can decrypt this)"
cat $TRAVIS_KEY.password.enc
echo "These two secrets need to be committed to repository in order to"
echo "be able to deploy to this server"

rm $TRAVIS_KEY $TRAVIS_KEY.password.enc

# Create monitor user
