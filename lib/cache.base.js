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
