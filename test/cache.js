/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var assert = require("assert");
var assurt = require("./assurt");

var list = [ lib.getCacheMemory, lib.getCacheMongoDb ];

list.forEach(function (callback) {

    lib.step([
        function (next) {
            callback(ResponseNotCachedCacheMiss);
            next();
        },
        function (next) {
            callback(ResponseCachedCacheHit);
            next();
        },
        function (next) {
            callback(ResponseNotCachedCacheMiss2);
            next();
        },
        function (next) {
            callback(SomeResponsesCachedSomeCacheHits);
            next();
        }
    ]);

    function ResponseNotCachedCacheMiss(cache) {

        var req = new lib.http.ServerRequest({
            url: "/",
            method: "GET"
        });

        var res = new lib.http.ServerResponse();

        req.once('reject', assurt.calls(function () {
            cache.close();
        }));

        cache.request(req, res);
        req.fire();

    }    

    function ResponseCachedCacheHit(cache) {

        var clientResponse = new lib.http.ClientResponse({
            url: "/",
            method: "GET",
            statusCode: 200,
            headers: {
                "cache-control": "public, max-age=60"
            },
            data: [ "Hello, World!" ]
        });

        cache.response(clientResponse);
        clientResponse.fire();

        var req = new lib.http.ServerRequest({
            url: "/",
            method: "GET"
        });
        req.on('reject', function () {
            assert.ok(false, "Request is not supposed to be rejected!");
            cache.close();
        });

        var res = new lib.http.ServerResponse();
        res.once('end', assurt.calls(function () {
            assurt.response(res, { headers: {}, data: "Hello, World!" });
            cache.close();
        }));

        setTimeout(function () {
            cache.request(req, res);
            req.fire();
        }, 1000);

    }

    function ResponseNotCachedCacheMiss2(cache) {

        var req, res;

        res = new lib.http.ClientResponse({
            url: "/foo",
            method: "GET",
            statusCode: 200,
            headers: {
                "cache-control": "public, max-age=60"
            },
            data: [ "Hello, Foo!" ]
        });

        cache.response(res);
        res.fire();

        req = new lib.http.ServerRequest({
            url: "/",
            method: "GET"
        });

        res = new lib.http.ServerResponse();
        res.on('end', function () {
            assert.ok(false, "Response is not supposed to be returned!");
            cache.close();
        });

        req.on('reject', assurt.calls(function () {
            cache.close();
        }));

        setTimeout(function () {
            cache.request(req, res);
            req.fire();
        }, 1000);

    }

    function SomeResponsesCachedSomeCacheHits(cache) {

        (function () {

            var res = new lib.http.ClientResponse({
                url: "/foo",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                data: [ "Hello, Foo!" ]
            });

            cache.response(res);
            res.fire();

        })();

        (function () {

            var res = new lib.http.ClientResponse({
                url: "/bar",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                data: [ "Hello, Bar!" ]
            });

            cache.response(res);
            res.fire();

        })();

        (function () {

            var req = new lib.http.ServerRequest({
                url: "/foo",
                method: "GET"
            });
            req.noReject();

            var res = new lib.http.ServerResponse();
            res.once('end', assurt.calls(function () {
                assurt.response(res, { headers: {}, data: "Hello, Foo!" });
            }));

            setTimeout(function () {
                cache.request(req, res);
                req.fire();
            }, 1000);

        })();

        (function () {

            var req = new lib.http.ServerRequest({
                url: "/bar",
                method: "GET"
            });
            req.noReject();

            var res = new lib.http.ServerResponse();
            res.once('end', assurt.calls(function () {
                assurt.response(res, { headers: {}, data: "Hello, Bar!" });
            }));

            setTimeout(function () {
                cache.request(req, res);
                req.fire();
            }, 2000);

        })();

        (function () {

            var req = new lib.http.ServerRequest({
                url: "/foo",
                method: "GET"
            });
            req.noReject();

            var res = new lib.http.ServerResponse();
            res.once('end', assurt.calls(function () {
                assurt.response(res, { headers: {}, data: "Hello, Foo!" });
            }));

            setTimeout(function () {
                cache.request(req, res);
                req.fire();
            }, 1000);

        })();

        (function () {

            var req = new lib.http.ServerRequest({
                url: "/quux",
                method: "GET"
            });
            req.once('reject', assurt.calls(function () {
                cache.close();
            }));

            var res = new lib.http.ServerResponse();
            res.noEnd();

            setTimeout(function () {
                cache.request(req, res);
                req.fire();
            }, 2000);

        })();

    }

});
