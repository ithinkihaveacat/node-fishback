/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var helper = require("./helper");

var VERBOSE = true;

function Proxy(cache, client) {
    cache = cache || new CacheLocal();
    client = client || new Client();

    var reqFilter = this.reqFilter = [];
    var resFilter = this.resFilter = [];

    require('http').Server.call(this);

    this.on('request', function (req1, res1) {

        function responseProxy(src, dst) {
            dst.url = src.url;
            dst.method = src.method;
            dst.writeHead(src.statusCode, src.headers);
            src.on('data', function (chunk) {
                dst.write(chunk);
            });
            src.on('end', function () {
                dst.end();
            });
            src.on('error', function () {
                dst.end();
            });
        }

        reqFilter.forEach(function (fn) {
            fn(req1);
        });

        if (req1.method === 'GET') {
            req1.on('end', function () {
                req1.complete = true;
                cache.find(req1, function (res2) {
                    if (res2) {
                        responseProxy(res2, res1);
                    } else {
                        client.find(req1, function (res2) {
                            resFilter.forEach(function (fn) {
                                fn(res2);
                            });
                            cache.add(res2); // @TODO unless no-store in req
                            responseProxy(res2, res1);
                        });
                    }
                });
            });
        } else {
            req1.complete = false;
            client.find(req1, function (res2) {
                responseProxy(res2, res1);
            });
        }

    });

}

require('util').inherits(Proxy, require('http').Server);

function Client(backend_host, backend_port, http) {
    this.backend_host = backend_host;
    this.backend_port = backend_port;
    this.http = http || require('http');
}

Client.prototype.find = function (req1, callback) {

    function requestProxy(src, dst) {
        src.on('data', function (chunk) {
            dst.write(chunk);
        });
        src.on('end', function () {
            dst.end();
        });
        src.on('error', function () {
            dst.end();
        });
    }
    
    var tmp = require('url').parse(req1.url);

    var options = {
        "host": this.backend_host,
        "port": this.backend_port,
        "path": tmp.pathname + (tmp.search ? tmp.search : ''),
        "method": req1.method,
        "headers": req1.headers
    };

    var req2 = this.http.request(options, function (res) {
        res.url = req1.url;
        res.method = req1.method;
        res.headers["x-cache"] = "MISS";
        callback(res);
    });

    if (req1.complete) { 
        req2.end(); // not going to get an 'end' event, don't wait up for it
    } else {
        requestProxy(req1, req2);
    }

};

exports.setVerbose = function (v) {
    VERBOSE = v;
};

exports.CacheMemory = require("./cache.memory.js");
exports.CacheMongoDB = require("./cache.mongodb.js");
exports.Proxy = Proxy;
