import React from 'react';
import trustedAMIs from './ami.json';
import invariant from 'invariant';
import nullthrows from 'nullthrows';
import { Link } from './common';

function sorted(a) {
  const b = [...a];
  b.sort();
  return b;
}

/*
type AuditorState = {
  isOK: boolean,
  isFinished: boolean,
  logs: Array[React.Element],
};
type AuditorProps = {
  domain: string,
  forceInstance: string,
}
*/

const PassedBadge = () => <b style={{color: '#29aa46'}}>[PASSED]</b>;
const FailedBadge = () => <b style={{color: '#db4545'}}>[FAILED]</b>;

function getInitialAuditState() {
  return {
    isFinished: false,
    isOK: true,
    logs: [],
  };
}

function onlyNode(nodes) {
  invariant(nodes.length === 1, `expected 1 node, got ${nodes.length}`);
  return nodes.item(0);
}

function bypassCORSForPublicAPI(url) {
  // TODO: no need to bypass CORS unless we are in browser
  return 'https://cors-anywhere.herokuapp.com/' + url;
}

async function auditEntryPoint({ domain, forceInstance }, onStateChange) {
  var exportedState = getInitialAuditState();
  onStateChange(exportedState);

  const reporting = {
    log: (line) => {
      exportedState = {
        ...exportedState,
        logs: [...exportedState.logs, line],
      };
      onStateChange(exportedState);
    },
    fail: (reason=undefined) => {
      exportedState = {
        ...exportedState,
        isOK: false,
      };
      onStateChange(exportedState);
      reporting.log(
        <span>
          <FailedBadge />{' '}
          At this point audit is marked as failed (reason: {reason}).
          All subsequent steps are purely informational and will not
          necessarily make any sense, as they may make statements without
          taking into account the failure in preceding steps.
        </span>
      );
    },
    finish: () => {
      exportedState = {
        ...exportedState,
        isFinished: true,
      };
      onStateChange(exportedState);
    },
  };

  try {
    await audit({ domain, forceInstance }, reporting);
  } catch (e) {
    reporting.fail(`crash: ${e.toString()}`);
    reporting.log(
      <span>
        <FailedBadge />{' '}{`Audit procedure crashed: ${e.toString()}`}
      </span>
    );
  } finally {
    reporting.finish();
  }
}

function assertURLMatchesPattern(rawurl, rawpattern) {
  const url = new URL(rawurl);
  const pattern = new URL(rawpattern);
  invariant(url.origin === pattern.origin, 'Origin must match');
  invariant(url.pathname === pattern.pathname, 'Path must match');
  const urlParams = url.searchParams;
  const patternParams = pattern.searchParams;

  // 1. All pattern params must appear in url params
  for (const [k, v] of patternParams.entries()) {
    invariant(urlParams.get(k) === v, `URL must have ${k}=${v}`);
  }

  // 2. All url params must come from pattern params
  // unless they are signature params
  const signatureParams = [
    'AWSAccessKeyId',
    'Signature',
    'SignatureMethod',
    'SignatureVersion',
    'X-Amz-Date',
    'X-Amz-Algorithm',
    'X-Amz-Credential',
    'X-Amz-SignedHeaders',
    'X-Amz-Signature',
  ];
  for (const [k, v] of urlParams.entries()) {
    invariant(
      signatureParams.find(x => x === k) != null || patternParams.get(k) === v,
      `URL param ${k}=${v} must have come from pattern, unless it is signature param, but pattern has ${k}=${patternParams.get(k)}`,
    );
  }
}

function extractAWSAccessKeyId(rawurl) {
  const url = new URL(rawurl);
  return nullthrows(url.searchParams.get('AWSAccessKeyId'));
}

function makeLoggedFetch(reporting) {
  const loggedFetch = async (url, CORSProtectedPublicAPI=false) => {
    reporting.log(<span>Fetching <Link url={url} /></span>);
    const response = await fetch(
      CORSProtectedPublicAPI ? bypassCORSForPublicAPI(url) : url,
    );
    if (response.status !== 200) {
      throw new Error(`fetch error: ${response.status}: ${response.statusText}`);
    }
    return response;
  };
  return loggedFetch;
}

