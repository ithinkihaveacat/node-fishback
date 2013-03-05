/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

function Cache() {
}

require('util').inherits(Cache, require('events').EventEmitter);

Cache.prototype.request = function (serverRequest, serverResponse) { 
    // jshint unused:false
};

/**
 * Adds an entry to the cache.
 *
 * @param {http.ClientResponse} res entry to add to the cache
 * @param {callback} callback
 */
Cache.prototype.response = function (clientResponse) {
    // jshint unused:false
};

/**
 * @param  {callback} callback)
  */
Cache.prototype.close = function (callback) { 
    if (callback) { 
        callback.call(); 
    }
};

module.exports = Cache;
