/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require('./fishback');
var helper = require('./helper');
var Handler = require('./handler');

var memjs = require('memjs');

function Memcached(client) {
    this.client = client || memjs.Client.create();
    Handler.call(this);
}

require('util').inherits(Memcached, Handler);

Memcached.prototype.request = function (req, res) {

    var emit = this.emit.bind(this);

    emit('newRequest', req);

    if (req.method !== 'GET' || !helper.wantsCache(req)) {
        req.emit('reject');
        return;
    }

    var client = this.client;

    client.get(req.url, function (err, buffer) {

        if (err) {
            return; // @TODO Handle error
        }

        if (buffer && buffer.toString()) {
            // @TODO Handle malformed JSON
            var entry;
            try {
                entry = JSON.parse(buffer);
            } catch (e) {
                req.emit('reject');
                return;
            }
            if (helper.isVaryMatch(entry, req) && helper.isFreshEnough(entry, req)) {
                fishback.bufferToResponse(entry, res);
                emit('newResponse', res);
                return;
            }
        }

        if (helper.onlyWantsCache(req)) {
            fishback.bufferToResponse({
                url: req.url,
                method: req.method,
                statusCode: 504,
                headers: { "x-cache": "MISS" },
                data: [ ]
            }, res);
            emit('newResponse', res);
            return;
        }

        req.emit('reject');
        return;

    });

};

Memcached.prototype.response = function (res) {

    if ((res.method !== 'GET') || (res.statusCode !== 200) || !helper.canCache(res)) {
        return;
    }

    var client = this.client;

    fishback.responseToBuffer(res, function (entry) {

        // PREPARE ENTRY

        entry.created = new Date().getTime();
        entry.expires = helper.expiresAt(res);
        entry.headers["x-cache"] = "HIT";

        // INSERT ENTRY

        client.set(res.url, JSON.stringify(entry), function (err) {
            if (err) {
                console.log("error = ", err);
            }
        });

    });
    
};

Memcached.prototype.close = function () {
    return this.client.close();
};

module.exports = Memcached;
