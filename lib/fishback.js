/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var Client = require("./client");
var CacheMemory = require("./cache.memory");
var CacheMongoDb = require("./cache.mongodb");
var CacheMemcached = require("./cache.memcached");

function Proxy(list) {
    this.list = list;
}

require('util').inherits(Proxy, require('events').EventEmitter);

// Handles http.Server's 'request' event
Proxy.prototype.request = function (req, res) {

    var emit = this.emit.bind(this);

    emit('newRequest', req);

    res.on('endHead', function () {
        emit('newResponse', res, req);
    });

    // Call list[0].request(), if we get a "reject", call list[1].request(),
    // and so on.
    function reject(list) {
        var head = list[0];
        var tail = list.slice(1);
        // @TODO Handle null head
        req.once("reject", function () {
            reject(tail);
        });
        head.request(req, res);
    }

    reject(this.list);

};

function createProxy(cache, client) {
    cache = cache || new CacheMemory();
    client = client || new Client();

    // Save any new responses emitted by the client to the cache
    client.on('newResponse', function (clientResponse) {
        cache.response(clientResponse);
    });

    return new Proxy([cache, client]);
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
    serverResponse.emit('endHead');
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
    serverResponse.emit('endHead');
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
        // @TODO If data gets too big, callback(null)
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
