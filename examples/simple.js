var fishback = require("../lib/fishback");
var http = require("http");

var PORT = 8080;

var cache = new fishback.CacheMemory();
cache.on('newRequest', function (req) {
    console.info("CACHE " + req.method + " " + req.url);
});

var client = new fishback.Client("www.bbc.co.uk", "80");
client.on('newRequest', function (req) {
    console.info("CLIENT " + req.method + " " + req.url);
});

var proxy = new fishback.Proxy(cache, client);
proxy.on('newRequest', function (req) {
    console.info("PROXY " + req.method + " " + req.url);
});

var server = new http.Server();
server.on('request', proxy.request.bind(proxy));
server.listen(PORT, function () {
    console.info("Listening on port " + PORT);
    console.info();
    console.info("Try:");
    console.info();
    console.info("  $ curl -s -i http://localhost:" + PORT + "/");
});
