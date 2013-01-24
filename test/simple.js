var lib = require('./lib');
var fishback = require("../lib/fishback");

var response = { headers: { "foo": "bar" }, body: "Hello, World" };
var expected = { headers: { "foo": "bar" }, body: "Hello, World" };

lib.group({
    "static": lib.getStatic.bind(null, response, lib.SERVER_PORT),
    "cache": lib.getCacheLocal
}, function (group) {
    var proxy = fishback.createServer(group.cache);
    proxy.listen(lib.PROXY_PORT, function () {
        lib.request(10, function (actual) {
            actual.forEach(function (a) {
                lib.responseEqual(a, expected);
            });
            proxy.close();
            group.cache.close();
            group.static.close();
        });
    });
});
