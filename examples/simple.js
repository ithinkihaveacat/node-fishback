/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require("../lib/fishback");
var http = require("http");

var proxy = fishback.createProxy(new fishback.Client("localhost", 9000));
proxy.on("newRequest", function (req) {
    console.log(req.method + " " + req.url);
});
proxy.on("newResponse", function (res) {
    res.setHeader("cache-control", "public, max-age=3600");
});

http.createServer(proxy.request.bind(proxy)).listen(8000);

console.log("Listening on port 8000, and proxying to localhost:9000");
