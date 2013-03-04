/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var Client = require("./client");
var CacheMemory = require("./cache.memory");
var CacheMongoDb = require("./cache.mongodb");
var CacheMemcached = require("./cache.memcached");

function Proxy(cache, client) {
    this.cache = cache || new CacheMemory();
    this.client = client || new Client();
    this.reqFilter = [];
    this.resFilter = [];

    client.on('newResponse', function (res) {
        cache.response(res);
    });
}

require('util').inherits(Proxy, require('events').EventEmitter);

// designed to handle http.Server's 'request' event
Proxy.prototype.request = function (req, res) {

    var cache = this.cache;
    var client = this.client;
    var emit = this.emit.bind(this);

    emit('newRequest', req);

    res.on('endHead', function () {
        emit('newResponse', res, req);
    });

    req.once('reject', function () {
        client.request(req, res);
    });

    cache.request(req, res);

};

function createProxy(cache, client) {
    cache = cache || new require("./cache.memory");
    client = client || new Client("0.0.0.0", 8080);

    var server = require('http').Server();
    var proxy = new Proxy(cache, client);

    server.on('request', proxy.request.bind(proxy));
    server.fishback = proxy;

    return server;
}

function proxyRequest(serverRequest, clientRequest) {
    // Because of inconsistencies in the http.request() API, 
    // clientRequest.headers can't be written to; the caller needs to have
    // proxied these already.
    serverRequest.on('data', function (chunk) {
        clientRequest.write(chunk);
    });
    serverRequest.on('end', function () {
        clientRequest.end();
    });
    serverRequest.on('error', function () {
        clientRequest.end();
    });
}

function proxyResponse(clientResponse, serverResponse) {
    serverResponse.url = clientResponse.url;
    serverResponse.method = clientResponse.method;
    // Avoid writeHead() to give listeners a change to modify the serverResponse
    serverResponse.statusCode = clientResponse.statusCode;
    Object.keys(clientResponse.headers).forEach(function (k) {
        serverResponse.setHeader(k, clientResponse.headers[k]);
    });
    clientResponse.on('data', function (chunk) {
        serverResponse.write(chunk);
    });
    clientResponse.on('end', function () {
        serverResponse.end();
    });
}

function bufferToResponse(buffer, serverResponse) {
    serverResponse.url = buffer.url;
    serverResponse.method = buffer.method;
    // Avoid writeHead() to give listeners a change to modify the serverResponse
    serverResponse.statusCode = buffer.statusCode;
    Object.keys(buffer.headers).forEach(function (k) {
        serverResponse.setHeader(k, buffer.headers[k]);
    });
    process.nextTick(function () {
        buffer.data.forEach(function (chunk) {
            serverResponse.write(chunk);
        });
        serverResponse.end();
    });
}

function responseToBuffer(clientResponse, callback) {
    var buffer = { 
        url: clientResponse.url,
        method: clientResponse.method,
        statusCode: clientResponse.statusCode,
        headers: { },
        data: [ ]
    };
    Object.keys(clientResponse.headers).forEach(function (k) {
        buffer.headers[k] = clientResponse.headers[k];
    });
    clientResponse.on('data', function (chunk) {
        buffer.data.push(chunk);
        // @TODO If data gets to big, callback(null)
    });
    clientResponse.on('end', function () {
        // @TODO Dispose of clientResponse and remove listeners?
        callback(buffer);
    });
    clientResponse.on('close', function () {
        // @TODO Dispose of clientResponse and remove listeners?
        callback(null);
    });
}

[
    Client, CacheMemory, CacheMemcached, CacheMongoDb, Proxy, createProxy, 
    bufferToResponse, responseToBuffer,
    proxyRequest, proxyResponse
].forEach(function (fn) {
    exports[fn.name] = fn;
});
