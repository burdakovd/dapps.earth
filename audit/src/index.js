import ReactDOM from 'react-dom';
import React from 'react';
import 'typebase.css';
import 'formbase/dist/formbase.min.css';
import './button.css';

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
      steps, and ensure each of them proves what it claims to prove. If you
      find some steps not convincing, file a Github issue.
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
          - audit procedure finished
        </span>
      );
    } else {
      return (
        <span>
          Audit procedure is still running...
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
    <ol>
      <li key="header">HEADER: {makeStatusRow()}</li>
      {
        logs.map(
          (line, i) => <li key={`${i}`}>{line}</li>
        )
      }
      <li key="footer">FOOTER: {makeStatusRow()}</li>
    </ol>
  )
};

function getInitialAuditState() {
  return {
    isFinished: false,
    isOK: true,
    logs: [],
  };
}

function audit(props, onStateChange) {
  const state = getInitialAuditState();
  onStateChange(state);
  setTimeout(() => {
    onStateChange({
      ...state,
      isFinished: true,
    });
  }, 5000);
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
