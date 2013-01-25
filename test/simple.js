var lib = require('./lib');
var fishback = require("../lib/fishback");

var response = { headers: { "foo": "bar" }, body: "Hello, World" };
var expected = { headers: { "foo": "bar" }, body: "Hello, World" };

lib.getStatic(response, lib.SERVER_PORT, function (static) {

    var port = lib.PROXY_PORT;

    var caches = [ lib.getCacheLocal ];

    var knock = lib.knock(caches.length, function () {
        static.close();
    });

    caches.forEach(function (callback) {
        callback(function (cache) {
            var proxy = fishback.createServer(cache);
            var p = port++;
            proxy.listen(p, function () {
                lib.request(10, p, function (actual) {
                    actual.forEach(function (a) {
                        lib.responseEqual(a, expected);
                    });
                    proxy.close(function () {
                        cache.close();
                        knock();
                    });
                });
            });
        });
    });

});
