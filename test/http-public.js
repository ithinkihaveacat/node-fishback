/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var http = require("./http");
var assurt = require("./assurt");
var fishback = require("../lib/fishback");

var NOW = 0;
var DELAY = 500;

var response = {
    url: '/',
    method: 'GET',
    statusCode: 200,
    headers: { "x-cache": "MISS", "cache-control": "max-age=60, public" }, 
    data: [ "Hello, World" ]
};

var expected_miss = [
    { headers: { "x-cache": "MISS", "cache-control": "max-age=60, public" }, data: "Hello, World" },
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, data: "Hello, World" },
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, data: "Hello, World" }
];

var expected_hit = [
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, data: "Hello, World" },
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, data: "Hello, World" },
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, data: "Hello, World" }
];

lib.getCacheList(function (cache) {

    Date.prototype.getTime = function() {
        return NOW;
    };

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

        function (callback) {

            Date.prototype.getTime = function() {
                return NOW + 0;
            };

            lib.amap(
                [0, 1, 2],
                function (i, next) {
                    var req = new http.ServerRequest({
                        url: "/",
                        method: "GET"
                    });
                    var res = new http.ServerResponse();
                    res.on('end', assurt.calls(function () {
                        assurt.response(res, expected_miss[i]);
                        setTimeout(next, DELAY);
                    }));
                    proxy.request(req, res);
                    req.fire();
                },
                callback
            );

        },

        // No cache misses
        function (callback) {

            Date.prototype.getTime = function() {
                return NOW + 30000;
            };

            lib.amap(
                [0, 1, 2],
                function (i, next) {
                    var req = new http.ServerRequest({
                        url: "/",
                        method: "GET"
                    });
                    var res = new http.ServerResponse();
                    res.on('end', assurt.calls(function () {
                        assurt.response(res, expected_hit[i]);
                        setTimeout(next, DELAY);
                    }));
                    proxy.request(req, res);
                    req.fire();
                },
                callback
            );

        },

        // Should get a cache miss the first time, because we're 120 seconds
        // on.
        function (callback) {

            Date.prototype.getTime = function() {
                return NOW + 120000;
            };

            lib.amap(
                [0, 1, 2],
                function (i, next) {
                    var req = new http.ServerRequest({
                        url: "/",
                        method: "GET"
                    });
                    var res = new http.ServerResponse();
                    res.on('end', assurt.calls(function () {
                        assurt.response(res, expected_miss[i]);
                        setTimeout(next, DELAY);
                    }));
                    proxy.request(req, res);
                    req.fire();
                },
                callback
            );

        },

        function (callback) {
            cache.close();
        }

    ]);

});
