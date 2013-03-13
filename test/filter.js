/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var DELAY = 500;

var lib = require("./lib");
var assurt = require("./assurt");
var fishback = require("../lib/fishback");

var response = { statusCode: 200, headers: { "cache-control": "max-age=60, private" }, data: [ "Hello, World" ]};
var expected = { headers: { "foo": "bar", "cache-control": "max-age=60, public" }, data: "Hello, World" };

[lib.getCacheMemory, lib.getCacheMongoDb].forEach(function (callback) {

    callback(function (cache) {

        var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
        var res = new lib.http.ServerResponse();

        var client = new fishback.Client(null, null, {
            request: assurt.calls(function (options, callback) {
                var clientResponse = new lib.http.ClientResponse(response);
                callback(clientResponse);
                clientResponse.fire();
                return new lib.http.ClientRequest();
            })
        });

        var proxy = fishback.createCachingProxy(cache, client);

        proxy.on('newRequest', assurt.calls(function (req) {
            req.url = "/404";
        }));

        proxy.on('newResponse', assurt.calls(function (res) {
            res.setHeader('foo', 'bar');
            res.setHeader(
                'cache-control', 
                res.getHeader('cache-control').replace(/\bprivate\b/, "public")
            );
        }));

        res.on('end', assurt.calls(function () {
            assurt.response(res, expected);
        }));

        proxy.request(req, res);
        req.fire();

        setTimeout(cache.close.bind(cache), DELAY);

    });
    
});
