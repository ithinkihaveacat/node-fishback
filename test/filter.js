/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var fishback = require("../lib/fishback");
var assert = require("assert");

var response = { statusCode: 200, headers: { "cache-control": "max-age=60, private" }, data: [ "Hello, World" ]};
var expected = { headers: { "foo": "bar", "cache-control": "max-age=60, public" }, data: "Hello, World" };

var count = 0;

[lib.getCacheMemory].forEach(function (callback) {

    callback(function (cache) {

        var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
        var res = new lib.http.ServerResponse();

        var client = new fishback.Client(null, null, {
            request: function (options, callback) {
                var clientResponse = new lib.http.ClientResponse(response);
                callback(clientResponse);
                clientResponse.fire();
                return new lib.http.ClientRequest();
            }
        });

        var proxy = new fishback.Proxy(cache, client);

        proxy.on('newRequest', function (req) {
            req.url = "/404";
        });

        proxy.on('newResponse', function (res) {
            res.setHeader('foo', 'bar');
            res.setHeader(
                'cache-control', 
                res.getHeader('cache-control').replace(/\bprivate\b/, "public")
            );
        });

        res.on('end', function () {
            lib.responseEqual(res, expected);
            count++;
        });

        proxy.request(req, res);
        req.fire();

    });
    
});

process.on('exit', function () {
    assert.equal(count, 1);
});
