/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require('./lib');
var fishback = require("../lib/fishback");
var assert = require('assert');

var count = 0;

var response = {
    url: "/",
    method: "GET",
    statusCode: 200, 
    headers: { "x-cache": "MISS", "cache-control": "public, max-age=60" }, 
    data: [ "Hello, World!\n" ]
};

[lib.getCacheMemory].forEach(function (callback) {

    callback(function (cache) {

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