async function verifyInstancesLaunchParametersAndReturnOwnerAccount(
  reporting,
  instances,
  referToInstances,
) {
  const loggedFetch = makeLoggedFetch(reporting);

  reporting.log(`Fetching AWS URIs for all the instances`);
  const instancesWithURLs = [];
  for (const instance of instances) {
    const entry = await (async () => {
      const urls = await loggedFetch(
        `https://raw.githubusercontent.com/burdakovd/dapps.earth/master/aws_metadata/instances/${instance}/urls.json`,
      ).then(async response => await response.json());
      return {
        instance,
        urls,
      };
    })();
    instancesWithURLs.push(entry);
  };
  reporting.log('Now we will make DescribeInstances queries to AWS. URLs to \
  make those queries are signed by AWS account owner to \
  authorize the queries, but the responses come directly from AWS and cannot \
  be forged');
  instancesWithURLs.forEach(
    ({ instance, urls }) => assertURLMatchesPattern(
      urls.DI,
      `https://ec2.us-east-1.amazonaws.com/?Action=DescribeInstances&Expires=2025-01-01&InstanceId=${instance}&Version=2014-10-01`,
    ),
  );
  reporting.log('Verified that DescribeInstances URLs point to the correct API');

  var instancesAccountOwner = null;
  for (const instanceWithURLs of instancesWithURLs) {
    const response = await loggedFetch(instanceWithURLs.urls.DI).then(
      async response => await response.text(),
    ).then(
      text => (new window.DOMParser()).parseFromString(text, "application/xml"),
    );
    invariant(
      response.documentElement.namespaceURI === 'http://ec2.amazonaws.com/doc/2014-10-01/',
      'Bad response xmlns',
    );
    const reservation = response.querySelector('reservationSet > item');
    if (reservation == null) {
      reporting.fail(
        `Instance ${instanceWithURLs.instance} appears to no longer exist. \
        Or the query is being done using an IAM role that does not have \
        permission to see this instance. \
        This is a problem since if DNS still points to an IP \
        address that belonged to this instance, and now that IP address was \
        given to some other instance, we don't \
        know what is responding on that address now.
        `
      );
    }
    const ami = onlyNode(
      response.querySelectorAll(
        'reservationSet > item > instancesSet > item > imageId',
      ),
    ).textContent;
    reporting.log(
      `The instance is using ${trustedAMIs[ami] != null ? 'well known' : ''} AMI ${ami} (${trustedAMIs[ami]})`,
    );
    if (trustedAMIs[ami] == null) {
      reporting.fail('Unrecognized AMI');
      continue;
    }

    const keyNodes = response.querySelectorAll(
      'reservationSet > item > instancesSet > item > keyName',
    );
    if (keyNodes.length !== 0) {
      reporting.fail(
        `Instance has an SSH key ${onlyNode(keyNodes).textContent} attached. \
        It means AWS account owner can just log in via SSH at any time`,
      );
    } else {
      reporting.log('Instance has no SSH key attached.');
    }

    const instanceAccountOwner = onlyNode(
      response.querySelectorAll(
        'reservationSet > item > ownerId',
      ),
    ).textContent;
    if (instancesAccountOwner == null) {
      instancesAccountOwner = nullthrows(instanceAccountOwner);
    } else {
      invariant(
        instanceAccountOwner === instancesAccountOwner,
        'Instances are owned by different accounts',
      );
    }

    const ipAddress = onlyNode(
      response.querySelectorAll(
        'reservationSet > item > instancesSet > item > ipAddress',
      ),
    ).textContent;
    reporting.log(
      `Established that IP ${ipAddress} points to ${instanceWithURLs.instance}`,
    );
  }

  reporting.log(
    'Once we established that AWS EC2 instance is started without ssh keys \
    and using standard Linux image, we need to identify what was the \
    user data that it was launched with. User data is a script that runs on \
    launch. We will use DescribeInstanceAttribute API to fetch the \
    "userData" property. Normally "userData" could have been modified since \
    launch, but not in this case, as AWS does not allow changing userData \
    while instance is running, and also it does not allow to stop instances \
    that are backed by instance store (as opposed to EBS)',
  );

  instancesWithURLs.forEach(
    ({ instance, urls }) => assertURLMatchesPattern(
      urls.DIA,
      `https://ec2.us-east-1.amazonaws.com/?Action=DescribeInstanceAttribute&Attribute=userData&Expires=2025-01-01&InstanceId=${instance}&Version=2014-10-01`,
    ),
  );
  reporting.log('Verified that DescribeInstanceAttribute URLs point to the correct API');

  for (const instanceWithURLs of instancesWithURLs) {
    const response = await loggedFetch(instanceWithURLs.urls.DIA).then(
      async response => await response.text(),
    ).then(
      text => (new window.DOMParser()).parseFromString(text, "application/xml"),
    );
    invariant(
      response.documentElement.namespaceURI === 'http://ec2.amazonaws.com/doc/2014-10-01/',
      'Bad response xmlns',
    );
    const userDataFromGithub = await loggedFetch(
      `https://raw.githubusercontent.com/burdakovd/dapps.earth/master/instances/${instanceWithURLs.instance}/provision-user-data.sh`,
    ).then(async response => await response.text());
    const userDataFromAWS = atob(onlyNode(
      response.querySelectorAll('userData > value'),
    ).textContent);
    invariant(
      userDataFromGithub === userDataFromAWS,
      'User data from AWS does not match that committed to Github',
    );
    reporting.log(
      'User data returned from AWS for the instance is the same as \
      the one on Github',
    );
    invariant(
      userDataFromAWS.indexOf('base64') === -1,
      'User data has base64 binary call, this was not supposed to happen. \
      It should just fetch init script from Github and run it'
    );
    reporting.log(
      'User data seems to be legit. You can manually verify it using the \
      links above. It should fetch init script from official Github \
      repository and run it',
    );
  }

  return nullthrows(instancesAccountOwner);
}

