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

            c.find(req, function (res) {
                count++;
                assert.equal(res, null);
            });

            req.fire();

            next();
        },

        function (next) {
            var c = new Cache();

            var res = new lib.http.ClientResponse({
                url: "/",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                body: [ "Hello, World!" ]
            });

            c.add(res);
            res.fire();

            var req = new lib.http.ServerRequest({
                url: "/",
                method: "GET"
            });

            c.find(req, function (res) {
                count++;
                lib.responseEqual(res, { headers: {}, body: "Hello, World!" });
            });

            req.fire();

            next();
        },

        function (next) {
            var c = new Cache();

            var res = new lib.http.ClientResponse({
                url: "/foo",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                body: [ "Hello, Foo!" ]
            });

            c.add(res);
            res.fire();

            var req = new lib.http.ServerRequest({
                url: "/",
                method: "GET"
            });

            c.find(req, function (res) {
                count++;
                assert.equal(res, null);
            });

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
                body: [ "Hello, Foo!" ]
            });

            c.add(res);
            res.fire();

            res = new lib.http.ClientResponse({
                url: "/bar",
                method: "GET",
                statusCode: 200,
                headers: {
                    "cache-control": "public, max-age=60"
                },
                body: [ "Hello, Bar!" ]
            });

            c.add(res);
            res.fire();

            req = new lib.http.ServerRequest({
                url: "/foo",
                method: "GET"
            });

            c.find(req, function (res) {
                count++;
                lib.responseEqual(res, { headers: {}, body: "Hello, Foo!" });
            });

            req.fire();

            req = new lib.http.ServerRequest({
                url: "/bar",
                method: "GET"
            });

            c.find(req, function (res) {
                count++;
                lib.responseEqual(res, { headers: {}, body: "Hello, Bar!" });
            });

            req.fire();

            req = new lib.http.ServerRequest({
                url: "/foo",
                method: "GET"
            });

            c.find(req, function (res) {
                count++;
                lib.responseEqual(res, { headers: {}, body: "Hello, Foo!" });
            });

            req.fire();

            req = new lib.http.ServerRequest({
                url: "/quux",
                method: "GET"
            });

            c.find(req, function (res) {
                count++;
                assert.equal(res, null);
            });

            req.fire();

            next();
        }

    ]);

});

process.on('exit', function () {
    assert.equal(count, 7);
});
