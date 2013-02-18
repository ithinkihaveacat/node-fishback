// Tests for the filtering capability

var lib = require("./lib");
var fishback = require("../lib/fishback");
var http = require("http");
var assert = require("assert");

//require("fishback").setVerbose(true);

var response = { headers: { "cache-control": "max-age=60, private" }, body: "Hello, World" };

var expected = { headers: { "foo": "bar", "cache-control": "max-age=60, public" }, body: "Hello, World" };

[lib.getCacheLocal].forEach(function (callback) {

    callback(function (cache) {

        var proxy = new fishback.Proxy(cache, lib.getMockClient(response));

        proxy.listen(lib.PROXY_PORT, function () {

            proxy.reqFilter.push(function (req) {
                req.url = "/404";
            });

            proxy.resFilter.push(function (res) {
                res.headers["foo"] = "bar";
                res.headers["cache-control"] = res.headers["cache-control"].replace(/\bprivate\b/, "public");
            });

            lib.step([

                function (callback) {
                
                    var options = {
                        host: '0.0.0.0',
                        port: lib.PROXY_PORT,
                        path: '/'
                    };

                    http.get(options, function(res) {
                        var actual = { statusCode: null, headers: { }, body: "" };
                        actual.statusCode = res.statusCode;
                        assert.equal(res.statusCode, 404);
                        actual.headers = res.headers;
                        res.on('data', function(chunk) {
                            actual.body += chunk;
                        });
                        res.on('end', function() {
                            lib.responseEqual(actual, expected); 
                            callback();
                        });
                    });
                    
                },

                function (callback) {
                    proxy.close();
                }

            ]);

        });

    });
    
});
