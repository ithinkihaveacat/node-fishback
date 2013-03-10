/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

// This can be used as a "standard" client-side proxy for browsers, etc.
// Note that SSL is not supported!

var fishback = require("../lib/fishback");
var http = require("http");

var PORT = 8080;

var client = new fishback.Client();

var proxy = fishback.createProxy(client);
proxy.on('newResponse', function (res) {
    console.info(res.method + " " + res.url.slice(0, 75) + (res.url.length > 75 ? " ..." : ""));
    res.setHeader("cache-control", "public, max-age=3600"); // Example header adjustment
}); 

var server = new http.Server();
server.on('request', proxy.request.bind(proxy));
server.listen(PORT, function () {
    console.info("Listening on port " + PORT);
    console.info();
    console.info("Try:");
    console.info();
    console.info("  $ curl --proxy localhost:" + PORT + " http://www.bbc.co.uk/news/");
    console.info();
});
