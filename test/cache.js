/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var fishback = require("../lib/fishback");

//require("fishback").setVerbose(true);

var NOW = 198025200000;

var response = { headers: { "cache-control": "max-age=60, public" }, body: "Hello, World" };

var expected_miss = [
    { headers: { "x-cache": "MISS", "cache-control": "max-age=60, public" }, body: "Hello, World" },
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, body: "Hello, World" },
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, body: "Hello, World" }
];

var expected_hit = [
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, body: "Hello, World" },
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, body: "Hello, World" },
    { headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, body: "Hello, World" }
];

[lib.getCacheLocal].forEach(function (callback) {

    callback(function (cache) {

        var proxy = new fishback.Proxy(cache, lib.getMockClient(response));

        proxy.listen(lib.PROXY_PORT, function () {

            lib.step([ 

                function (callback) {

                    Date.prototype.getTime = function() {
                        return NOW;
                    };

                    lib.request(expected_miss.length, lib.PROXY_PORT, function (actual) {
                        for (var i = 0; i < actual.length; i++) {
                            lib.responseEqual(actual[i], expected_miss[i]);
                        }
                        callback();
                    });

                },

                // No cache misses
                function (callback) {

                    Date.prototype.getTime = function() {
                        return NOW + 30000;
                    };

                    lib.request(expected_hit.length, lib.PROXY_PORT, function (actual) {
                        for (var i = 0; i < actual.length; i++) {
                            lib.responseEqual(actual[i], expected_hit[i]);
                        }
                        callback();
                    });

                },

                // Should get a cache miss the first time, because we're 120 seconds
                // on.
                function (callback) {

                    Date.prototype.getTime = function() {
                        return NOW + 120000;
                    };

                    lib.request(expected_miss.length, lib.PROXY_PORT, function (actual) {
                        for (var i = 0; i < actual.length; i++) {
                            lib.responseEqual(actual[i], expected_miss[i]);
                        }
                        callback();
                    });

                },

                function () {
                    proxy.close();
                }

            ]);

        });

    });

});

