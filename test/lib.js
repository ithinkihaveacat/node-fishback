/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var SERVER_PORT = 9080;
var PROXY_PORT = SERVER_PORT + 1;

var assert = require("assert");
var http = require("http");
var fishback = require("../lib/fishback");

fishback.setVerbose(false);

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

    if (arr.length === 0) {
        callback([]);
    } else {
        fn(arr[0], function (v) {
            amap(arr.slice(1), fn, function (list) {
                callback([v].concat(list));
            });
        });
    }

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
        tasks[0].apply(null, args.concat(function () { // Note: exception thrown if tasks[0] not a function
            var args = Array.prototype.slice.call(arguments);
            if (args[0] && errback) {
                errback(args[0]); // error returned, abort tasks (Note: exception thrown if errback not a function)
            } else {
                step.apply(null, [tasks.slice(1)].concat(errback, args.slice(1)));
            }
        }));
    }

}

/**
 * Performs a request count times, collecting the results into an
 * array which is then passed to callback.
 * 
 * @param count number of times to perform the request
 * @param callback called when all requests have completed, with an array of the
 *     results
 */
function request(count, port, callback) {

    var options = {
        host: '0.0.0.0',
        port: port,
        path: '/'
    };

    amap(
        new Array(count), // values not used; this is just to satisfy amap()
        function (i, callback) {
            var actual = { statusCode: null, headers: { }, body: "" };
            http.get(options, function (res) {
                actual.statusCode = res.statusCode;
                actual.headers = res.headers;
                res.on('data', function (chunk) {
                    actual.body += chunk;
                });
                res.on('end', function () {
                    callback(actual);
                });
            });
        },
        callback
    );

}

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
 * @param {object} entry
 * @param {int} port
 * @param {Function} callback
 */
function getStatic(entry, port, callback) {
    port = port || SERVER_PORT;

    if (!entry.statusCode) {
        entry.statusCode = 200;
    }

    var headers = Object.keys(entry.headers).map(function (k) {
        return [ k, entry.headers[k] ];
    });

    var server = http.createServer(function (req, res) {
        res.writeHead(entry.statusCode, headers);
        res.end(entry.body);
    });

    server.listen(port, function () {
        callback(server);
    });
}

/**
 * Creates an HTTP server, and a proxy sitting in front of it.  The server
 * returns response for all requests.
 */

function Service(cache, entry, callback) {

    this.server_port = SERVER_PORT;
    this.proxy_port  = PROXY_PORT;

    var headers = Object.keys(entry.headers).map(function (k) {
        return [ k, entry.headers[k] ];
    });

    // Kinda ugly hack: listen() doesn't block instead we get a callback when
    // the port is open. Unfortunately, we need to wait until both ports are
    // open (on the proxy server *and* the backend server, so we have this ugly
    // closure that essentially waits to be called twice.

    var block = (function (service) {
        var i = 2;
        return function () {
            if (--i === 0) {
                callback(service);
            }
        };
    })(this);

    if (!entry.statusCode) {
        entry.statusCode = 200;
    }

    this.server = http.createServer(function (req, res) {
        res.writeHead(entry.statusCode, headers);
        res.end(entry.body);
    });
    this.server.listen(this.server_port, block);

    this.proxy = fishback.createServer(cache);
    this.proxy.listen(this.proxy_port, block);

}

/**
 * Shuts down (i.e. closes) both the web server and the proxy in front
 * of it.
 */

Service.prototype.shutdown = function () {
    this.server.close();
    this.proxy.close();
};

/**
 * Creates an HTTP server, and a proxy sitting in front of it.  The server
 * returns response for all requests.
 */

exports.createService = function (cache, response, callback) {
    return new Service(cache, response, callback);
};

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

function getCacheLocal(callback) {
    callback(new fishback.CacheLocal());
}

function getCacheMongoDB(callback) {
    var uri = process.env.MONGOLAB_URI || 
      process.env.MONGOHQ_URL || 
      'mongodb://localhost:27017/fishback'; 

    require('mongodb').MongoClient.connect(uri, function (err, client) {
        if (err) { console.error(err); return; }
        client.createCollection("cache", { capped: true, size: 10000 }, function (err, coll) {
            if (err) { console.error(err); return; }
            callback(new fishback.CacheMongoDB(coll));
        });
    });
}

function getMockClient(response) {
    return {
        find: function(req, callback) {
            var entry = new (require('events').EventEmitter)();
            entry.url = req.url;
            entry.method = req.method;
            entry.headers = response.headers;
            entry.headers["x-cache"] = "MISS";
            entry.statusCode = req.url === "/404" ? 404 : 200;
            callback(entry);
            entry.emit('data', response.body);
            entry.emit('end');
        }
    };
}

[knock, group, amap, step, request, responseEqual, getMockClient, getStatic, getCacheLocal, getCacheMongoDB].forEach(function (fn) {
    exports[fn.name] = fn;
});

exports.SERVER_PORT = SERVER_PORT;
exports.PROXY_PORT = PROXY_PORT;
