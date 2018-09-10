import ReactDOM from 'react-dom';
import React from 'react';
import Root from './page';

function main() {
  console.log('main index.js started');
  console.log(`have fetch: ${window.fetch != null ? 'yes': 'no'}`);
  const root = document.getElementById('root');
  ReactDOM.render(<Root />, root);
  console.log('main index.js finished');
}

function browserSupportsAllFeatures() {
  return window.Promise && window.fetch && window.Symbol;
}

function loadScript(src, done) {
  var js = document.createElement('script');
  js.src = src;
  js.onload = function() {
    console.log('polyfill fetched, proceeding to main');
    done();
  };
  js.onerror = function() {
    throw new Error('Failed to load script ' + src);
  };
  document.head.appendChild(js);
}

function entrypoint() {
  if (browserSupportsAllFeatures()) {
    main();
  } else {
    console.log('Browser does not support all features, fetching polyfills');
    loadScript(
      'https://cdn.rawgit.com/inexorabletash/polyfill/v0.1.42/polyfill.min.js',
      main,
    );
  }
}

entrypoint();
