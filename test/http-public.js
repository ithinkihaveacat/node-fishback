/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var fishback = require("../lib/fishback");

var NOW = 198025200000;

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

[lib.getCacheMemory].forEach(function (callback) {

    callback(function (cache) {

        Date.prototype.getTime = function() {
            return NOW;
        };

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

            function (callback) {

                Date.prototype.getTime = function() {
                    return NOW;
                };

                lib.amap(
                    [0, 1, 2],
                    function (i, next) {
                        var req = new lib.http.ServerRequest({
                            url: "/",
                            method: "GET"
                        });
                        var res = new lib.http.ServerResponse();
                        res.on('end', function () {
                            lib.responseEqual(expected_miss[i], res);
                            next();
                        });
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
                        var req = new lib.http.ServerRequest({
                            url: "/",
                            method: "GET"
                        });
                        var res = new lib.http.ServerResponse();
                        res.on('end', function () {
                            lib.responseEqual(expected_hit[i], res);
                            next();
                        });
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
                        var req = new lib.http.ServerRequest({
                            url: "/",
                            method: "GET"
                        });
                        var res = new lib.http.ServerResponse();
                        res.on('end', function () {
                            lib.responseEqual(expected_miss[i], res);
                            next();
                        });
                        proxy.request(req, res);
                        req.fire();
                    },
                    callback
                );

            }

        ]);

    });

});

