/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require('./lib');
var fishback = require("../lib/fishback");
var assert = require('assert');

var response = { headers: { foo: "bar", "cache-control": "public, max-age=60" }, body: "Hello, World!\n" };
var expected = { headers: { foo: "bar", "cache-control": "public, max-age=60" }, body: "Hello, World!\n" };

[lib.getCacheMemory].forEach(function (callback) {
    callback(function (cache) {
        var proxy = new fishback.Proxy(cache, lib.getMockClient(response));
        proxy.listen(lib.PROXY_PORT, function () {
            lib.request(5, lib.PROXY_PORT, function (actual) {
                assert.equal(actual[0].headers["x-cache"], "MISS");
                assert.equal(actual[1].headers["x-cache"], "HIT");
                actual.forEach(function (a) {
                    lib.responseEqual(a, expected);
                });
                proxy.close();
            });
        });
    });
});
