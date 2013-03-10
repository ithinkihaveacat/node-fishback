/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require("../lib/fishback");
var http = require("http");

var PORT = 8080;
var BACKEND_HOST = "www.bbc.co.uk";
var BACKEND_PORT = "80";

var cache = new fishback.CacheMemory();
cache.on('newRequest', function (req) {
    console.info("CACHE " + req.method + " " + req.url);
});

var client = new fishback.Client(BACKEND_HOST, BACKEND_PORT);
client.on('newRequest', function (req) {
    console.info("CLIENT " + req.method + " " + req.url);
});

var proxy = fishback.createCachingProxy(cache, client);
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
