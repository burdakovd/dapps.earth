var httpProxy = require('http-proxy')
var http      = require('http')
var base32    = require('base32.js')
var base58    = require('base58-native')
var proxy     = httpProxy.createProxyServer()

// sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 31337

http.createServer(function(req, res) {
  var hshcaRegexFailure = false

  try {
    var hshca = req.headers.host.match(/^(.+)\.ipfs\.neocitiesops\.net$/i)[1]
  } catch(e) {
    console.log(e)
    hshcaRegexFailure = true
  }

  if(hshcaRegexFailure) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Invalid HSHCA hash for archive lookup\n')
  } else {
    var decoder = new base32.Decoder({ type: "rfc4648" })
    var multihash = decoder.write(hshca.toUpperCase()).finalize()
    var ipfsHash = base58.encode(multihash)

    console.log(ipfsHash)

    proxy.web(req, res, { target: 'http://ipfs.neocitiesops.net:8080/ipfs/'+ipfsHash })
  }
}).listen(31337, '0.0.0.0')

console.log('Server running')
