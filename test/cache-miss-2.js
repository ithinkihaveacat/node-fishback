/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var assert = require("assert");
var assurt = require("./assurt");

lib.getCacheList(function (cache, next) {

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
        next();
    }));

    cache.request(req, res);
    req.fire();

});
