/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var http = require('http');
var url = require('url');
var util = require('util');

var VERBOSE = true;

/**
 * Returns a closure that, when called, returns the number of seconds
 * since the timer() function was itself called.
 */

function timer(digits)
{
    var t0 = new Date().getTime();

    return function () {
        var t1 = new Date().getTime();
        // jshint doesn't like new Number(...)
        return Number.prototype.toFixed.call((t1 - t0) / 1000, digits || 3);
    };
}

function parseHeader(header)
{
    return !header.trim() ? {} : header.trim().split(/\s*,\s*/).sort().reduce(function (p, c) {
        var t = c.split(/\s*=\s*/, 2);
        p[t[0].toLowerCase()] = t[1];
        return p;
    }, {});
}


function expiresAt(res)
{
    if (!("expires" in res.headers) && !("cache-control" in res.headers)) {
        return new Date().getTime();
    }
    
    if (res.headers["cache-control"]) {
        var headers = parseHeader(res.headers["cache-control"]);
        if (headers["s-maxage"]) {
            return new Date().getTime() + (headers["s-maxage"] * 1000);
        } else if (headers["max-age"]) {
            return new Date().getTime() + (headers["max-age"] * 1000);
        }
    }
    
    if (res.headers.expires) {
        return Date.parse(res.headers.expires);
    }
    
    return null;
}

function canCache(res)
{
    if (!("cache-control" in res.headers)) {
        return false;
    }
    
    var headers = parseHeader(res.headers["cache-control"]);

    return !("must-revalidate" in headers) && (("public" in headers) || ("max-age" in headers));
}

// http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.3

// true if the candidate reponse satisfies the request in terms
// of freshness, otherwise false.

function isFreshEnough(entry, req)
{
    // If no cache-control header in request, then entry is fresh
    // if it hasn't expired.
    if (!("cache-control" in req.headers)) {
        return entry.expires > new Date().getTime();
    }
    
    var headers = parseHeader(req.headers["cache-control"]);

    var flag = true;
    
    if (("max-stale" in headers) && entry.expires) {
        // TODO Tell the client that the resource is stale, as RFC2616 requires
        flag &= (headers["max-stale"] * 1000) > (new Date().getTime() - entry.expires); // max-stale > "staleness"
    }
    
    if (("max-age" in headers) && entry.created) {
        flag &= (headers["max-age"] * 1000) > (new Date().getTime() - entry.created); // max-age > "age"
    }
    
    if (("min-fresh" in headers) && entry.expires) {
        flag &= (headers["min-fresh"] * 1000) < (entry.expires - new Date().getTime()); // min-fresh < "time until expiry"
    }
    
    return flag;
}

function wantsCache(req)
{
    return !("cache-control" in req.headers) || 
           (req.headers["cache-control"].indexOf("no-cache") === -1) || 
           !("no-cache" in parseHeader(req.headers["cache-control"])); 
}

// http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.4
function onlyWantsCache(req)
{
    return ("cache-control" in req.headers) &&
           ("only-if-cached" in parseHeader(req.headers["cache-control"]));
}

function isVaryMatch(entry, req)
{
    if (!("vary" in entry.headers)) {
        return true;
    }
    
    if (entry.headers.vary === "*") {
        return false;
    }
    
    return entry.headers.vary.split(/\s*,\s/).every(function (h) {
        return req.headers[h] === entry.headers[h];
    });
}

function Cache() {
}

/**
 * Search for entries satisfying req in the cache.  If found, cacheHit() is 
 * called with a cache entry (an object) as the sole argument.  If not found,
 * cacheMiss() is called with a callback expecting to be passed an http.ClientResponse
 * as the sole argument.
 *
 * @param {http.ServerRequest} req
 * @param {function (entry) {}} cacheHit
 * @param {function (http.ClientResponse)} cacheMiss
 */
Cache.prototype.find = function (req, cacheHit, cacheMiss) { 
  // jshint unused:false
};

/**
 * Adds an entry to the cache.
 *
 * @param {http.ClientResponse} res entry to add to the cache
 * @param {callback} callback
 */
