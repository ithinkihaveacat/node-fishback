/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var assert = require('assert');
var lib = require('./lib');
var fishback = require("../lib/fishback");

var NOW = 198025200000;
NOW = 0;

var count = 0;

[lib.getCacheMemory].forEach(function (callback) {

    callback(function (cache) {

        var client = new fishback.Client(null, null, {
            request: function () { assert.equal(false, true); }
        });

        var proxy = new fishback.Proxy(cache, client);

        var req = new lib.http.ServerRequest({
            url: "/",
            method: "GET",
            headers: { "cache-control": "only-if-cached" }
        });

        var res = new lib.http.ServerResponse();
        res.on('end', function () {
            count++;
            lib.responseEqual(res, { 
                statusCode: 504, 
                headers: { "x-cache": "MISS" }, 
                data: "" 
            });
        });

        proxy.request(req, res);
        req.fire();

    });

    callback(function (cache) {

        var response = {
            url: "/",
            method: "GET",
            statusCode: 200,
            headers: { "x-cache": "MISS", "cache-control": "public, max-age=60" }, 
            body: [ "Hello, World!\n" ]
        };

        var client = new fishback.Client(null, null, {
            request: function (options, callback) {
                var clientResponse = new lib.http.ClientResponse(response);
                callback(clientResponse);
                clientResponse.fire();
                return new lib.http.ClientRequest();
            }
        });

        var proxy = new fishback.Proxy(cache, client);

        lib.step([

            function (callback) {
                Date.prototype.getTime = function() {
                    return NOW;
                };
                var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                var res = new lib.http.ServerResponse();
                res.on('end', function () {
                    count++;
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers["x-cache"], "MISS");
                    callback();
                });
                proxy.request(req, res);
                req.fire();
            },
            function (callback) {
                var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                var res = new lib.http.ServerResponse();
                res.on('end', function () {
                    count++;
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers["x-cache"], "HIT");
                    callback();
                });
                proxy.request(req, res);
                req.fire();
            },
            function (callback) {
                var req = new lib.http.ServerRequest({
                    url: "/",
                    method: "GET",
                    headers: { "cache-control": "only-if-cached, max-age=60" }
                });
                var res = new lib.http.ServerResponse();
                res.on('end', function () {
                    count++;
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers["x-cache"], "HIT");
                    callback();
                });
                proxy.request(req, res);
                req.fire();
            },
            function (callback) {
                Date.prototype.getTime = function() {
                    return NOW + 120000;
                };
                var req = new lib.http.ServerRequest({
                    url: "/",
                    method: "GET",
                    headers: { "cache-control": "only-if-cached, max-age=60" }
                });
                var res = new lib.http.ServerResponse();
                res.on('end', function () {
                    count++;
                    assert.equal(res.statusCode, 504);
                    assert.equal(res.headers["x-cache"], "MISS");
                    callback();
                });
                proxy.request(req, res);
                req.fire();
            }

        ]);
    });
});

process.on('exit', function () {
    assert.equal(count, 5);
});
