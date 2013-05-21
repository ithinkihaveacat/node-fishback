/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

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

function getCacheMemory(callback) {
    callback(new fishback.Memory());
}

function getCacheMemcached(callback) {
    var client = require('memjs').Client.create();
    client.flush(function () {
        callback(new fishback.Memcached(client));
    });
}

function getCacheMongoDb(callback) {
    var uri = process.env.MONGOLAB_URI || 
      process.env.MONGOHQ_URL || 
      'mongodb://localhost:27017/fishback'; 

    var collname = "test" + (Math.random() + Math.pow(10, -9)).toString().substr(2, 8);

    require('mongodb').MongoClient.connect(uri, function (err, client) {

        if (err) { console.error(err); return; }

        function createCollection() {
            client.createCollection(collname, { capped: true, size: 10000 }, function (err, coll) {
                if (err) { console.error(err); return; }
                // @TODO Add index to url
                // http://mongodb.github.com/node-mongodb-native/api-generated/db.html#ensureindex
                callback(new fishback.MongoDb(coll));
            });
        }

        client.collectionNames(collname, function (err, coll) {
            if (err) { console.error(err); return; }
            if (coll.length) {
                client.dropCollection(collname, function (err) {
                    if (err) { console.error(err); return; }
                    createCollection();
                });
            } else {
                createCollection();
            }
        });

    });
}

function getCacheList(callback) {

    function _getCacheList(list) {
        var head = list[0];
        var tail = list.slice(1);
        if (head) {
            head(function (cache) {
                callback(cache, _getCacheList.bind(null, tail));
            });
        }
    }

    _getCacheList([ getCacheMemory, getCacheMemcached ]);
}

[knock, group, amap, step, getCacheList, getCacheMemory, getCacheMongoDb, getCacheMemcached].forEach(function (fn) {
    exports[fn.name] = fn;
});
