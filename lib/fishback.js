/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var Handler = require("./handler");

var Client = require("./client");
var Memory = require("./memory");
var MongoDb = require("./mongodb");
var Memcached = require("./memcached");

function Fishback(list) {
    this.list = list;
    Handler.call(this);
}

require('util').inherits(Fishback, Handler);

Fishback.prototype.request = function (req, res) {

    var emit = this.emit.bind(this);

    emit('newRequest', req);

    res.on('endHead', function () {
        emit('newResponse', res, req);
    });

    // Call list[0].request(), if we get a "reject", call list[1].request(),
    // and so on.
    function process(list) {
        var head = list[0];
        var tail = list.slice(1);
        // @TODO Handle null head (all handlers emitted "reject")
        req.once("reject", function () {
            process(tail);
        });
        head.request(req, res);
    }

    process(this.list);

};

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
    serverResponse.backendUrl = clientResponse.backendUrl;
    serverResponse.method = clientResponse.method;
    // Avoid writeHead() to give listeners a change to modify the serverResponse
    serverResponse.statusCode = clientResponse.statusCode;
    serverResponse.headers = { }; // read-only!
    Object.keys(clientResponse.headers).forEach(function (k) {
        serverResponse.setHeader(k, clientResponse.headers[k]);
        serverResponse.headers[k] = clientResponse.headers[k];
    });
    serverResponse.emit('endHead');
    clientResponse.on('data', function (chunk) {
        serverResponse.write(chunk);
        serverResponse.emit('data', chunk);
    });
    clientResponse.on('end', function () {
        serverResponse.end();
        serverResponse.emit('end');
    });
}

function bufferToResponse(buffer, serverResponse) {
    serverResponse.url = buffer.url;
    serverResponse.method = buffer.method;
    // Avoid writeHead() to give listeners a change to modify the serverResponse
    serverResponse.statusCode = buffer.statusCode;
    serverResponse.headers = { };
    Object.keys(buffer.headers).forEach(function (k) {
        serverResponse.setHeader(k, buffer.headers[k]);
        // Copy to "headers" property as a convenience--the "headers" property
        // is read-only.  If trying to modify the response, use the setHeader()
        // method.
        serverResponse.headers[k] = buffer.headers[k];
    });
    serverResponse.emit('endHead');
    // nextTick so that anything listening for endHead has the chance to attach
    // listeners for the "data" and "end" events
    process.nextTick(function () {
        buffer.data.forEach(function (chunk) {
            serverResponse.write(chunk);
            serverResponse.emit('data', chunk);
        });
        serverResponse.end();
        serverResponse.emit('end');
    });
}

// clientResponse can be a ServerResponse or a ClientResponse (?)
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

function createCachingProxy(cache, client) {
    cache = cache || new Memory();
    client = client || new Client();

    // Save any new responses emitted by the client to the cache
    var fishback = new Fishback([cache, client]);
    client.on('newResponse', function (serverResponse) {
        cache.response(serverResponse);
    });

    return fishback;
}

function createProxy(client) {
    client = client || new Client();

    return new Fishback([client]);
}

[
    Client, Memory, Memcached, MongoDb, Fishback, 
    createProxy, createCachingProxy, 
    bufferToResponse, responseToBuffer,
    proxyRequest, proxyResponse
].forEach(function (fn) {
    exports[fn.name] = fn;
});
