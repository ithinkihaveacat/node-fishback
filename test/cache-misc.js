/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var http = require("./http");
var assurt = require("./assurt");

var DELAY = 500;

lib.getCacheList(function (cache, next) {

    // Add resource #1 to cache

    (function () {

        var res = new http.ClientResponse({
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

    // Add resource #2 to cache

    (function () {

        var res = new http.ClientResponse({
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

        var req = new http.ServerRequest({
            url: "/foo",
            method: "GET"
        });
        req.noReject("A");

        var res = new http.ServerResponse();
        res.once('end', assurt.once(function F1() {
            assurt.response(res, { headers: {}, data: "Hello, Foo!" });
        }));

        setTimeout(function () {
            cache.request(req, res);
            req.fire();
        }, DELAY);

    })();

    (function () {

        var req = new http.ServerRequest({
            url: "/bar",
            method: "GET"
        });
        req.noReject("B");

        var res = new http.ServerResponse();
        res.once('end', assurt.once(function F2() {
            assurt.response(res, { headers: {}, data: "Hello, Bar!" });
        }));

        setTimeout(function () {
            cache.request(req, res);
            req.fire();
        }, DELAY);

    })();

    (function () {

        var req = new http.ServerRequest({
            url: "/foo",
            method: "GET"
        });
        req.noReject("C");

        var res = new http.ServerResponse();
        res.once('end', assurt.once(function F3() {
            assurt.response(res, { headers: {}, data: "Hello, Foo!" });
        }));

        setTimeout(function () {
            cache.request(req, res);
            req.fire();
        }, DELAY);

    })();

    (function () {

        var req = new http.ServerRequest({
            url: "/quux",
            method: "GET"
        });
        req.once('reject', assurt.once(function F4() {
            cache.close();
            next();
        }));

        var res = new http.ServerResponse();
        res.noEnd();

        setTimeout(function () {
            cache.request(req, res);
            req.fire();
        }, 2 * DELAY);

    })();

    next();

});
