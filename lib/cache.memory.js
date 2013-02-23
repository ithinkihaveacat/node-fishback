/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var helper = require('./helper');
var Cache = require('./cache.base');

function CacheMemory(maxSize) {
    this.data = {}; // hash of cache entries, keyed on URL for efficient lookup
    this.list = []; // array of cache entries, for efficient random access (useful for cache cleaning)
    this.maxSize = maxSize || 2000;

    Cache.call(this);
}

require('util').inherits(CacheMemory, Cache);

CacheMemory.prototype.find = function (req, callback) {
    var i, entry;

    function send(entry) {
        entry.body.forEach(function (chunk) {
            entry.emit('data', chunk);
        });
        entry.emit('end');
    }

    if ((req.method === 'GET') && this.data[req.url] && helper.wantsCache(req)) {
        for (i = 0; i < this.data[req.url].length; i++) {
            entry = this.data[req.url][i];
            if (helper.isVaryMatch(entry, req) && helper.isFreshEnough(entry, req)) {
                entry.removeAllListeners();
                entry.accessed = new Date().getTime();
                entry.count++;
                callback(entry);
                send(entry);
                return;
            }
        }
    }

    if (helper.onlyWantsCache(req)) {
        entry = new (require('events').EventEmitter)();
        entry.statusCode = 504;
        entry.headers = { "x-cache": "MISS" };
        callback(entry);
        entry.emit('end');
        return;
    } else {
        callback(null);
    }
};

CacheMemory.prototype.add = function (res) {

    if ((res.method !== 'GET') || (res.statusCode !== 200) || !helper.canCache(res)) {
        return;
    }
    
    var entry = new (require('events').EventEmitter)();

    entry.method = res.method;
    entry.url = res.url;
    entry.statusCode = res.statusCode;
    entry.body = [];
    entry.expires = helper.expiresAt(res);
    entry.created = new Date().getTime();
    entry.accesed = new Date().getTime();
    entry.count = 1;

    // Have to manually copy headers, otherwise we share it with res
    entry.headers = {};
    Object.keys(res.headers).forEach(function (k) {
        entry.headers[k] = res.headers[k];
    });
    entry.headers["x-cache"] = "HIT";

    res.on('data', function (chunk) {
        // Treat as an array and append rather than concatenate strings--if treating
        // as strings, run into encoding issues.  Also, this way the client gets
        // exactly the same size chunks as the proxy does, which seems like a
        // nice thing to do.
        entry.body.push(chunk);
    });

    res.on('end', (function () {

        // Clean before adding to the cache, mostly because it would be annoying
        // to have our newly-added cache entry cleaned right away.
        this.clean();
        
        if (!this.data[res.url]) {
            this.data[res.url] = [ entry ];
        } else {
            this.data[res.url].push(entry);
        }

        this.list.push(entry);

    }).bind(this));

};

/**
 * Trims the cache to be less than or equal to this.maxSize entries.
 */

CacheMemory.prototype.clean = function () {
    if ((this.list.length === 0) || (this.list.length <= this.maxSize)) {
        return;
    }

    // Find the index of the LRU entry of three picked at random.  The
    // random indices could be exactly the same, but this is unlikely
    // (outside of tests), and it's much easier to generate random
    // numbers with replacement.  (And it won't lead to incorrect
    // results.)
    var index = [
        Math.floor(Math.random() * this.list.length),
        Math.floor(Math.random() * this.list.length),
        Math.floor(Math.random() * this.list.length)
    ].reduce((function (a, b) { return this.list[a].accessed < this.list[b].accessed ? a : b; }).bind(this));
    
    var entry = this.list.splice(index, 1)[0];

    for (var i = 0; i < this.data[entry.url].length; i++) {
        if (entry === this.data[entry.url][i]) {
            this.data[entry.url].splice(i, 1); // delete doesn't change the length of the array!
            if (this.data[entry.url].length === 0) {
                delete this.data[entry.url];
            }
            break;
        }
    }
};

module.exports = CacheMemory;