async function verifyAccountHasNoEBSVolumes(reporting, instancesAccountOwner) {
  const loggedFetch = makeLoggedFetch(reporting);

  reporting.log(
    'We can verify absense of EBS volumes by doing GetMetrics call with \
    metric VolumeReadBytes. It will return "slice" of that metric per EBS \
    volume, so if there is any volume in the account, results will be not \
    empty. CloudWatch metrics have retention of 15 months, so empty list \
    proves that there have not been any EBS drives in the account for 15 \
    months.',
  );
  reporting.log(
    `It is important to ensure that metrics query is running on the same \
    AWS account that owns EC2 instances (${instancesAccountOwner}). \
    It is also important that it runs as root, otherwise there is a \
    chance that some EBS volumes are invisible to the query.`
  );

  const accountURLs = await loggedFetch(
    `https://raw.githubusercontent.com/burdakovd/dapps.earth/master/aws_metadata/accounts/${instancesAccountOwner}.json`
  ).then(response => response.json());
  assertURLMatchesPattern(
    accountURLs.GU,
    `https://iam.amazonaws.com/?Action=GetUser&Version=2010-05-08&Expires=2025-01-01`,
  );
  reporting.log('Verified that the GetAccount URL is calling correct API');
  const getUserResponse = await loggedFetch(
    accountURLs.GU,
    true,
  ).then(response => response.text())
  .then(text => (new window.DOMParser()).parseFromString(text, "application/xml"));
  invariant(
    getUserResponse.documentElement.namespaceURI === 'https://iam.amazonaws.com/doc/2010-05-08/',
    'Bad response xmlns',
  );
  const tentativelyRootKey = extractAWSAccessKeyId(accountURLs.GU);

  const awsUserARN = onlyNode(
    getUserResponse.querySelectorAll('GetUserResult > User > Arn'),
  ).textContent;
  const desiredArn = `arn:aws:iam::${instancesAccountOwner}:root`;
  if (awsUserARN === desiredArn) {
    reporting.log(
      `Verified that key ${tentativelyRootKey} belongs to root account`,
    );
  } else {
    reporting.fail(
      `This query should have run as root of same AWS account that owns EC2 \
      instances (${instancesAccountOwner}), got ${awsUserARN} instead`,
    );
  }

  const rootKey = tentativelyRootKey;
  reporting.log(
    `Now we know ${rootKey} is the key to make queries on the account
    that owns EC2 instances (${instancesAccountOwner}) with root privileges`,
  );

  assertURLMatchesPattern(
    accountURLs.LM,
    `https://monitoring.us-east-1.amazonaws.com/?Action=ListMetrics&Expires=2025-01-01&MetricName=VolumeReadBytes&Namespace=AWS%2FEBS&Version=2010-08-01`,
  );
  reporting.log('Verified that the ListMetrics URL is calling correct API');
  if (extractAWSAccessKeyId(accountURLs.LM) == rootKey) {
    reporting.log(`Verified that ListMetrics URL is using good key ${rootKey}`);
  } else {
    reporting.fail(
      `ListMetrics URL should be using ${rootKey} but is using \
      ${extractAWSAccessKeyId(accountURLs.LM)}`,
    );
  }
  const listMetricsResponse = await loggedFetch(
    accountURLs.LM,
  ).then(response => response.text())
  .then(text => (new window.DOMParser()).parseFromString(text, "application/xml"));
  invariant(
    listMetricsResponse.documentElement.namespaceURI === 'http://monitoring.amazonaws.com/doc/2010-08-01/',
    'Bad response xmlns',
  );
  const numMetrics = listMetricsResponse.querySelectorAll(
    'ListMetricsResult > Metrics > member',
  ).length;
  reporting.log(`Found ${numMetrics} metrics.`);
  if (numMetrics === 0) {
    reporting.log(
      `Verified that account ${instancesAccountOwner} had no EBS drives in \
      the past 15 months`,
    );
  } else {
    reporting.fail(
      `ListMetrics shows ${numMetrics} metrics, it seems AWS account \
      owner has some EBS drives`,
    );
  }
}

