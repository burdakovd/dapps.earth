var httpProxy = require('http-proxy')
var http      = require('http')
var CID       = require('cids')
var process   = require('process')
var url       = require('url')
var proxy     = httpProxy.createProxyServer()

proxy.on('error', function(e) {
  console.log('proxy error: '+e)
})

const BASE_DOMAIN = process.env.BASE_DOMAIN;
const HAS_SSL = process.env.HAS_SSL;

const regexify = function(s) {
  return s.replace('.', '\\.').replace('-', '\\-');
}

var handlers = {
  // if someone is accessing ipfs without subdomain, redirect them
  ['^ipfs\\.' + regexify(BASE_DOMAIN) + '$']: function (req, res, match) {
    var path = url.parse(req.url).pathname
    if (path === '/') {
      res.writeHead(
        302,
        {'Location': 'https://github.com/burdakovd/hshca-proxy'},
      );
      res.end('')
      return;
    }

    var matches = path.match(
      '^/ipfs/([a-zA-Z0-9]+)(.*)$',
    )
    if (matches == null) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Unrecognized ipfs path: ' + path + '\n')
      return;
    }
    var cid = new CID(matches[1])
    var subPath = matches[2]
    const CIDv1base32 = cid.toV1().toBaseEncodedString('base32');
    var newDestination = HAS_SSL ? 'https://' : 'http://' +
      CIDv1base32 + '.' + req.headers.host + subPath;
    res.writeHead(302, {'Location': newDestination});
    res.end('')
  },
  // if someone is accessing ipfs subdomain, proxy to ipfs
  ['^(.+)\\.ipfs\\.' + regexify(BASE_DOMAIN) + '$']: function(req, res, match) {
    // TODO: switch to local node if there is noticeable traffic
    proxy.web(
      req,
      res,
      {
        target: 'https://gateway.ipfs.io/ipfs/' + (
          new CID(match[1])
        ).toV0().toBaseEncodedString(),
        changeOrigin: true,
      },
    )
  },
  // if someone is accessing swarm subdomain, proxy to swarm
  ['^(.+)\\.swarm\\.' + regexify(BASE_DOMAIN) + '$']: function(req, res, match) {
    var name = match[1]
    // TODO: switch to local node if there is noticeable traffic
    proxy.web(
      req,
      res,
      { target: 'https://swarm-gateways.net/bzz:/' + name, changeOrigin: true }
    )
  },
};

http.createServer(function(req, res) {
  try {
    console.log(req.headers.host)
    var path = url.parse(req.url).pathname
    console.log(path)

    const eligible = Object.keys(handlers).map(
      r => [r, req.headers.host.match(new RegExp(r, 'i'))],
    ).filter(
      ([r, m]) => m != null
    );

    if (eligible.length === 0) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Unrecognized domain: ' + req.headers.host + '\n');
      return;
    }

    if (eligible.length > 1) {
      throw new Error(
        'Multiple handlers matched: ' + JSON.stringify(
          eligible.map(([r, m]) => r),
        ),
      );
    }
    const [name, match] = eligible[0];

    handlers[name](req, res, match);
  } catch(e) {
    console.log(e);
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end('Internal error\n')
  }
}).listen(process.env.PORT || 8080, '0.0.0.0')

console.log('Server running')