Cache.prototype.add = function (res, callback) { 
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

function CacheMongoDB(client) {
    this.client = client;
}

util.inherits(CacheMongoDB, Cache);

CacheMongoDB.prototype.find = function (req, cacheHit, cacheMiss) {

    var that = this;

    if (req.method === 'GET' && wantsCache(req)) {
        this.client.findOne({ _id: req.url }, (function (err, doc) {
            var entry, i;
            if (err) { 
                return; 
            }
            if (doc) {
                for (i = 0; i < doc.entries.length; i++) {
                    entry = doc.entries[i];
                    if (isVaryMatch(entry, req) && isFreshEnough(entry, req)) {
                        cacheHit(entry);
                        return;
                    }
                }
                cacheMiss(this.add.bind(this)); 
            } else {
                cacheMiss(that.add.bind(that)); 
            }                
        }).bind(this));
    } else {
        cacheMiss(this.add.bind(this));
    }

};

CacheMongoDB.prototype.add = function (res, callback) {

    if ((res.method !== 'GET') || (res.statusCode !== 200) || !canCache(res)) {
        return;
    }
    
    var entry = {
        headers: res.headers,
        body: [], // appended to below, as we receive data
        expires: expiresAt(res),
        created: new Date().getTime()
    };

    res.on('data', function (chunk) {
        // Treat as an array and append rather than concatenate strings--if treating
        // as strings, run into encoding issues.  Also, this way the client gets
        // exactly the same size chunks as the proxy does, which seems like a
        // nice thing to do.
        entry.body.push(chunk);
    });

    res.on('end', (function () {

        this.client.update({
            _id: res.url
        }, {
            $push: {
                entries: entry
            }
        }, callback);
        
    }).bind(this));

};

function CacheLocal(maxSize) {
    this.data = {}; // hash of cache entries, keyed on URL for efficient lookup
    this.list = []; // array of cache entries, for efficient random access (useful for cache cleaning)
    this.maxSize = maxSize || 2000;
}

util.inherits(CacheLocal, Cache);

CacheLocal.prototype.find = function (req, cacheHit, cacheMiss) {
    var i, entry;
    
    if ((req.method === 'GET') && this.data[req.url] && wantsCache(req)) {
        
        for (i = 0; i < this.data[req.url].length; i++) {
            
            entry = this.data[req.url][i];
            
            if (isVaryMatch(entry, req) && isFreshEnough(entry, req)) {
                entry.accessed = new Date().getTime();
                entry.count++;
                cacheHit(entry);
                return;
            }
            
        }
    }
    
    cacheMiss(this.add.bind(this));
    
};

CacheLocal.prototype.add = function (res, callback)
{
    
    if ((res.method !== 'GET') || (res.statusCode !== 200) || !canCache(res)) {
        return;
    }
    
    var entry = {
        url: res.url,
        statusCode: res.statusCode,
        headers: res.headers,
        body: [], // appended to below, as we receive data
        expires: expiresAt(res),
        created: new Date().getTime(),
        accessed: new Date().getTime(),
        count: 1
    };

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

        callback();
        
    }).bind(this));

};

/**
 * Trims the cache to be less than or equal to this.maxSize entries.
 */

