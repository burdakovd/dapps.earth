#!/bin/bash -e

# Launch a new instance on AWS, attach existing or new elastic IP to it

[ ! -z "$SECURITY_GROUP" ]

# 1. Launch instance
# 2. Make it run start up script
# 3. Configure firewall

AMI_AMAZON_LINUX2=ami-04681a1dbd79675a5

# TODO: initialize instance for prod differently
instance_id=$(aws ec2 run-instances \
  --image-id $AMI_AMAZON_LINUX2 \
  --security-group-ids "$SECURITY_GROUP" \
  --count 1 \
  --instance-type t2.micro \
  --query 'Instances[0].InstanceId' \
  --user-data file://scripts/initialize-instance.sh \
  $(if [ ! -z "$DEBUG_KEY_NAME" ]; then \
    echo "--key-name $DEBUG_KEY_NAME"; \
    echo "Provisioning machine with debug access using key pair $DEBUG_KEY_NAME" >&2;
  else \
    true; \
  fi) \
  --output text \
)

echo "Launched instance $instance_id"
echo "Waiting for $instance_id to start..."

aws ec2 wait instance-running --instance-ids $instance_id

echo "Instance $instance_id is up and running"

if [ ! -z "$ELASTIC_IP" ]; then
  echo "Assigning $ELASTIC_IP to $instance_id"
  aws ec2 associate-address \
    --instance-id "$instance_id" \
    --public-ip "$ELASTIC_IP" \
    --allow-reassociation
  ssh-keygen -R "$ELASTIC_IP"
fi

ip=$(aws ec2 describe-instances \
  --instance-ids "$instance_id" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text \
)

echo "IP address of the instance is $ip"

echo success
