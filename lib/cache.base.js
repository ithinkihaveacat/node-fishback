/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

function Cache() {
}

Cache.prototype.find = function (req, callback) { 
    // jshint unused:false
};

/**
 * Adds an entry to the cache.
 *
 * @param {http.ClientResponse} res entry to add to the cache
 * @param {callback} callback
 */
Cache.prototype.add = function (res) { 
    // jshint unused:false
};

/**
 * @param  {callback} callback)
  */
Cache.prototype.close = function (callback) { 
    if (callback) { 
        callback(); 
    }
};

module.exports = Cache;
