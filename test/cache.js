/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var assert = require("assert");

var count = 0;
var list = [ require("../lib/cache.memory") ];

list.forEach(function (Cache) {

    lib.step([

        function (next) {
            var c = new Cache();

            var req = new lib.http.ServerRequest({
                url: "/",
                method: "GET"
            });

            var res = new lib.http.ServerResponse();

            req.once('reject', function () {
                count++;
            });

            c.request(req, res);
            req.fire();

            next();
        },

        function (next) {
            var c = new Cache();

            var clientResponse = new lib.http.ClientResponse({
                url: "/",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                data: [ "Hello, World!" ]
            });

            c.response(clientResponse);
            clientResponse.fire();

            var req = new lib.http.ServerRequest({
                url: "/",
                method: "GET"
            });

            var res = new lib.http.ServerResponse();
            res.once('end', function () {
                count++;
                lib.responseEqual(res, { headers: {}, data: "Hello, World!" });
            });
            c.request(req, res);

            req.fire();

            next();
        },

        function (next) {
            var req, res;

            var c = new Cache();

            res = new lib.http.ClientResponse({
                url: "/foo",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                data: [ "Hello, Foo!" ]
            });

            c.response(res);
            res.fire();

            req = new lib.http.ServerRequest({
                url: "/",
                method: "GET"
            });

            res = new lib.http.ServerResponse();

            req.on('reject', function () {
                count++;
            });

            c.request(req, res);

            req.fire();

            next();
        },

        function (next) {

            var req, res;

            var c = new Cache();

            res = new lib.http.ClientResponse({
                url: "/foo",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                data: [ "Hello, Foo!" ]
            });

            c.response(res);
            res.fire();

            res = new lib.http.ClientResponse({
                url: "/bar",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                data: [ "Hello, Bar!" ]
            });

            c.response(res);
            res.fire();

            req = new lib.http.ServerRequest({
                url: "/foo",
                method: "GET"
            });

            res = new lib.http.ServerResponse();
            res.once('end', function () {
                count++;
                lib.responseEqual(res, { headers: {}, data: "Hello, Foo!" });
            });
            c.request(req, res);

            req.fire();

            req = new lib.http.ServerRequest({
                url: "/bar",
                method: "GET"
            });

            res = new lib.http.ServerResponse();
            res.once('end', function () {
                count++;
                lib.responseEqual(res, { headers: {}, data: "Hello, Bar!" });
            });

            c.request(req, res);

            req.fire();

            req = new lib.http.ServerRequest({
                url: "/foo",
                method: "GET"
            });

            res = new lib.http.ServerResponse();
            res.once('end', function () {
                count++;
                lib.responseEqual(res, { headers: {}, data: "Hello, Foo!" });
            });

            c.request(req, res);

            req.fire();

            req = new lib.http.ServerRequest({
                url: "/quux",
                method: "GET"
            });

            res = new lib.http.ServerResponse();
            req.once('reject', function () {
                count++;
            });

            c.request(req, res);

            req.fire();

            next();
        }

    ]);

});

process.on('exit', function () {
    assert.equal(count, 7);
});
