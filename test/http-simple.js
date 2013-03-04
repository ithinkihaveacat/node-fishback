/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var DELAY = 500;

var lib = require("./lib");
var assurt = require("./assurt");
var fishback = require("../lib/fishback");
var assert = require("assert");

var response = {
    url: "/",
    method: "GET",
    statusCode: 200, 
    headers: { "x-cache": "MISS", "cache-control": "public, max-age=60" }, 
    data: [ "Hello, World!\n" ]
};

[lib.getCacheMemory, lib.getCacheMongoDb].forEach(function (callback) {

    callback(function (cache) {

        var client = new fishback.Client(null, null, {
            request: function (options, callback) {
                var clientResponse = new lib.http.ClientResponse(response);
                callback(clientResponse);
                clientResponse.fire();
                return new lib.http.ClientRequest();
            }
        });

        var proxy = new fishback.Proxy(cache, client);

        lib.step([

            function (next) {
                var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                var res = new lib.http.ServerResponse();
                res.on('end', assurt.calls(function () {
                    assert.equal(res.headers["x-cache"], "MISS");
                    setTimeout(next, DELAY);
                }));
                proxy.request(req, res);
                req.fire();
            },

            function (next) {
                var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                var res = new lib.http.ServerResponse();
                res.on('end', assurt.calls(function () {
                    assert.equal(res.headers["x-cache"], "HIT");
                    next.call();
                }));
                proxy.request(req, res);
                req.fire();
            },

            function (next) {
                var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                var res = new lib.http.ServerResponse();
                res.on('end', assurt.calls(function () {
                    assert.equal(res.headers["x-cache"], "HIT");
                    next.call();
                }));
                proxy.request(req, res);
                req.fire();
            },

            function (next) {
                var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                var res = new lib.http.ServerResponse();
                res.on('end', assurt.calls(function () {
                    assert.equal(res.headers["x-cache"], "HIT");
                    next.call();
                }));
                proxy.request(req, res);
                req.fire();
            },

            function (next) {
                var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                var res = new lib.http.ServerResponse();
                res.on('end', assurt.calls(function () {
                    assert.equal(res.headers["x-cache"], "HIT");
                    next.call();
                }));
                proxy.request(req, res);
                req.fire();
            },

            function (next) {
                cache.close();
            }

        ]);

    });
});
