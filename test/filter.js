// Tests for the filtering capability

var lib = require("./lib");
var http = require("http");

//require("fishback").setVerbose(true);

var response = { headers: { "cache-control": "max-age=60, private" }, body: "Hello, World" };

var expected = response;
expected.headers["foo"] = "bar";
expected.headers["cache-control"] = "max-age=60, public";

var service = lib.createService(response);

service.proxy.addReqFilter(function (req) {
    req.url = "http://localhost:" + service.server_port + req.url;
});
service.proxy.addResFilter(function (res) {
    res.headers["foo"] = "bar";
    res.headers["cache-control"] = res.headers["cache-control"].replace(/\bprivate\b/, "public");
});

lib.step([

    function (callback) {
    
        var options = {
            host: '127.0.0.1',
            port: service.proxy_port,
            path: '/'
        };

        http.get(options, function(res) {
            var actual = { statusCode: null, headers: { }, body: "" };
            actual.statusCode = res.statusCode;
            actual.headers = res.headers;
            res.on('data', function(chunk) {
                actual.body += chunk;
            });
            res.on('end', function() {
                lib.responseEqual(actual, response); 
                callback();
            });
        });
        
    },

    function (callback) {
        service.shutdown();
    }

]);