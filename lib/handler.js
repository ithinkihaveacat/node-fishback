/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

function Handler() {
}

require('util').inherits(Handler, require('events').EventEmitter);

/**
 * Handles http.Server's 'request' event.
 * 
 * @param  {http.ServerRequest} serverRequest  [description]
 * @param  {http.ServerResponse} serverResponse [description]
 */
Handler.prototype.request = function (serverRequest, serverResponse) { 
    // jshint unused:false
};

/**
 * Adds an entry to the cache.
 *
 * @param {http.ClientResponse} res entry to add to the cache
 */
Handler.prototype.response = function (clientResponse) {
    // jshint unused:false
};

/**
 * Closes the underlying memcached connection, etc.
 * 
 * @param  {callback} callback)
 */
Handler.prototype.close = function (callback) { 
    if (callback) { 
        callback.call(); 
    }
};

module.exports = Handler;