CacheLocal.prototype.clean = function () {
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

// For debugging/stats: returns information about the entries in the list cache.

CacheLocal.prototype.dumpList = function () {
    return this.list.map(function (entry) {
        return {
            statusCode: entry.statusCode,
            url: entry.url,
            created:  new Date(entry.created).toString(),
            accessed: new Date(entry.accessed).toString(),
            expires:  new Date(entry.expires).toString(),
            count: entry.count
        };
    });
};

// For debugging/stats: returns information about the entries in the hash cache.

CacheLocal.prototype.dumpData = function () {
    return Object.keys(this.data).reduce((function (acc, cur) {
        acc[cur] = this.data[cur].map(function (entry) {
            return {
                statusCode: entry.statusCode,
                created:  new Date(entry.created).toString(),
                accessed: new Date(entry.accessed).toString(),
                expires:  new Date(entry.expires).toString(),
                count: entry.count
            };
        });
        return acc;
    }).bind(this), {});
};

function Proxy(cache, backend_host, backend_port) {
    this.cache = cache || new CacheLocal();
    this.backend_host = backend_host || '0.0.0.0';
    this.backend_port = backend_port || '9080';

    this.resFilter = [];
    this.reqFilter = [];

    this.server = http.createServer((function (req1, res1) {
        
        // Add some properties to res1 to normalise the
        // request and response somewhat.
        
        res1.url = req1.url;
        res1.method = req1.method;
        
        var t = timer();
        
        var request = this.request(req1, t); // callback; when called, does a real request

        var respondFromCache   = this.respondFromCache(res1, t);   // callback; when passed object,  pushes data through res1
        var respondFromEmitter = this.respondFromEmitter(res1, t); // callback; when passed emitter, pushes data through res1
        
        var cacheHit = function (entry) {
            respondFromCache(entry);
        };
        
        var cacheMiss = function (addToCache) {
            if (onlyWantsCache(req1)) {
                respondFromCache({ statusCode: "504", headers: {} });
                request([ addToCache ]);
            } else {
                request([ respondFromEmitter, addToCache ]);
            }
        };
        
        this.cache.find(req1, cacheHit, cacheMiss);

    }).bind(this));
}

Proxy.prototype.addResFilter = function (fn) {
    this.resFilter.push(fn);
};

Proxy.prototype.addReqFilter = function (fn) {
    this.reqFilter.push(fn);
};

/**
 * Returns a function that, when called with an object, pumps
 * data into the res1 response object.
 *
 * @param {http.ServerResponse} res1 response object, to which data is piped
 * @return {function (res) {}} res is an object representing a cache entry
 */

Proxy.prototype.respondFromCache = function (res1) {
    return (function (res2) {
        res2.headers["x-cache"] = "HIT";
        res1.writeHead(res2.statusCode, res2.headers);
        if (res2.body) { // there's not always a body (e.g. 504 response, if no cache)
            res2.body.forEach(function (b) {
                res1.write(b);
            });
        }
        res1.end();
    }).bind(this);
};

/**
* Returns a function that, when called with an http.ClientResponse, pumps
* data into the res1 response object.
*
 * @param {http.ServerResponse} res1 response object, to which data is piped
 * @return {function (res) {}} res is an http.ClientResponse
 */

Proxy.prototype.respondFromEmitter = function (res1)
{
    return (function (res2) {
        res2.headers["x-cache"] = "MISS";
        res1.writeHead(res2.statusCode, res2.headers);
        res2.on('data', function (chunk) {
            res1.write(chunk);
        });
        res2.on('end', (function () {
            res1.end();
        }));
    }).bind(this);
};

/**
 * Returns a function that initiates a request.  This function has a single
 * argument which is an array of functions of a single argument; these 
 * functions are in turn passed an http.ClientResponse.
 *
 * In addition, the request is passed through each element of the 
 * this.reqFilter array, and the response is passed through each element
 * of the this.resFilter array.
 * 
 * @param {http.ServerRequest} req1
 * @param {callback} t when called, emits time since created, in seconds
 * @return {function (callback) {}} callback is an array of functions 
 */

Proxy.prototype.request = function (req1, t)
{
    return (function (callback) {

        this.reqFilter.forEach(function (fn) {
            fn(req1);
        });

        var tmp = url.parse(req1.url);

        var options = {
            "host": tmp.hostname || this.backend_host,
            "port": tmp.port || this.backend_port,
            "path": tmp.pathname + (tmp.search ? tmp.search : ''),
            "method": req1.method,
            "headers": req1.headers
        };

        var req2 = http.request(options, (function (res2) {

            // Add some properties to res2 to normalise the
            // request and response somewhat.

            res2.url = req1.url;
            res2.method = req1.method;

            this.resFilter.forEach(function (fn) { 
                fn(res2);
            });
            callback.forEach(function (fn) {
                fn(res2, t);
            });

        }).bind(this));

        req1.on('data', function (chunk) {
            req2.write(chunk);
        });

        req1.on('end', function () {
            req2.end();
        });
        
        // This can happen if, among other things, the server doesn't return
        // any headers e.g. http://ads.shorttail.net/gifs/.
        req2.on('error', function (e) {
            console.log("ERROR: Couldn't " + req1.method + " " + req1.url + ": " + e.message);
            req2.end();
        });
        
    }).bind(this);
};

Proxy.prototype.listen = function (port, callback) {
    return this.server.listen(port || 8080, callback);
};

Proxy.prototype.close = function (callback) {
    this.server.close(callback);
};

exports.createServer = function (cache, backend_host, backend_port) {
    return new Proxy(cache, backend_host, backend_port);
};

exports.setVerbose = function (v) {
    VERBOSE = v;
};

[parseHeader, wantsCache, canCache, onlyWantsCache, isVaryMatch, isFreshEnough, expiresAt, CacheLocal, CacheMongoDB].forEach(function (fn) {
    exports[fn.name] = fn;
});

// Useful for testing:

/*

function fetch {
  http_proxy=http://localhost:8080/ wget -q -S -O - $1 > /dev/null
}

alias fetch1="fetch http://farm4.static.flickr.com/3018/3015967651_7aa409dcc7_t.jpg"
alias fetch2="fetch http://farm4.static.flickr.com/3193/2908727439_5a5e1b602e_t.jpg"
alias fetch3="fetch http://farm4.static.flickr.com/3206/3016791220_279bb60cb3_t.jpg"
alias fetch4="fetch http://farm4.static.flickr.com/3282/3015960965_f9d9588e3b_t.jpg"
alias fetch5="fetch http://farm4.static.flickr.com/3074/2911591297_9c3b3ca1ca_t.jpg"

*/
