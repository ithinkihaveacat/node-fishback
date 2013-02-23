/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require('./lib');
var fishback = require("../lib/fishback");
var assert = require('assert');

var count = 0;

var response = { 
    statusCode: 200, 
    headers: { "x-cache": "MISS", "cache-control": "public, max-age=60" }, 
    body: [ "Hello, World!\n" ]
};

[lib.getCacheMemory].forEach(function (callback) {

    callback(function (cache) {

        var proxy = new fishback.Proxy(cache, {
            find: function (req, callback) {
                var res = new lib.http.ClientResponse(response);
                res.url = req.url;
                res.method = req.method;
                callback(res);
                res.fire();
            }
        });

        lib.step([

            function (next) {

                function end() {
                    count++;
                    assert.equal(res.headers["x-cache"], "MISS");
                    next();
                }

                for (var i = 0; i < 1; i++) {
                    var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                    var res = new lib.http.ServerResponse();
                    res.on('end', end);
                    proxy.request(req, res);
                    req.fire();
                }

            },

            function (next) {

                function end() {
                    count++;
                    assert.equal(res.headers["x-cache"], "HIT");
                    next();
                }

                for (var j = 0; j < 4; j++) { // @TODO Use astep, not async safe
                    var req = new lib.http.ServerRequest({ url: "/", method: "GET" });
                    var res = new lib.http.ServerResponse();
                    res.on('end', end);
                    proxy.request(req, res);
                    req.fire();
                }

            }

        ]);

    });
});

process.on('exit', function () {
    assert.equal(5, count);
});
