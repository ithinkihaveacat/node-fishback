/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var assert = require('assert');
var http = require('http');
var lib = require('./lib');
var fishback = require("../lib/fishback");

var NOW = 198025200000;
NOW = 0;

var response = { headers: { "cache-control": "public, max-age=60" }, body: "Hello, World!\n" };

var port = lib.PROXY_PORT;

[lib.getCacheMemory].forEach(function (callback) {

    callback(function (cache) {

        var expected = { headers: { "x-cache": "MISS" }, body: "" };

        var p = port++;

        var client = { find: function () { assert.equal(false, true); } }; // unreachable

        var proxy = new fishback.Proxy(cache, client);

        proxy.listen(p, function () {

            var options = {
                host: '0.0.0.0',
                port: p,
                path: '/',
                headers: { "cache-control": "only-if-cached" }
            };

            http.get(options, function(res) {
                var actual = { statusCode: null, headers: { }, body: "" };
                actual.statusCode = res.statusCode;
                assert.equal(res.statusCode, 504);
                actual.headers = res.headers;
                res.on('data', function(chunk) {
                    actual.body += chunk;
                });
                res.on('end', function() {
                    lib.responseEqual(actual, expected);
                    proxy.close();
                });
            });

        });
    });

    callback(function (cache) {

        var p = port++;

        var proxy = new fishback.Proxy(cache, lib.getMockClient(response));

        proxy.listen(p, function () {

            lib.step([

                function (callback) {
                    Date.prototype.getTime = function() {
                        return NOW;
                    };
                    http.get("http://0.0.0.0:" + p, function (res) {
                        assert.equal(res.statusCode, 200);
                        assert.equal(res.headers["x-cache"], "MISS");
                        callback();
                    });
                },
                function (callback) {
                    http.get("http://0.0.0.0:" + p, function (res) {
                        assert.equal(res.statusCode, 200);
                        assert.equal(res.headers["x-cache"], "HIT");
                        callback();
                    });
                },
                function (callback) {
                    var options = {
                        host: "0.0.0.0",
                        port: p,
                        path: "/",
                        headers: { "cache-control": "only-if-cached, max-age=60" }
                    };
                    http.get(options, function (res) {
                        assert.equal(res.statusCode, 200);
                        assert.equal(res.headers["x-cache"], "HIT");
                        callback();
                    });
                },
                function (callback) {
                    Date.prototype.getTime = function() {
                        return NOW + 120000;
                    };
                    var options = {
                        host: "0.0.0.0",
                        port: p,
                        path: "/",
                        headers: { "cache-control": "only-if-cached, max-age=60" }
                    };
                    http.get(options, function (res) {
                        assert.equal(res.statusCode, 504);
                        assert.equal(res.headers["x-cache"], "MISS");
                        callback();
                    });
                },
                function () {
                    proxy.close();
                }

            ]);

        });
    });
});
