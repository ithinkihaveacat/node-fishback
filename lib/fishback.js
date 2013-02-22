/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var helper = require("./helper");

var CacheMemory = require("./cache.memory.js");
var CacheMongoDB = require("./cache.mongodb.js");

function Proxy(cache, client) {
    this.cache = cache || new CacheMemory();
    this.client = client || new Client();
    this.reqFilter = [];
    this.resFilter = [];
}

require('util').inherits(Proxy, require('events').EventEmitter);

// designed to handle http.Server's 'request' event
Proxy.prototype.request = function (req1, res1) {

    var cache = this.cache;
    var client = this.client;
    var emit = this.emit.bind(this);

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

    emit('request', req1);

    if (req1.method === 'GET') {
        req1.on('end', function () {
            req1.complete = true;
            cache.find(req1, function (res2) {
                if (res2) {
                    emit('response', res2);
                    responseProxy(res2, res1);
                } else {
                    client.find(req1, function (res2) {
                        emit('response', res2);
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

};

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

exports.CacheMemory = CacheMemory; 
exports.CacheMongoDB = CacheMongoDB;
exports.Proxy = Proxy;

exports.createProxy = function (cache, client) {
    cache = cache || new require("./cache.memory");
    client = client || new Client("0.0.0.0", 8080);

    var server = require('http').Server();
    var proxy = new Proxy(cache, client);

    server.on('request', proxy.request.bind(proxy));
    server.fishback = proxy;

    return server;
};
