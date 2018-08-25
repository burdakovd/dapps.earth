#!/bin/bash -xe

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

# Create travis/monitor users
# TODO
