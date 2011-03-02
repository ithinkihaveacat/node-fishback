require.paths.unshift("../lib");

var SERVER_PORT = 9080;
var PROXY_PORT = SERVER_PORT + 1;

var assert = require("assert");
var http = require("http");
var fishback = require("fishback");

fishback.setVerbose(false);

/**
 * Asynchronous map function.  For each element of arr, fn(element, callback) is
 * called, where callback receives the result.
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

    if (arr.length == 0) {
        callback([]);
    } else {
        fn(arr[0], function(v) {
            amap(arr.slice(1), fn, function (list) {
                callback([v].concat(list));
            })
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
        tasks[0].apply(null, args.concat(function() { // Note: exception thrown if tasks[0] not a function
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
 * Creates an HTTP server, and a proxy sitting in front of it.  The server
 * returns response for all requests.
 */

function Service(entry, server_port, proxy_port) {

    this.server_port = server_port || SERVER_PORT;
    this.proxy_port  = proxy_port  || PROXY_PORT;

    var headers = Object.keys(entry.headers).map(function (k) {
        return [ k, entry.headers[k] ];
    });

    if (!entry.statusCode) {
        entry.statusCode = 200;
    }

    this.server = http.createServer(function (req, res) {
        res.writeHead(entry.statusCode, headers);
        res.end(entry.body);
    });
    this.server.listen(this.server_port);

    this.proxy = fishback.createServer();
    this.proxy.listen(this.proxy_port);

};

/**
 * Performs a request count times, collecting the results into an
 * array which is then passed to callback.
 * 
 * @param count number of times to perform the request
 * @param callback called when all requests have completed, with an array of the results
 */

Service.prototype.request = function(count, callback) {

    var options = {
        host: '127.0.0.1',
        port: this.proxy_port,
        path: 'http://127.0.0.1:' + this.server_port + '/'
    };

    amap(
        new Array(count), // values not used; this is just to satisfy amap()
        function (i, callback) {
            var actual = { statusCode: null, headers: { }, body: "" };
            http.get(options, function(res) {
                actual.statusCode = res.statusCode;
                actual.headers = res.headers;
                res.on('data', function(chunk) {
                    actual.body += chunk;
                });
                res.on('end', function () {
                   callback(actual);
                });
            });
        },
        callback
    );

};

/**
 * Shuts down (i.e. closes) both the web server and the proxy in front
 * of it.
 */

Service.prototype.shutdown = function() {
    this.server.close();
    this.proxy.close();
};

/**
 * Creates an HTTP server, and a proxy sitting in front of it.  The server
 * returns response for all requests.
 */

exports.createService = function(response, server_port, proxy_port) {
    return new Service(response, server_port, proxy_port);
};

/**
 * Convenience function for checking whether expected matches actual.
 * actual can contain headers not present in expected, but the reverse
 * is not true.
 */

exports.responseEqual = function(actual, expected) {
    Object.keys(expected.headers).forEach(function (k) {
        assert.equal(actual.headers[k], expected.headers[k]);
    });
    assert.equal(actual.body, expected.body);
};

exports.amap = amap;
exports.step = step;