/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require('./fishback');
var helper = require('./helper');
var Handler = require('./handler');

function MongoDb(client) {
    this.client = client;
    Handler.call(this);
}

require('util').inherits(MongoDb, Handler);

MongoDb.prototype.request = function (req, res) {

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
            emit('newResponse', res);
            return;
        } 

        req.emit('reject');
        return;

    });

};

MongoDb.prototype.response = function (res) {

    if ((res.method !== 'GET') || (res.statusCode !== 200) || !helper.canCache(res)) {
        return;
    }

    var client = this.client;

    fishback.responseToBuffer(res, function (buffer) {

        // PREPARE ENTRY

        buffer.created = new Date().getTime();
        buffer.expires = helper.expiresAt(res);
        buffer.headers["x-cache"] = "HIT";

        client.update({ url: buffer.url }, buffer, { w: 0, upsert: true });
        
    });

};

MongoDb.prototype.close = function (callback) {

    this.client.db.close();

    if (callback) {
        return callback.call();
    }

};    

module.exports = MongoDb;