async function verifyIntegrityOfInstances(reporting, instances, referToInstances) {
  const instancesAccountOwner = await verifyInstancesLaunchParametersAndReturnOwnerAccount(
    reporting,
    instances,
    referToInstances,
  );

  reporting.log(
    `Instances are owned by the following AWS account: ${instancesAccountOwner}`,
  );
  reporting.log(
    `We established that ${referToInstances(instances)} were initialized correctly.`,
  );
  reporting.log(
    'However, one way to tamper with an instance would be to attach a \
    malicious EBS volume to it, and then reboot it, hoping it will load OS \
    from the attached volume. It is unlikely, but to protect against this, \
    we require that AWS account owner does not have any EBS volumes.',
  );

  await verifyAccountHasNoEBSVolumes(reporting, instancesAccountOwner);
}

async function getInstancesBackingTheDomain(reporting, domain) {
  const loggedFetch = makeLoggedFetch(reporting);

  const zoneConfig = await loggedFetch(
    `https://raw.githubusercontent.com/burdakovd/dapps.earth/master/aws_metadata/zones/${domain}`,
  ).then(response => response.json());

  reporting.log(
    `It is claimed that ${domain} DNS is managed by zone ${zoneConfig.zone}`,
  );

  reporting.log(
    'We can verify that by comparing domain NS servers with zone delegation set.',
  );

  const domainNS = await loggedFetch(
    `https://dns-api.org/NS/${domain}`,
  ).then(response => response.json()).then(
    rows => rows.filter(row => row.name === domain + '.' && row.type === 'NS')
  ).then(
    rows => JSON.stringify(sorted(rows.map(row => row.value.replace(/\.$/, '')))),
  );

  reporting.log(`Domain NS records: ${domainNS}`);

  const getZoneUnsignedURL = `https://route53.amazonaws.com/2013-04-01/hostedzone/${zoneConfig.zone}/`;
  const getZoneURL = await loggedFetch(
    `${zoneConfig.signer}zone/${domain}/${getZoneUnsignedURL}`
  ).then(r => r.text());
  assertURLMatchesPattern(getZoneURL, getZoneUnsignedURL);
  reporting.log(`Confirmed that signed URL was not modified while signing`);

  const getZoneResponse = await loggedFetch(getZoneURL).then(
    r => r.text()
  ).then(
    text => (new window.DOMParser()).parseFromString(text, "application/xml"),
  );

  invariant(
    getZoneResponse.documentElement.namespaceURI === 'https://route53.amazonaws.com/doc/2013-04-01/',
    'Bad response xmlns',
  );

  const delegationServers = JSON.stringify(
    sorted(Array.from(getZoneResponse.querySelectorAll(
      'DelegationSet > NameServers > NameServer',
    )).map(node => node.textContent)),
  );

  reporting.log(`Zone delegation NS records: ${delegationServers}`);
  if (delegationServers === domainNS) {
    reporting.log(
      'Confirmed that NS records of domain match zone delegation records',
    );
  } else {
    reporting.fail(
      'NS records of domain DO NOT match zone delegation records',
    );
  }

  reporting.log(
    `Now that we've verified ${domain} DNS is managed by zone \
    ${zoneConfig.zone}, we can check which IP addresses it resolves to \
    (we will use ${zoneConfig.signer} to sign requests to AWS)`,
  );

  const getZoneRecordsUnsignedURL = `https://route53.amazonaws.com/2013-04-01/hostedzone/${zoneConfig.zone}/rrset/`;
  const getZoneRecordsURL = await loggedFetch(
    `${zoneConfig.signer}zone/${domain}/${getZoneRecordsUnsignedURL}`
  ).then(r => r.text());
  assertURLMatchesPattern(getZoneRecordsURL, getZoneRecordsUnsignedURL);
  reporting.log(`Confirmed that zone records URL was not modified while signing`);

  const getZoneRecordsResponse = await loggedFetch(getZoneRecordsURL).then(
    r => r.text()
  ).then(
    text => (new window.DOMParser()).parseFromString(text, "application/xml"),
  );

  invariant(
    getZoneRecordsResponse.documentElement.namespaceURI === 'https://route53.amazonaws.com/doc/2013-04-01/',
    'Bad response xmlns',
  );
  invariant(
    onlyNode(
      getZoneRecordsResponse.querySelectorAll(
        'IsTruncated',
      ),
    ).textContent === 'false',
    'Results are truncated, and this page does not support pagination yet',
  );

  const ipAddresses = [];
  const handleDNSRecord = (name, type, value) => {
    if (type === 'A') {
      if (ipAddresses.find(x => x === value) == null) {
        ipAddresses.push(value);
      }
    } else if (name === domain + '.' && type === 'NS') {
      // skip
    } else if (name === 'staging.' + domain + '.' && type === 'NS') {
      // skip
    } else if (name === 'staging-2.' + domain + '.' && type === 'NS') {
      // skip
    } else if (name === domain + '.' && type === 'SOA') {
      // skip
    } else if (type === 'CAA') {
      // skip
    } else if (name.startsWith('_acme-challenge.')) {
      // skip
    } else if (name === 'acme-dns.' + domain + '.') {
      // skip
    } else {
      reporting.fail('Unrecognized DNS record observed: ' + JSON.stringify({ name, type, value }));
    }
  };

  for (const node of getZoneRecordsResponse.querySelectorAll(
    'ResourceRecordSets > ResourceRecordSet > ResourceRecords > ResourceRecord > Value',
  )) {
    const value = node.textContent;
    const name = Array.from(node.parentNode.parentNode.parentNode.childNodes).filter(
      node => node.nodeName === 'Name',
    )[0].textContent;
    const type = Array.from(node.parentNode.parentNode.parentNode.childNodes).filter(
      node => node.nodeName === 'Type',
    )[0].textContent;
    handleDNSRecord(name, type, value);
  }

  reporting.log(
    `Observed the following IP addresses for ${domain}: \
    ${JSON.stringify(ipAddresses)}. Now for each IP address we need to find \
    out EC2 instance that it points to.`,
  );

  const addressesWithURLs = await Promise.all(
    ipAddresses.map(
      async address => {
        const urls = await loggedFetch(
          `https://raw.githubusercontent.com/burdakovd/dapps.earth/master/aws_metadata/addresses/${address}/urls.json`,
        ).then(r => r.json());
        return { address, urls };
      },
    )
  );

  addressesWithURLs.forEach(
    ({ address, urls }) => assertURLMatchesPattern(
      urls.DA,
      `https://ec2.us-east-1.amazonaws.com/?Action=DescribeAddresses&Expires=2025-01-01&PublicIp=${address}&Version=2014-10-01`,
    ),
  );
  reporting.log('Verified that DescribeAddresses URLs point to the correct API');

  const instances = [];
  for (const addressWithURLs of addressesWithURLs) {
    const response = await loggedFetch(addressWithURLs.urls.DA).then(
      async response => await response.text(),
    ).then(
      text => (new window.DOMParser()).parseFromString(text, "application/xml"),
    );
    invariant(
      response.documentElement.namespaceURI === 'http://ec2.amazonaws.com/doc/2014-10-01/',
      'Bad response xmlns',
    );
    const instance = onlyNode(
      response.querySelectorAll('addressesSet > item > instanceId'),
    ).textContent;
    reporting.log(
      `Address ${addressWithURLs.address} is attached to ${instance}.`,
    );
    instances.push(instance);
  }
  return instances;
}

async function audit({ domain, forceInstance }, reporting) {
  reporting.log(`Auditing domain ${domain}`);

  reporting.log(`It is claimed that ${domain} is serving code from Github repo`);
  reporting.log(
    'So we need to find out which EC2 instances are behind the domain, and \
    whether those instances are set up correctly',
  );

  reporting.log(`Finding EC2 instances for ${domain}`);
  const instances = await getInstancesBackingTheDomain(reporting, domain);

  const referToInstances = instances => {
    return instances.length === 1
      ? `instance ${instances.join(',')}`
      : `instances [${instances.join(',')}]`
  };

  reporting.log(
    `We have found that ${domain} is backed by ${referToInstances(instances)}`,
  );

  if (forceInstance !== '') {
    console.log(`We will also verify additional instance: ${forceInstance}`);
    instances.push(forceInstance);
  }

  await verifyIntegrityOfInstances(reporting, instances, referToInstances);

  reporting.log(
    'Done. We have identified a set of instances behind the domain, and then \
    verified that they are set up correctly.',
  );
}

export {
  PassedBadge,
  FailedBadge,
  getInitialAuditState,
  auditEntryPoint as audit,
};
