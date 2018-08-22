var httpProxy = require('http-proxy')
var http      = require('http')
var base32    = require('base32.js')
var base58    = require('base58-native')
var process   = require('process')
var url       = require('url')
var proxy     = httpProxy.createProxyServer()

proxy.on('error', function(e) {
  console.log('proxy error: '+e)
})

var handler = function(req, res) {
  console.log(req.headers.host)
  var path = url.parse(req.url).pathname
  console.log(path)

  // if someone is accessing ipfs without subdomain, redirect them
  var baseHostMatch = req.headers.host.match(new RegExp('^ipfs\\..+$', 'i'));
  if (baseHostMatch) {
    if (path === '/') {
      res.writeHead(302, {'Location': 'https://github.com/burdakovd/hshca-proxy'});
      res.end('')
      return;
    }

    var matches = path.match(
      '^/ipfs/([a-zA-Z0-9]+)(.*)$',
    )
    if (matches == null) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not found\n')
      return;
    }
    var ipfsHash = matches[1]
    var subPath = matches[2]
    var multihash = base58.decode(ipfsHash)
    var encoder = new base32.Encoder({ type: "rfc4648" })
    var hshca = encoder.write(multihash).finalize()
    var newDestination = process.env.HAS_SSL ? 'https://' : 'http://' +
      hshca + '.' + req.headers.host + subPath;
    res.writeHead(302, {'Location': newDestination});
    res.end('')
    return;
  }

  // if someone is accessing subdomain, decode hshca and proxy to ipfs
  try {
    var hshcaMatch = req.headers.host.match(
      new RegExp('^(.+)\\.ipfs\\..+$', 'i')
    )
    if (hshcaMatch == null) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not found\n')
      return;
    }
    var hshca = hshcaMatch[1]
  } catch(e) {
    console.log(e)
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Invalid HSHCA hash for archive lookup\n')
    return;
  }

  var decoder = new base32.Decoder({ type: "rfc4648" })
  var multihash = decoder.write(hshca.toUpperCase()).finalize()
  var ipfsHash = base58.encode(multihash)

  console.log(ipfsHash)

  proxy.web(req, res, { target: 'https://gateway.ipfs.io/ipfs/' + ipfsHash, changeOrigin: true })
}

http.createServer(function(req, res) {
  try {
    handler(req, res);
  } catch(e) {
    console.log(e);
    res.writeHead(500, {'Content-Type': 'text/plain'});
    res.end('Internal error\n')
  }
}).listen(process.env.PORT || 8080, '0.0.0.0')

console.log('Server running')
