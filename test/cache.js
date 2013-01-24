// Tests for the caching capability

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

lib.knock({
    "static": lib.getStatic.bind(null, response, lib.SERVER_PORT),
    "cache": lib.getCacheLocal
}, function (knock) {
    var proxy = fishback.createServer(knock.cache, '0.0.0.0', lib.SERVER_PORT);
    proxy.listen(lib.PROXY_PORT, function () {

        lib.step([ 

            function (callback) {

                Date.prototype.getTime = function() {
                    return NOW;
                }

                lib.request(expected_miss.length, function (actual) {
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
                }

                lib.request(expected_hit.length, function (actual) {
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
                }

                lib.request(expected_miss.length, function (actual) {
                    for (var i = 0; i < actual.length; i++) {
                        lib.responseEqual(actual[i], expected_miss[i]);
                    }
                    callback();
                });

            },

            function (callback) {
                proxy.close();
                knock.cache.close();
                knock.static.close();
                callback();
            }


        ]);
    });
});

