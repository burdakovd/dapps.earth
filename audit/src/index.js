import ReactDOM from 'react-dom';
import React from 'react';
import 'typebase.css';

const GithubLink = () => {
  const url = 'https://github.com/burdakovd/dapps.earth';
  return <a href={url}>{url}</a>;
};

const Page = ({host}) => (
  <div>
    <h2>Audit <a href="/">{host}</a></h2>
    <p>
      This page is designed to guide you through the process of proving
      that the server behind <b>{host}</b> is running open source code from{' '}
      <GithubLink />, and couldn't have been tampered with by AWS account owner.
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
      <a href="https://rawgit.com/burdakovd/dapps.earth/master/audit.html">rawgit</a>
      {' '}(rawgit is an independent website allowing people to view web pages
        from Github repository).
      You can also download page{' '}
      <a href="https://github.com/burdakovd/dapps.earth/blob/master/audit.html">from the repository</a>
      {' '}and open it locally, or <a href="https://github.com/burdakovd/dapps.earth/tree/master/audit">build from source</a>.
    </p>
    <p>
      Actual procedure TBD.
    </p>
  </div>
);

function main() {
  const root = document.getElementById('root');
  const host = window.location.hostname;
  ReactDOM.render(<Page host={host} />, root);
}

main();
