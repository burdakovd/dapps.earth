#!/usr/bin/env python3

import sys
import hmac
import base64
import hashlib
from urllib import parse

if len(sys.argv) != 5:
    print ('Output HTTPS GET links to be used to check the status of provisioned instance')
    print ('The default availability zone is ec2.us-east-1.amazonaws.com')
    print ('Usage: instance-id address AWS-ID AWS-secret')
    print ('Where instance-id is the provisioned instance')
    exit(0)

common_args = [('Expires=2025-01-01'), ('SignatureMethod=HmacSHA256'), ('SignatureVersion=2')]
availability_zone = 'ec2.us-east-1.amazonaws.com'
instance_id = sys.argv[1]
address = sys.argv[2]
key = sys.argv[3]
secret = sys.argv[4]

def makeurl(args, endpoint, abbr):
    args.sort()
    argstr = ''
    for arg in args:
        argstr += parse.quote_plus(arg, '=')+'&'
    argstr = argstr[:-1]
    secret_bytes = bytes(secret , 'latin-1')
    mhmac = hmac.new(secret_bytes, ('GET\n'+endpoint+'\n/\n'+argstr).encode('utf-8'),hashlib.sha256)
    base64str = base64.b64encode(mhmac.digest()).strip().decode('utf-8')
    urlenc_sig = parse.quote_plus(base64str)
    final_string='https://'+endpoint+'/?'+argstr+'&Signature='+urlenc_sig
    print ("'" + abbr + "':'" + final_string + "',")


def make_for_instance():
    args = []
    args.extend(common_args)
    args.append('Action=DescribeInstances')
    args.append('InstanceId='+instance_id)
    args.append('AWSAccessKeyId='+key)
    args.append('Version=2014-10-01')
    makeurl(args, availability_zone, 'DI')

    args = []
    args.extend(common_args)
    args.append('Action=DescribeInstanceAttribute')
    args.append('InstanceId='+instance_id)
    args.append('Attribute=userData')
    args.append('AWSAccessKeyId='+key)
    args.append('Version=2014-10-01')
    makeurl(args, availability_zone, 'DIA')

    args = []
    args.extend(common_args)
    args.append('Action=DescribeAddresses')
    args.append('PublicIp='+address)
    args.append('AWSAccessKeyId='+key)
    args.append('Version=2014-10-01')
    makeurl(args, availability_zone, 'DA')


def make_for_root():
    args = []
    args.extend(common_args)
    args.append('Action=GetUser')
    args.append('AWSAccessKeyId='+key)
    args.append('Version=2010-05-08')
    makeurl(args, 'iam.amazonaws.com', 'GU')

    args = []
    args.extend(common_args)
    args.append('Action=ListMetrics')
    args.append('Namespace=AWS/EBS')
    args.append('MetricName=VolumeReadBytes')
    args.append('AWSAccessKeyId='+key)
    args.append('Version=2010-08-01')
    makeurl(args, 'monitoring.us-east-1.amazonaws.com', 'LM')


if instance_id != '':
    make_for_instance()
else:
    make_for_root()
