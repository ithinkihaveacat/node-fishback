/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var fishback = require("../lib/fishback");
var assert = require("assert");

var response = { headers: { "cache-control": "max-age=60, private" }, body: [ "Hello, World" ]};
var expected = { headers: { "foo": "bar", "cache-control": "max-age=60, public" }, body: "Hello, World" };

var count = 0;

[lib.getCacheMemory].forEach(function (callback) {

    callback(function (cache) {

        var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
        var res = new lib.http.ServerResponse();

        var proxy = new fishback.Proxy(cache, { 
            find: function (req, callback) { 
                var res = new lib.http.ClientResponse(response);
                res.url = req.url;
                res.method = req.method;
                callback(res);
                res.fire();
            }
        });

        proxy.on('request', function (req) {
            req.url = "/404";
        });

        proxy.on('response', function (res) {
            res.headers.foo = "bar";
            res.headers["cache-control"] = res.headers["cache-control"].replace(/\bprivate\b/, "public");
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
