/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var lib = require("./lib");
var http = require("./http");
var assurt = require("./assurt");

lib.getCacheList(function (cache, next) {

    var req = new http.ServerRequest({
        url: "/",
        method: "GET"
    });

    var res = new http.ServerResponse();

    req.once('reject', assurt.calls(function () {
        cache.close();
        next();
    }));

    cache.request(req, res);
    req.fire();

});
