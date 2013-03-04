/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require('./fishback');
var helper = require('./helper');
var Cache = require('./cache');

function CacheMongoDb(client) {
    this.client = client;
}

require('util').inherits(CacheMongoDb, Cache);

CacheMongoDb.prototype.request = function (req, res) {

    var emit = this.emit.bind(this);

    emit('newRequest', req);

    if (req.method !== 'GET' || !helper.wantsCache(req)) {
        req.emit('reject');
        return;
    }

    this.client.findOne({ url: req.url }, function (err, entry) {

        if (err) { 
            return; // @TODO Handle the error
        }

        if (entry && helper.isVaryMatch(entry, req) && helper.isFreshEnough(entry, req)) {
            fishback.bufferToResponse(entry, res);
            res.emit('endHead');
            emit('newResponse', res);
            return;
        }

        if (helper.onlyWantsCache(req)) {
            var buffer = {
                url: req.url,
                method: req.method,
                statusCode: 504,
                headers: { "x-cache": "MISS" },
                data: [ ]
            };
            fishback.bufferToResponse(buffer, res);
            res.emit('endHead');
            emit('newResponse', res);
            return;
        } 

        req.emit('reject');
        return;

    });

};

CacheMongoDb.prototype.response = function (res) {

    if ((res.method !== 'GET') || (res.statusCode !== 200) || !helper.canCache(res)) {
        return;
    }

    var client = this.client;

    fishback.responseToBuffer(res, function (buffer) {

        // PREPARE ENTRY

        buffer.created = new Date().getTime();
        buffer.expires = helper.expiresAt(res);
        buffer.headers["x-cache"] = "HIT";

        client.insert(buffer, { w: 0 });
        
    });

};

CacheMongoDb.prototype.close = function (callback) {

    this.client.db.close();

    if (callback) {
        callback.call();
    }

};    

module.exports = CacheMongoDb;
