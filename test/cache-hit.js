/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var http = require("./http");
var assurt = require("./assurt");

lib.getCacheList(function (cache, next) {

    var clientResponse = new http.ClientResponse({
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

    var req = new http.ServerRequest({
        url: "/",
        method: "GET"
    });
    req.on('reject', assurt.never(function q1() {
        cache.close();
    }));

    var res = new http.ServerResponse();
    res.once('end', assurt.calls(function () {
        assurt.response(res, { headers: {}, data: "Hello, World!" });
        cache.close();
        next();
    }));

    cache.request(req, res);
    req.fire();

});
