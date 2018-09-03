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
const RUN_LOCAL_SWARM = process.env.RUN_LOCAL_SWARM;

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
        {'Location': 'https://dapps.earth/'},
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
    const CIDv1 = cid.toV1();
    const CIDv1base32 = CIDv1.toBaseEncodedString('base32');
    var newDestination = (HAS_SSL ? 'https://' : 'http://') +
      CIDv1base32 + '.' + req.headers.host + subPath;
    res.writeHead(302, {'Location': newDestination});
    res.end('')
  },
  // if someone is accessing ipfs subdomain, proxy to ipfs
  ['^(.+)\\.ipfs\\.' + regexify(BASE_DOMAIN) + '$']: function(req, res, match) {
    const cid = new CID(match[1]);
    const backendCID = cid.codec === 'dag-pb' ? cid.toV0() : cid;
    proxy.web(
      req,
      res,
      {
        target:
          'http://ipfs:8080/ipfs/' + backendCID.toBaseEncodedString(),
        changeOrigin: true,
      },
    )
  },
  // if someone is accessing swarm subdomain, proxy to swarm
  ['^(.+)\\.bzz\\.' + regexify(BASE_DOMAIN) + '$']: function(req, res, match) {
    var name = match[1];
    var base = RUN_LOCAL_SWARM === '1'
      ? 'http://swarm:8500'
      : 'https://swarm-gateways.net';
    var target = base + '/bzz:/' + name;
    proxy.web(
      req,
      res,
      { target, changeOrigin: true }
    )
  },
};

const PORT = process.env.PORT || 8080

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
}).listen(PORT, '0.0.0.0')

console.log('Server running: ' + BASE_DOMAIN + ':' + PORT)
