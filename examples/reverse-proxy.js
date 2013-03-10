/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require("../lib/fishback");
var http = require("http");

var PORT = 8080;
var BACKEND_HOST = "www.bbc.co.uk";
var BACKEND_PORT = "80";

var client = new fishback.Client(BACKEND_HOST, BACKEND_PORT);
client.on('newRequest', function (req) {
    console.info("CLIENT.newRequest " + req.method + " " + req.url);
});
client.on('newResponse', function (res) {
    console.info("CLIENT.newResponse " + res.method + " " + res.url);
});

var proxy = fishback.createProxy(client);
proxy.on('newRequest', function (req) {
    console.info("PROXY.newRequest " + req.method + " " + req.url);
});
proxy.on('newResponse', function (res) {
    console.info("PROXY.newResponse " + res.method + " " + res.url);
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
