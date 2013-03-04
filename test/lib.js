/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var SERVER_PORT = 9080;
var PROXY_PORT = SERVER_PORT + 1;

var assert = require("assert");
var util = require("util");
var events = require("events");
var fishback = require("../lib/fishback");

/**
 * Asynchronous map function.  For each element of arr, fn(element, callback) is
 * called, where callback receives the result.  Note that the individual "maps"
 * are performed sequentially; the result, however, is delivered to a callback,
 * instead of being returned, and the maps can be asynchronous.
 *
 * Example:
 * 
 *   function aadd(i, callback) {
 *       callback(i + 1);
 *   }
 *
 *   amap([ 2, 3, 4 ], aadd, console.log);
 *   // -> [ 3, 4, 5 ]
 *
 * @param arr the array over which 
 * @param fn function of the form function(n, callback)
 * @param callback function of the form function(arr)
 */

function amap(arr, fn, callback) {

    // https://gist.github.com/846521

    process.nextTick(function () {
        if (arr.length === 0) {
            callback([]);
        } else {
            fn(arr[0], function (v) {
                amap(arr.slice(1), fn, function (list) {
                    callback([v].concat(list));
                });
            });
        }
    });

}

/**
 * Passed array of async functions (i.e. whose last argument is a callback), and calls
 * them in order.
 *
 * Example:
 *
 *   step([
 *       function (i, callback) {
 *           console.log("got ", i);
 *           callback(null, 7);
 *       },
 *       function (i, callback) {
 *           console.log("got ", i);
 *           callback();
 *       }
 *   ], null, 6);
 *   // -> got 6
 *   // -> got 7
 *
 * @param tasks array of functions with arguments ([arg]..., callback); callback has arguments (err, arg...)
 * @param [optional] errback called if any of the tasks returns an error
 * @param [optional] arg... arguments to the first task
 */

// Libraries that do similar things:
//
// https://github.com/creationix/step
// https://github.com/caolan/async

function step(tasks, errback) {
    
    if (tasks && tasks[0]) {
        var args = Array.prototype.slice.call(arguments, 2);
        // Empty the event queue, to ensure isolation between steps
        process.nextTick(function () {
            tasks[0].apply(null, args.concat(function () { // Note: exception thrown if tasks[0] not a function
                var args = Array.prototype.slice.call(arguments);
                if (args[0] && errback) {
                    errback(args[0]); // error returned, abort tasks (Note: exception thrown if errback not a function)
                } else {
                    step.apply(null, [tasks.slice(1)].concat(errback, args.slice(1)));
                }
            }));
        });
    }

}

function ServerRequest(entry) {
    this.url = entry.url;
    this.method = entry.method || 'GET';
    this.headers = entry.headers || { };
    this.body = entry.body || [ ];
}

util.inherits(ServerRequest, events.EventEmitter);

ServerRequest.prototype.fire = function () {
    var emit = this.emit.bind(this);
    this.body.forEach(function (chunk) {
        emit('data', chunk);
    });
    emit('end');
};

ServerRequest.prototype.noReject = function () {
    this.on('reject', function () {
        assert.true(false, "Unexpected reject event");
    });
};

function ServerResponse() {
    this.statusCode = 200;
    this.method = 'GET';
    this.headers = { };
    this.data = [ ];
}

util.inherits(ServerResponse, events.EventEmitter);

ServerResponse.prototype.noEnd = function () {
    this.on('end', function () {
        assert.true(false, "Unexpected end event");
    });
};

ServerResponse.prototype.writeHead = function (statusCode, headers) {
    this.statusCode = statusCode;
    var h = this.headers;
    Object.keys(headers).forEach(function (k) {
        h[k] = headers[k];
    });
};

ServerResponse.prototype.setHeader = function (header, value) {
    this.headers[header] = value;
};

ServerResponse.prototype.getHeader = function (header) {
    return this.headers[header];
};

ServerResponse.prototype.write = function (chunk) {
    this.data += chunk;
};

ServerResponse.prototype.end = function () {
    this.emit('end');
};    

function ClientRequest() {
}

util.inherits(ClientRequest, events.EventEmitter);

ClientRequest.prototype.end = function () {
};

function ClientResponse(entry) {
    this.url = entry.url;
    this.method = entry.method;
    this.statusCode = entry.statusCode || 200;
    var headers = { };
    Object.keys(entry.headers).forEach(function (k) {
        headers[k] = entry.headers[k];
    });
    this.headers = headers;
    this.data = entry.data || [ ];
}

util.inherits(ClientResponse, events.EventEmitter);

ClientResponse.prototype.fire = function () {
    var emit = this.emit.bind(this);
    this.data.forEach(function (chunk) {
        emit('data', chunk);
    });
    emit('end');
};

exports.http = {
    ServerRequest: ServerRequest,
    ServerResponse: ServerResponse,
    ClientRequest: ClientRequest,
    ClientResponse: ClientResponse
};

/**
 * Returns a function that, when called n times, in turn calls callback.
 * 
 * @param  {int}      n        
 * @param  {Function} callback
 * @return {Function}         
 */
function knock(n, callback) {
    if (n <= 0) {
        callback();
        return function () { };
    } else {
        return function () {
            if (--n === 0) {
                callback();
            }
        };
    }
}

/**
 * @param  {object}   req
 * @param  {Function} callback
 */
function group(req, callback) {
    var res = { };
    Object.keys(req).forEach(function (k) {
        req[k](function () {
            var args = Array.prototype.slice.call(arguments);
            res[k] = args.length === 1 ? args[0] : args;
            if (Object.keys(res).length === Object.keys(req).length) {
                callback(res);
            }
        });
    });
}

/**
 * Convenience function for checking whether expected matches actual.
 * actual can contain headers not present in expected, but the reverse
 * is not true.
 * 
 * @param  {object} actual
 * @param  {object} expected
 * @return {boolean}
 */
function responseEqual(actual, expected) {
    Object.keys(expected.headers).forEach(function (k) {
        assert.equal(actual.headers[k], expected.headers[k]);
    });
    assert.equal(actual.body, expected.body);
}

function getCacheMemory(callback) {
    callback(new fishback.CacheMemory());
}

function getCacheMemcached(callback) {
    callback(new fishback.CacheMemcached());
}

function getCacheMongoDb(callback) {
    // console.log("callback = ", callback);
    var uri = process.env.MONGOLAB_URI || 
      process.env.MONGOHQ_URL || 
      'mongodb://localhost:27017/fishback'; 

    var collname = "test" + (Math.random() + Math.pow(10, -9)).toString().substr(2, 8);

    require('mongodb').MongoClient.connect(uri, function (err, client) {

        if (err) { console.error(err); return; }

        function createCollection() {
            client.createCollection(collname, { capped: true, size: 10000 }, function (err, coll) {
                if (err) { console.error(err); return; }
                // @TODO http://mongodb.github.com/node-mongodb-native/api-generated/db.html#ensureindex
                callback(new fishback.CacheMongoDb(coll));
            });
        }

        client.collectionNames(collname, function (err, coll) {
            if (err) { console.error(err); return; }
            if (coll.length) {
                client.dropCollection(collname, function (err) {
                    if (err) { console.error(err); console.log("got error in drop"); return; }
                    createCollection();
                });
            } else {
                createCollection();
            }
        });

    });
}

[knock, group, amap, step, responseEqual, getCacheMemory, getCacheMongoDb, getCacheMemcached].forEach(function (fn) {
    exports[fn.name] = fn;
});

exports.SERVER_PORT = SERVER_PORT;
exports.PROXY_PORT = PROXY_PORT;
