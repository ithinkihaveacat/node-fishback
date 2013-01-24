var lib = require('./lib');
var fishback = require("../lib/fishback");

var response = { headers: { "foo": "bar" }, body: "Hello, World" };
var expected = { headers: { "foo": "bar" }, body: "Hello, World" };

lib.knock({
    "static": lib.getStatic.bind(null, response, lib.SERVER_PORT),
    "cache": lib.getCacheLocal
}, function (knock) {
    var proxy = fishback.createServer(knock.cache);
    proxy.listen(lib.PROXY_PORT, function () {
        lib.request(10, function (actual) {
            actual.forEach(function (a) {
                lib.responseEqual(a, expected);
            });
            proxy.close();
            knock.cache.close();
            knock.static.close();
        });
    });
});
