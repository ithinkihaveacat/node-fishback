/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var DELAY = 500;

var lib = require("./lib");
var http = require("./http");
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

lib.getCacheList(function (cache) {

    var client = new fishback.Client(null, null, {
        request: function (options, callback) {
            var clientResponse = new http.ClientResponse(response);
            callback(clientResponse);
            clientResponse.fire();
            return new http.ClientRequest();
        }
    });

    var proxy = fishback.createCachingProxy(cache, client);

    lib.step([

        function (next) {
            var req = new http.ServerRequest({ url: "/", method: "GET" });
            var res = new http.ServerResponse();
            res.on('end', assurt.calls(function () {
                assert.equal(res.headers["x-cache"], "MISS");
                setTimeout(next, DELAY);
            }));
            proxy.request(req, res);
            req.fire();
        },

        function (next) {
            var req = new http.ServerRequest({ url: "/", method: "GET" });
            var res = new http.ServerResponse();
            res.on('end', assurt.calls(function () {
                assert.equal(res.headers["x-cache"], "HIT");
                next.call();
            }));
            proxy.request(req, res);
            req.fire();
        },

        function (next) {
            var req = new http.ServerRequest({ url: "/", method: "GET" });
            var res = new http.ServerResponse();
            res.on('end', assurt.calls(function () {
                assert.equal(res.headers["x-cache"], "HIT");
                next.call();
            }));
            proxy.request(req, res);
            req.fire();
        },

        function (next) {
            var req = new http.ServerRequest({ url: "/", method: "GET" });
            var res = new http.ServerResponse();
            res.on('end', assurt.calls(function () {
                assert.equal(res.headers["x-cache"], "HIT");
                next.call();
            }));
            proxy.request(req, res);
            req.fire();
        },

        function (next) {
            var req = new http.ServerRequest({ url: "/", method: "GET" });
            var res = new http.ServerResponse();
            res.on('end', assurt.calls(function () {
                assert.equal(res.headers["x-cache"], "HIT");
                next.call();
            }));
            proxy.request(req, res);
            req.fire();
        },

        function () {
            cache.close();
        }

    ]);

});
