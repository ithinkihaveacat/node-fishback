/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require("./fishback");

function Client(backend_hostname, backend_port, http) {
    this.backend_hostname = backend_hostname;
    this.backend_port = backend_port;
    this.http = http || require('http');
}

require('util').inherits(Client, require('events').EventEmitter);

Client.prototype.request = function (serverRequest, serverResponse) {

    var emit = this.emit.bind(this);

    emit('newRequest', serverRequest);

    var req = { 
        url: serverRequest.url,
        method: serverRequest.method,
        headers: { }
    };
    Object.keys(serverRequest.headers).forEach(function (k) {
        req.headers[k] = serverRequest.headers[k];
    });

    var tmp = require('url').parse(req.url);

    var options = {
        "host": tmp.hostname || this.backend_hostname,
        "port": tmp.port     || this.backend_port,
        "path": tmp.pathname + (tmp.search ? tmp.search : ''),
        "method": req.method,
        "headers": req.headers
    };
    options.headers.host = options.host;

    var clientRequest = this.http.request(options, function (clientResponse) {
        clientResponse.url = serverRequest.url;
        clientResponse.method = serverRequest.method;
        clientResponse.headers["x-cache"] = "MISS";
        fishback.proxyResponse(clientResponse, serverResponse);
        emit('newResponse', clientResponse);
    });

    fishback.proxyRequest(serverRequest, clientRequest);

};

module.exports = Client;
