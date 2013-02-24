/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var Client = require("./client");
var CacheMemory = require("./cache.memory");
var CacheMongoDB = require("./cache.mongodb");

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

    /**
     * @param  {http.ClientResponse} src
     * @param  {http.ServerResponse} dst
     */
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
                        responseProxy(res2, res1);
                        cache.add(res2); // @TODO unless no-store in req
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
