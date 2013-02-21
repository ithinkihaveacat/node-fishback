/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

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
        // linter doesn't like new Number(...)
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
        return new Date().getTime() < entry.expires;
    }
    
    var headers = parseHeader(req.headers["cache-control"]);

    if ("must-revalidate" in headers) {
        return false;
    } else if ("max-stale" in headers) {
        // TODO Tell the client that the resource is stale, as RFC2616 requires
        return !headers["max-stale"] || ((headers["max-stale"] * 1000) > (new Date().getTime() - entry.expires)); // max-stale > "staleness"
    } else if ("max-age" in headers) {
        return (headers["max-age"] * 1000) > (new Date().getTime() - entry.created); // max-age > "age"
    } else if ("min-fresh" in headers) {
        return (headers["min-fresh"] * 1000) < (entry.expires - new Date().getTime()); // min-fresh < "time until expiry"
    } else {
        return new Date().getTime() < entry.expires;
    }

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

    Cache.call(this);
}

util.inherits(CacheLocal, Cache);

CacheLocal.prototype.find = function (req, callback) {
    var i, entry;

    function send(entry) {
        entry.body.forEach(function (chunk) {
            entry.emit('data', chunk);
        });
        entry.emit('end');
    }

    if ((req.method === 'GET') && this.data[req.url] && wantsCache(req)) {
        for (i = 0; i < this.data[req.url].length; i++) {
            entry = this.data[req.url][i];
            if (isVaryMatch(entry, req) && isFreshEnough(entry, req)) {
                entry.accessed = new Date().getTime();
                entry.count++;
                callback(entry);
                send(entry);
                return;
            }
        }
    }

    if (onlyWantsCache(req)) {
        entry = new (require('events').EventEmitter)();
        entry.statusCode = 504;
        entry.headers = { "x-cache": "MISS" };
        callback(entry);
        entry.emit('end');
        return;
    } else {
        callback(null);
    }
};

CacheLocal.prototype.add = function (res) {
    if ((res.method !== 'GET') || (res.statusCode !== 200) || !canCache(res)) {
        return;
    }
    
    var entry = new (require('events').EventEmitter)();

    entry.method = res.method;
    entry.url = res.url;
    entry.statusCode = res.statusCode;
    entry.body = [];
    entry.expires = expiresAt(res);
    entry.created = new Date().getTime();
    entry.accesed = new Date().getTime();
    entry.count = 1;

    // Have to manually copy headers, otherwise we share it with res
    entry.headers = {};
    Object.keys(res.headers).forEach(function (k) {
        entry.headers[k] = res.headers[k];
    });
    entry.headers["x-cache"] = "HIT";

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

function Proxy(cache, client) {
    cache = cache || new CacheLocal();
    client = client || new Client();

    var reqFilter = this.reqFilter = [];
    var resFilter = this.resFilter = [];

    require('http').Server.call(this);

    this.on('request', function (req1, res1) {

        function responseProxy(src, dst) {
            dst.url = src.url;
            dst.method = src.method;
            dst.writeHead(src.statusCode, src.headers);
            src.on('data', function (chunk) {
                dst.write(chunk);
            });
            src.on('end', function () {
                dst.end();
            });
            src.on('error', function () {
                dst.end();
            });
        }

        reqFilter.forEach(function (fn) {
            fn(req1);
        });

        if (req1.method === 'GET') {
            req1.on('end', function () {
                req1.complete = true;
                cache.find(req1, function (res2) {
                    if (res2) {
                        responseProxy(res2, res1);
                    } else {
                        client.find(req1, function (res2) {
                            resFilter.forEach(function (fn) {
                                fn(res2);
                            });
                            cache.add(res2); // @TODO unless no-store in req
                            responseProxy(res2, res1);
                        });
                    }
                });
            });
        } else {
            req1.complete = false;
            client.find(req1, function (res2) {
                responseProxy(res2, res1);
            });
        }

    });

}

util.inherits(Proxy, require('http').Server);

function Client(backend_host, backend_port, http) {
    this.backend_host = backend_host;
    this.backend_port = backend_port;
    this.http = http || require('http');
}

Client.prototype.find = function (req1, callback) {

    function requestProxy(src, dst) {
        src.on('data', function (chunk) {
            dst.write(chunk);
        });
        src.on('end', function () {
            dst.end();
        });
        src.on('error', function () {
            dst.end();
        });
    }
    
    var tmp = require('url').parse(req1.url);

    var options = {
        "host": this.backend_host,
        "port": this.backend_port,
        "path": tmp.pathname + (tmp.search ? tmp.search : ''),
        "method": req1.method,
        "headers": req1.headers
    };

    var req2 = this.http.request(options, function (res) {
        res.url = req1.url;
        res.method = req1.method;
        res.headers["x-cache"] = "MISS";
        callback(res);
    });

    if (req1.complete) { 
        req2.end(); // not going to get an 'end' event, don't wait up for it
    } else {
        requestProxy(req1, req2);
    }

};

exports.createServer = function (backend_host, backend_port, cache) {
    var proxy = new Proxy(cache, new Client(backend_host, backend_port));
    proxy.createServer();
    return proxy;
};

exports.setVerbose = function (v) {
    VERBOSE = v;
};

[parseHeader, wantsCache, canCache, onlyWantsCache, isVaryMatch, isFreshEnough, expiresAt, CacheLocal, CacheMongoDB, Proxy].forEach(function (fn) {
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
