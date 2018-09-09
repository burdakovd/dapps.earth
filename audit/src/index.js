import ReactDOM from 'react-dom';
import React from 'react';
import 'typebase.css';
import 'formbase/dist/formbase.min.css';
import './button.css';
import trustedAMIs from './ami.json';
import invariant from 'invariant';
import nullthrows from 'nullthrows';

const Link = ({url}) => {
  return <a href={url}>{url}</a>;
};

const GithubLink = () => {
  const url = 'https://github.com/burdakovd/dapps.earth';
  return <Link url={url} />;
};

class ChangeParamsForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      domain: props.domain,
      instance: props.instance,
    };
    this.handleChangeDomain = e => this.setState({ domain: e.target.value });
    this.handleChangeInstance = e => this.setState({ instance: e.target.value });
    this.onChoose = (e) => {
      e.preventDefault();
      this.props.onChoose(this.state);
    };
  }

  render() {
    return (
      <form>
        <label>
          Choose domain to audit (or keep it as is for <b>{this.props.domain}</b>):{' '}
          <input className="input" type="text" value={this.state.domain} onChange={
            this.handleChangeDomain
          } />
        </label>
        <label>
          Choose AWS instance to audit (leave empty to infer from domain):{' '}
          <input className="input" type="text" value={this.state.instance} onChange={
            this.handleChangeInstance
          } />
        </label>
        <input className="button" type="submit" value="Submit" onClick={this.onChoose} />
      </form>
    );
  }
};

const Page = ({ host, instance, onUpdate }) => (
  <div>
    <h2>Audit <a href={"https://" + host + "/"}>{host}</a></h2>
    <p>
      This page is designed to guide you through the process of verifying
      whether the server behind <b>{host}</b> is running open source code from{' '}
      <GithubLink />, and whether it could have been tampered with by
      AWS account owner.
    </p>
    <p>
      The instance provisioning procedure was designed in such a way that you
      don't have to trust AWS account owner (myself), and anyone on the internet
      can check if the server is running software from <GithubLink />. The
      procedure is largely based on great ideas from{' '}
      <a href="https://github.com/tlsnotary/pagesigner-oracles/blob/master/INSTALL.oracles">TLSNotary setup</a>,
      as they've solved similar problem several years ago.
    </p>
    <p>
      Once the instance is provisioned, it will receive code updates from{' '}
      <GithubLink /> (branch=release). Community should review commits to the
      repository to ensure the code does not contain backdoors. Such reviews are
      outside of scope of this page.
    </p>
    <p>
      You should not blindly trust verification status from this page, as
      anyone can write things on the Internet. You should carefully read the
      steps, and ensure each of them proves what it claims to prove. This is
      just software, it does some checks that I have though of, but I may have
      missed some cases. If you find something missing, file a Github issue.
    </p>
    <p>
      One may prefer to view this page on Github rather than from potentially
      untrusted server, this can be done on{' '}
      <a href={`https://rawgit.com/burdakovd/dapps.earth/master/audit.html#${host}/${instance}`}>rawgit</a>
      {' '}(rawgit is an independent website allowing people to view web pages
        from Github repository).
      You can also download page{' '}
      <a href="https://github.com/burdakovd/dapps.earth/blob/master/audit.html">from the repository</a>
      {' '}and open it locally, or <a href="https://github.com/burdakovd/dapps.earth/tree/master/audit">build from source</a>.
    </p>
    <p>
      This page is using new browser APIs and may not work well in old browsers.
    </p>
    <h3>Parameters</h3>
    <ChangeParamsForm domain={host} instance={instance} onChoose={onUpdate} />
    <h3>Steps</h3>
    <AuditRoot domain={host} forceInstance={instance} />
  </div>
);

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

const AuditorRenderer = ({ isOK, isFinished, logs }) => {
  const makeStatusRow = () => {
    if (isFinished) {
      return (
        <span>
          { isOK ? <PassedBadge /> : <FailedBadge /> }{' '}
          - audit procedure finished [{logs.length}/{logs.length}]
        </span>
      );
    } else {
      return (
        <span>
          Audit procedure is still running... [{logs.length}/??]
          {
            isOK
              ? ''
              : <span>{' '}
                  However it has already <FailedBadge />, so any further log
                  checks are just informational and won't affect final state.
                </span>
          }
        </span>
      );
    }
  };

  return (
    <div>
      <p>{makeStatusRow()}</p>
      <ol>
        {
          logs.map(
            (line, i) => <li key={`${i}`}>{line}</li>
          )
        }
      </ol>
      <p>{makeStatusRow()}</p>
    </div>
  )
};

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
  return 'https://cors-anywhere.herokuapp.com/' + url;
}

