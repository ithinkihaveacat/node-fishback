/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require('./fishback');
var helper = require('./helper');
var Cache = require('./cache');

var memjs = require('memjs');

function CacheMemcached() {
    this.client = memjs.Client.create();
    Cache.call(this);
}

require('util').inherits(CacheMemcached, Cache);

CacheMemcached.prototype.request = function (req, res) {

    var emit = this.emit.bind(this);

    emit('newRequest', req);

    if (req.method !== 'GET' || !helper.wantsCache(req)) {
        req.emit('reject');
        return;
    }

    console.log("looking for ", req.url);

    var client = this.getClient();

    client.get(req.url, function (err, buffer) {

        console.log("get's callback, buffer = ", buffer);

        if (err) {
            return; // @TODO Handle error
        }

        if (buffer && buffer.toString()) {
            // @TODO Handle malformed JSON
            var entry;
            try {
                entry = JSON.parse(buffer);
            } catch (e) {
                console.log("Malformed JSON:", buffer);
                req.emit('reject');
                return;
            }
            if (helper.isVaryMatch(entry, req) && helper.isFreshEnough(entry, req)) {
                console.log("cache entry is good, returning to client");
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

        console.log("rejecting...");

        req.emit('reject');
        return;

    });

};

CacheMemcached.prototype.getClient = function () {
    return require('memjs').Client.create();
};

CacheMemcached.prototype.response = function (res) {

    if ((res.method !== 'GET') || (res.statusCode !== 200) || !helper.canCache(res)) {
        return;
    }

    var client = this.getClient();

    fishback.responseToBuffer(res, function (entry) {

        // PREPARE ENTRY

        entry.created = new Date().getTime();
        entry.expires = helper.expiresAt(res);
        entry.headers["x-cache"] = "HIT";

        // INSERT ENTRY

        console.log("saving entry = ", entry);
        console.log("... to ", res.url);
        client.set(res.url, JSON.stringify(entry), function (err) {
            if (err) {
                console.log("error = ", err);
            }
        });

    });
    
};

CacheMemcached.prototype.close = function () {
    this.client.close();
};

module.exports = CacheMemcached;
