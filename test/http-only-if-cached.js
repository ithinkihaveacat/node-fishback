/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var assert = require('assert');
var assurt = require("./assurt");
var lib = require('./lib');
var http = require("./http");
var fishback = require("../lib/fishback");

var NOW = 198025200000;

lib.getCacheList(function (cache) {

    (function () {

        var client = new fishback.Client(null, null, {
            request: function () { assert.equal(false, true); }
        });

        var proxy = fishback.createCachingProxy(cache, client);

        var req = new http.ServerRequest({
            url: "/",
            method: "GET",
            headers: { "cache-control": "only-if-cached" }
        });

        var res = new http.ServerResponse();
        res.on('end', assurt.once(function F1() {
            assurt.response(res, { 
                statusCode: 504, 
                headers: { "x-cache": "MISS" }, 
                data: "" 
            });
            cache.close();
        }));

        proxy.request(req, res);
        req.fire();

    })();

});

lib.getCacheList(function (cache, next) {

    (function () {

        var response = {
            url: "/",
            method: "GET",
            statusCode: 200,
            headers: { "x-cache": "MISS", "cache-control": "public, max-age=60" }, 
            body: [ "Hello, World!\n" ]
        };

        var client = new fishback.Client(null, null, {
            request: function (options, callback) {
                var clientResponse = new http.ClientResponse(response);
                callback(clientResponse);
                clientResponse.fire();
                return new http.ClientRequest();
            }
        });

        var proxy = fishback.createCachingProxy(cache, client);

        lib.step([

            function (callback) {
                Date.prototype.getTime = function() {
                    return NOW;
                };
                var req = new http.ServerRequest({ url: "/", method: "GET" });
                var res = new http.ServerResponse();
                res.on('end', assurt.once(function F2() {
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers["x-cache"], "MISS");
                    callback();
                }));
                proxy.request(req, res);
                req.fire();
            },
            function (callback) {
                var req = new http.ServerRequest({ url: "/", method: "GET" });
                var res = new http.ServerResponse();
                res.on('end', assurt.once(function F3() {
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers["x-cache"], "HIT");
                    callback();
                }));
                proxy.request(req, res);
                req.fire();
            },
            function (callback) {
                var req = new http.ServerRequest({
                    url: "/",
                    method: "GET",
                    headers: { "cache-control": "only-if-cached, max-age=60" }
                });
                var res = new http.ServerResponse();
                res.on('end', assurt.once(function F4() {
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers["x-cache"], "HIT");
                    callback();
                }));
                proxy.request(req, res);
                req.fire();
            },
            function (callback) {
                Date.prototype.getTime = function() {
                    return NOW + 120000;
                };
                var req = new http.ServerRequest({
                    url: "/",
                    method: "GET",
                    headers: { "cache-control": "only-if-cached, max-age=60" }
                });
                var res = new http.ServerResponse();
                res.on('end', assurt.once(function F5() {
                    assert.equal(res.statusCode, 504);
                    assert.equal(res.headers["x-cache"], "MISS");
                    callback();
                    cache.close();
                }));
                proxy.request(req, res);
                req.fire();
            }

        ]);
    })();

    next();
});