async function audit({ domain, forceInstance }, onStateChange) {
  var exportedState = getInitialAuditState();
  onStateChange(exportedState);

  const state = {
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
      state.log(
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
    state.log(`Auditing domain ${domain}`);

    const instances = (()  => {
      if (forceInstance !== '') {
        return [forceInstance];
      } else {
        throw new Error('not supported yet');
      }
    })();

    const referToInstances = instances => {
      return instances.length === 1
        ? `instance ${instances.join(',')}`
        : `instances [${instances.join(',')}]`
    };

    const assertURLMatchesPattern = (rawurl, rawpattern) => {
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
      ];
      for (const [k, v] of urlParams.entries()) {
        invariant(
          signatureParams.find(x => x === k) != null || patternParams.get(k) === v,
          `URL param ${k}=${v} must have come from pattern, unless it is signature param, but pattern has ${k}=${patternParams.get(k)}`,
        );
      }
    };

    const extractAWSAccessKeyId = (rawurl) => {
      const url = new URL(rawurl);
      return nullthrows(url.searchParams.get('AWSAccessKeyId'));
    };

    state.log(`It is claimed that ${domain} is backed by ${referToInstances(instances)}`);
    state.log('So we need to verify two things:')
    state.log(`1) Whether ${referToInstances(instances)} are set up correctly`);
    state.log(`2) Whether domain ${domain} is backed by ${referToInstances(instances)}`);

    const loggedFetch = async (url, CORSProtectedPublicAPI=false) => {
      state.log(<span>Fetching <Link url={url} /></span>);
      // TODO: do not bypass CORS unless we are in browser
      const response = await fetch(
        CORSProtectedPublicAPI ? bypassCORSForPublicAPI(url) : url,
      );
      if (response.status !== 200) {
        throw new Error(`fetch error: ${response.status}: ${response.statusText}`);
      }
      return response;
    };

    state.log(`Fetching AWS URIs for all the instances`);
    const instancesWithURLs = [];
    for (const instance of instances) {
      const entry = await (async () => {
        const urls = await loggedFetch(
          `https://raw.githubusercontent.com/burdakovd/dapps.earth/master/instances/${instance}/urls.json`,
        ).then(async response => await response.json());
        return {
          instance,
          urls,
        };
      })();
      instancesWithURLs.push(entry);
    };
    state.log('Now we will make DescribeInstances queries to AWS. URLs to \
    make those queries are signed by AWS account owner to \
    authorize the queries, but the responses come directly from AWS and cannot \
    be forged');
    instancesWithURLs.forEach(
      ({ instance, urls }) => assertURLMatchesPattern(
        urls.DI,
        `https://ec2.us-east-1.amazonaws.com/?Action=DescribeInstances&Expires=2025-01-01&InstanceId=${instance}&Version=2014-10-01`,
      ),
    );
    state.log('Verified that DescribeInstances URLs point to the correct API');

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
        state.fail(
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
      state.log(
        `The instance is using ${trustedAMIs[ami] != null ? 'well known' : ''} AMI ${ami} (${trustedAMIs[ami]})`,
      );
      if (trustedAMIs[ami] == null) {
        state.fail('Unrecognized AMI');
        continue;
      }

      const key = onlyNode(
        response.querySelectorAll(
          'reservationSet > item > instancesSet > item > keyName',
        ),
      ).textContent;
      if (key !== '') {
        state.fail(
          'Instance has an SSH key attached. It means AWS account owner can just log in via SSH at any time',
        );
      } else {
        state.log('Instance has no SSH key attached.');
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
    }

    state.log(
      `Instances are owned by the following AWS account: ${instancesAccountOwner}`,
    );

    state.log(
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
    state.log('Verified that DescribeInstanceAttribute URLs point to the correct API');

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
      state.log(
        'User data returned from AWS for the instance is the same as \
        the one on Github',
      );
      invariant(
        userDataFromAWS.indexOf('base64') === -1,
        'User data has base64 binary call, this was not supposed to happen. \
        It should just fetch init script from Github and run it'
      );
      state.log(
        'User data seems to be legit. You can manually verify it using the \
        links above. It should fetch init script from official Github \
        repository and run it',
      );
    }

    state.log(
      `We established that ${referToInstances(instances)} were initialized correctly.`,
    );
    state.log(
      'However, one way to tamper with an instance would be to attach a \
      malicious EBS volume to it, and then reboot it, hoping it will load OS \
      from the attached volume. It is unlikely, but to protect against this, \
      we require that AWS account owner does not have any EBS volumes.',
    );
    state.log(
      'We can verify absense of EBS volumes by doing GetMetrics call with \
      metric VolumeReadBytes. It will return "slice" of that metric per EBS \
      volume, so if there is any volume in the account, results will be not \
      empty. CloudWatch metrics have retention of 15 months, so empty list \
      proves that there have not been any EBS drives in the account for 15 \
      months.',
    );
    state.log(
      `It is important to ensure that metrics query is running on the same \
      AWS account that owns EC2 instances (${instancesAccountOwner}). \
      It is also important that it runs as root, otherwise there is a \
      chance that some EBS volumes are invisible to the query.`
    );
    const accountURLs = await loggedFetch(
      `https://raw.githubusercontent.com/burdakovd/dapps.earth/master/accounts/${instancesAccountOwner}.json`
    ).then(response => response.json());
    assertURLMatchesPattern(
      accountURLs.GU,
      `https://iam.amazonaws.com/?Action=GetUser&Version=2010-05-08&Expires=2025-01-01`,
    );
    state.log('Verified that the GetAccount URL is calling correct API');
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
    const awsUserName = onlyNode(
      getUserResponse.querySelectorAll('GetUserResult > User > UserName'),
    ).textContent;
    if (awsUserName === 'root') {
      state.log(
        `Verified that key ${tentativelyRootKey} belongs to root account`,
      );
    } else {
      state.fail(
        `This query should have run as root, got ${awsUserName} instead`,
      );
    }
    const awsUserARN = onlyNode(
      getUserResponse.querySelectorAll('GetUserResult > User > Arn'),
    ).textContent;
    const desiredArn = `arn:aws:iam::${instancesAccountOwner}:user/${awsUserName}`;
    if (awsUserARN === desiredArn) {
      state.log(
        `Verified that key ${tentativelyRootKey} belongs to AWS account \
        ${instancesAccountOwner}`,
      );
    } else {
      state.fail(
        `This query should have run as the same AWS account that owns EC2 \
        instances (${instancesAccountOwner}), got ${awsUserARN} instead`,
      );
    }

    const rootKey = tentativelyRootKey;
    state.log(
      `Now we know ${rootKey} is the key to make queries on the account
      that owns EC2 instances (${instancesAccountOwner}) with root privileges`,
    );

    assertURLMatchesPattern(
      accountURLs.LM,
      `https://monitoring.us-east-1.amazonaws.com/?Action=ListMetrics&Expires=2025-01-01&MetricName=VolumeReadBytes&Namespace=AWS%2FEBS&Version=2010-08-01`,
    );
    state.log('Verified that the ListMetrics URL is calling correct API');
    if (extractAWSAccessKeyId(accountURLs.LM) == rootKey) {
      state.log(`Verified that ListMetrics URL is using good key ${rootKey}`);
    } else {
      state.fail(
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
    state.log(`Found ${numMetrics} metrics.`);
    if (numMetrics === 0) {
      state.log(
        `Verified that account ${instancesAccountOwner} had no EBS drives in \
        the past 15 months`,
      );
    } else {
      state.fail(
        `ListMetrics shows ${numMetrics} metrics, it seems AWS account \
        owner has some EBS drives`,
      );
    }

    state.log(
      `By now we have confirmed the integrity of ${referToInstances(instances)}`,
    );
    state.log(
      `Next step would be to check whether ${domain} is backed by ${referToInstances(instances)}`,
    );

    throw new Error('WIP');
  } catch (e) {
    state.fail(`crash: ${e.toString()}`);
    state.log(
      <span>
        <FailedBadge />{' '}{`Audit procedure crashed: ${e.toString()}`}
      </span>
    );
  } finally {
    state.finish();
  }
}

class AuditRoot extends React.Component {
  constructor(props) {
    super(props);
    this.state = getInitialAuditState();
  }

  componentDidMount() {
    this._start();
  }

  componentWillUnmount() {
    this._stop();
  }

  _start() {
    this.setState(getInitialAuditState());

    const handlerState = { active: true };
    const handler = update => {
      if (handlerState.active) {
        this.setState({ ...update });
      };
    };
    this._stop = () => {
      handlerState.active = false;
      this._stop = null;
    };

    audit({ ...this.props }, handler);
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.domain !== prevProps.domain ||
      this.props.forceInstance !== prevProps.forceInstance
    ) {
      this._stop();
      this._start();
    }
  }

  render() {
    return <AuditorRenderer {...this.state} />;
  }
}

class Root extends React.Component {
  constructor(props) {
    super(props);

    const extractParams = () => {
      const anchor = window.location.hash;
      const host = window.location.hostname;
      if (anchor) {
        const [domain, instance] = anchor.substring(1).split('/');
        return { domain, instance };
      } else {
        return {
          domain: host,
          instance: '',
        }
      }
    };

    this.state = {
      ...extractParams(),
    };

    this.onUpdate = ({domain, instance}) => {
      window.location.hash = `${domain}/${instance}`;
    };

    this.onHashUpdate = () => {
      this.setState({...extractParams()});
    };
  }

  componentDidMount() {
    window.addEventListener("hashchange", this.onHashUpdate, false);
  }

  componentWillUnmount() {
    window.removeEventListener("hashchange", this.onHashUpdate, false);
  }

  render() {
    const domain = this.state.domain;
    const instance = this.state.instance;
    return <Page host={domain} instance={instance} onUpdate={this.onUpdate} key={domain} />;
  }
};

function main() {
  const root = document.getElementById('root');
  ReactDOM.render(<Root />, root);
}

main();
