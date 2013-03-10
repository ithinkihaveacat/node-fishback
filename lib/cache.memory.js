/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var fishback = require('./fishback');
var helper = require('./helper');
var Cache = require('./cache');

function CacheMemory(maxSize) {
    this.data = {}; // hash of cache entries, keyed on URL for efficient lookup
    this.list = []; // array of cache entries, for efficient random access (useful for cache cleaning)
    this.maxSize = maxSize || 2000;

    Cache.call(this);
}

require('util').inherits(CacheMemory, Cache);

CacheMemory.prototype.request = function (req, res) {

    var emit = this.emit.bind(this);

    var i, buffer;

    emit('newRequest', req);

    if (req.method !== 'GET') {
        req.emit('reject');
        return;
    }

    if (this.data[req.url] && helper.wantsCache(req)) {
        for (i = 0; i < this.data[req.url].length; i++) {
            buffer = this.data[req.url][i];
            if (helper.isVaryMatch(buffer, req) && helper.isFreshEnough(buffer, req)) {
                fishback.bufferToResponse(buffer, res);
                emit('newResponse', res);
                return;
            }
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
    } else {
        req.emit('reject');
        return;
    }

};

CacheMemory.prototype.response = function (clientResponse) {

    if ((clientResponse.method !== 'GET') || 
        (clientResponse.statusCode !== 200) || 
        !helper.canCache(clientResponse)) {
        return;
    }

    fishback.responseToBuffer(clientResponse, (function (buffer) {

        // PREPARE ENTRY

        buffer.created = new Date().getTime();
        buffer.expires = helper.expiresAt(clientResponse);
        buffer.headers["x-cache"] = "HIT";

        // INSERT ENTRY

        // Clean before adding to the cache, mostly because it would be annoying
        // to have our newly-added cache entry cleaned right away.
        this.clean();
        
        if (!this.data[buffer.url]) {
            this.data[buffer.url] = [ buffer ];
        } else {
            this.data[buffer.url].push(buffer);
        }

        this.list.push(buffer);

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
