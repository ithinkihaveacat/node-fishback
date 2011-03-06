#!/usr/local/bin/node

/*
 * Example of a reverse proxy server.  i.e. the sort of proxy server you might
 * put in front of a HTTP server, to deliver cached responses to clients.
 */

require.paths.unshift("lib");

var fishback = require("fishback");

var server = fishback.createServer();

server.addReqFilter(function (req) {
    // Can switch backend servers based on URL, etc.
    req.url = "http://localhost" + req.url;
});

server.listen();
