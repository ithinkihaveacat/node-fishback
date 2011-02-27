var lib = require("./lib");

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

var service = lib.createService(response);

lib.step([ 

    function (callback) {

        Date.prototype.getTime = function() {
            return NOW;
        }

        service.request(expected_miss.length, function (actual) {
            for (var i = 0; i < actual.length; i++) {
                lib.responseEqual(actual[i], expected_miss[i]);
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

        service.request(expected_miss.length, function (actual) {
            for (var i = 0; i < actual.length; i++) {
                lib.responseEqual(actual[i], expected_miss[i]);
            }
            callback();
        });

    },

    function (callback) {
        service.shutdown();
    }

]);
