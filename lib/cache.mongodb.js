/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var Cache = require('./cache');

function CacheMongoDB(client) {
    this.client = client;
}

require('util').inherits(CacheMongoDB, Cache);

CacheMongoDB.prototype.find = function (req, cacheHit, cacheMiss) {

    var that = this;

    if (req.method === 'GET' && wantsCache(req)) {
        this.client.findOne({ _id: req.url }, (function (err, doc) {
            var entry, i;
            if (err) { 
                return; 
            }
            if (doc) {
                for (i = 0; i < doc.entries.length; i++) {
                    entry = doc.entries[i];
                    if (isVaryMatch(entry, req) && isFreshEnough(entry, req)) {
                        cacheHit(entry);
                        return;
                    }
                }
                cacheMiss(this.add.bind(this)); 
            } else {
                cacheMiss(that.add.bind(that)); 
            }                
        }).bind(this));
    } else {
        cacheMiss(this.add.bind(this));
    }

};

CacheMongoDB.prototype.add = function (res, callback) {

    if ((res.method !== 'GET') || (res.statusCode !== 200) || !canCache(res)) {
        return;
    }
    
    var entry = {
        headers: res.headers,
        body: [], // appended to below, as we receive data
        expires: expiresAt(res),
        created: new Date().getTime()
    };

    res.on('data', function (chunk) {
        // Treat as an array and append rather than concatenate strings--if treating
        // as strings, run into encoding issues.  Also, this way the client gets
        // exactly the same size chunks as the proxy does, which seems like a
        // nice thing to do.
        entry.body.push(chunk);
    });

    res.on('end', (function () {

        this.client.update({
            _id: res.url
        }, {
            $push: {
                entries: entry
            }
        }, callback);
        
    }).bind(this));

};

