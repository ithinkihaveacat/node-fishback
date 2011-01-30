var http = require('http');
var sys = require('sys');
var url = require('url');

/**
 * Returns a closure that, when called, returns the number of seconds
 * since the time() function was itself called.
 */

function timer(digits)
{
    var t0 = new Date().getTime();

    return function() {
        var t1 = new Date().getTime();
        return new Number((t1 - t0) / 1000).toFixed(digits || 2);
    }
}

function parseHeader(header)
{
    return !header ? {} : header.split(/\s*,\s*/).sort().reduce(function (p, c) {
        var t = c.split(/\s*=\s*/, 2);
        p[t[0].toLowerCase()] = t[1];
        return p;
    }, {});
}


/*
now = 1295222561275;
Date.prototype.getTime = function() { return now; };
rs = { };
console.log(rs, expiresAt(rs)); // null
rs = { expires: "Thu, 01 Dec 1994 16:00:00 GMT" };
console.log(rs, expiresAt(rs)); // 786297600000
rs = { "cache-control": "max-age=60" };
console.log(rs, expiresAt(rs)); // 1295222621275
*/

function expiresAt(res)
{
    if (!("expires" in res.headers) && !("cache-control" in res.headers)) {
        return new Date().getTime();
    }
    
    if (res.headers["cache-control"]) {
        var headers = parseHeader(res.headers["cache-control"]);
        if (headers["s-maxage"]) {
            return new Data().getTime() + (headers["s-maxage"] * 1000);
        } else if (headers["max-age"]) {
            return new Date().getTime() + (headers["max-age"] * 1000);
        }
    }
    
    if (res.headers["expires"]) {
        return Date.parse(res.headers["expires"]);
    }
    
    return null;
}

function Cache(maxSize) {
    this.data = { };
    this.list = [ ];
    this.maxSize = maxSize || 500;
}

Cache.prototype.find = function(req, cacheHit, cacheMiss)
{
    var i, entry;
    
    if ((req.method == 'GET') && this.data[req.url] && wantsCache(req)) {
        // At the end of this ugly loop, entry is either the first matching cache entry
        // or null.  (We really want entry = this.data[req.url].first(...).)
        for (i = 0; i < this.data[req.url].length; i++) {
            entry = this.data[req.url][i];
            if (isVaryMatch(entry, req) && isFreshEnough(entry, req)) {
                break;
            }
            entry = null;
        }
    }
    
    if (entry) {
        entry.accessed = new Date().getTime();
        entry.count++;
        return cacheHit(entry);
    }
    
    if (onlyWantsCache(req)) {
        entry = {
            statusCode: "504",
            headers: { }
        };
        return cacheHit(entry);
    } else {
        return cacheMiss((function (res, t) { 
            return this.add(res, t);
        }).bind(this));
    }
    
};

Cache.prototype.add = function(res, t)
{
    
    if ((res.method != 'GET') || (res.statusCode != 200) || !canCache(res)) {
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
        entry.body.push(chunk);
    });

    res.on('end', (function() {

        if (!this.data[res.url]) {
            this.data[res.url] = [ entry ];
        } else {
            this.data[res.url].push(entry);
        }

        this.list.push(entry);
        
        this.clean();
        
        console.log(res.method + " " + res.url.substr(0, 80) + " (saved " + entry.statusCode + "; " + t() + " seconds)");
        
//        console.log(this.dumpList());
//        console.log(this.dumpData());

    }).bind(this));

};

Cache.prototype.clean = function()
{
    if ((this.list.length == 0) || (this.list.length <= this.maxSize)) {
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
            if (this.data[entry.url].length == 0) {
                delete this.data[entry.url];
            }
            break;
        }
    }
}

Cache.prototype.dumpList = function()
{
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
}

Cache.prototype.dumpData = function()
{
    return Object.keys(this.data).reduce((function (acc, cur) {
        acc[cur] = this.data[cur].map(function (entry) {
            return {
                statusCode: entry.statusCode,
                created:  new Date(entry.created).toString(),
                accessed: new Date(entry.accessed).toString(),
                expires:  new Date(entry.expires).toString(),
                count: entry.count
            }
        });
        return acc;
    }).bind(this), { });
}

/*
rs = { };
console.log(rs, canCache(rs)); // false
rs = { "cache-control": "public" };
console.log(rs, canCache(rs)); // true
rs = { "cache-control": "s-maxage=7773, public, foo=bar" };
console.log(rs, canCache(rs)); // true
rs = { "cache-control": "s-maxage=7773, private, foo=bar" };
console.log(rs, canCache(rs)); // true
rs = { "cache-control": "s-maxage=7773, qqq=public, foo=bar" };
console.log(rs, canCache(rs)); // false
rs = { "expires": "Tue, 17 Jan 2012 00:49:02 GMT", "cache-control": "public, max-age=31536000" };
console.log(rs, canCache(rs)); // true
*/

// Accept "private" as well as "public" on the theory that
// there's really only one user of the proxy.  If the origin
// server responsds with must-revalidate, we don't cache
// the content.  (Suboptimal, but needed for compliance.
// Probably very rare.)

function canCache(res)
{
    if (!("cache-control" in res.headers)) {
        return false;
    }
    
    /*
    
    if ((res.headers["cache-control"].indexOf("public")  == -1) &&
        (res.headers["cache-control"].indexOf("private") == -1) &&
        (res.headers["cache-control"].indexOf("max-age") == -1)) {
        return false;
    }
    
    */
    
    var headers = parseHeader(res.headers["cache-control"]);
    
    return !("must-revalidate" in headers) && (("public" in headers) || ("private" in headers) || ("max-age" in headers));
}


/*
now = 1295222561275;
Date.prototype.getTime = function() { return now; };
res = { created: now - (180*1000), expires: now + (180*1000) };
rq = { "cache-control": "max-age=120" };
console.log(res, rq, isFreshEnough(res, rq)); // false
res = { created: now, expires: now + (180*1000) };
rq = { "cache-control": "max-age=120" };
console.log(res, rq, isFreshEnough(res, rq)); // true
res = { created: 0, expires: now - (60*1000) };
rq = { "cache-control": "max-stale=120" };
console.log(res, rq, isFreshEnough(res, rq)); // true
res = { created: 0, expires: now - (60*1000) };
rq = { "cache-control": "max-stale=30" };
console.log(res, rq, isFreshEnough(res, rq)); // false
res = { created: 0, expires: now + (60*1000) };
rq = { "cache-control": "min-fresh=30" };
console.log(res, rq, isFreshEnough(res, rq)); // true
res = { created: 0, expires: now + (60*1000) };
rq = { "cache-control": "min-fresh=120" };
console.log(res, rq, isFreshEnough(res, rq)); // false
*/

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
        // TODO RFC2616 says we MUST tell the client that the resource is stale 
        flag &= (headers["max-stale"] * 1000) > (new Date().getTime() - entry.expires); // max-stale > "staleness"
    }
    
    if (("max-age" in headers) && entry.created) {
        flag &= (headers["max-age"] * 1000) > (new Date().getTime() - entry.created); // max-age > "age"
    }
    
    if (("min-fresh" in headers) && entry.expires) {
        flag &= (headers["min-fresh"] * 1000) < (entry.expires - new Date().getTime()); // min-fresh < "time until expiry"
    }
    
    return flag;
};

/*
h = { };
console.log(h, wantsCache(h)); // true
h = { "cache-control": "jjjj", "foo": "no-cache" };
console.log(h, wantsCache(h)); // true
h = { "cache-control": "no-cachejjj,foo=no-cache" };
console.log(h, wantsCache(h)); // true
h = { "cache-control": "no-cachejjj,foo=no-cache, no-cache", "foo": "bar" };
console.log(h, wantsCache(h)); // false
*/

function wantsCache(req)
{
    return !("cache-control" in req.headers) || 
           (req.headers["cache-control"].indexOf("no-cache") == -1) || 
           !("no-cache" in parseHeader(req.headers["cache-control"])); 
};

// http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.4
function onlyWantsCache(req)
{
    return ("cache-control" in req.headers) &&
           ("only-if-cached" in parseHeader(req.headers["cache-control"]));
}

/*
rs = { "foo": "bar" };
rq = { };
console.log(rs, rq, isVaryMatch(rs, rq)); // true
rs = { "foo": "bar", "vary": "*" };
rq = { };
console.log(rs, rq, isVaryMatch(rs, rq)); // false
rs = { "foo": "bar", "vary": "quux" };
rq = { };
console.log(rs, rq, isVaryMatch(rs, rq)); // true
rs = { "foo": "bar", "vary": "foo" };
rq = { };
console.log(rs, rq, isVaryMatch(rs, rq)); // false
rs = { "foo": "bar", "vary": "foo" };
rq = { "foo": "bar" };
console.log(rs, rq, isVaryMatch(rs, rq)); // true
*/

function isVaryMatch(entry, req)
{
    if (!("vary" in entry.headers)) {
        return true;
    }
    
    if (entry.headers.vary == "*") {
        return false;
    }
    
    return entry.headers.vary.split(/\s*,\s/).every(function (h) {
        return req.headers[h] == entry.headers[h];
    });
}

function Proxy(cache)
{
    this.resFilter = [];
    this.reqFilter = [];
    this.cache = cache || new Cache();
    this.server = http.createServer((function(req1, res1) {
        var t = timer();
        this.cache.find(req1, this.cacheHit(req1, res1, t), this.cacheMiss(req1, res1, t));
    }).bind(this));
}

Proxy.prototype.cacheHit = function(req, res, t) {

    return (function(entry) {
        
        res.writeHead(entry.statusCode, entry.headers);
        if (entry.body) { // there's not always a body (e.g. 504 response, if no cache)
            entry.body.forEach(function (b) {
                res.write(b);
            });
        }
        res.end();
        
        console.log(req.method + " " + req.url.substr(0, 80) + " (cached " + entry.statusCode + "; " + t() + " seconds)");
        
//        console.log(this.dumpList());
//        console.log(this.dumpData());

    }).bind(this);

};

Proxy.prototype.cacheMiss = function(req1, res1, t) {

    return (function(cacheAdd) {
        
        this.reqFilter.forEach(function (f) {
            f(req1);
        });
        
        var tmp = url.parse(req1.url);

        // TODO Error handling: what if we don't have a hostname?

        var options = {
            "host": tmp.hostname,
            "port": tmp.port || 80,
            "path": tmp.pathname + (tmp.search ? tmp.search : ''),
            "method": req1.method,
            "headers": req1.headers
        };

        var req2 = http.request(options, (function(res2) {

            // Add some properties to res2, so that we normalise
            // req and res somewhat.

            res2.url = req1.url;
            res2.method = req1.method;
            
            this.resFilter.forEach(function (f) { 
                f(res2);
            });
            
            res1.writeHead(res2.statusCode, res2.headers);

            res2.on('data', function(chunk) {
                res1.write(chunk);
            });

            res2.on('end', function() {
                res1.end();
                console.log(req1.method + " " + req1.url.substr(0, 80) + " (fetched " + res2.statusCode + "; " + t() + " seconds)");
            });

            cacheAdd(res2, t);

        }).bind(this));

        req1.on('data', function (chunk) {
            req2.write(chunk);
        });

        req1.on('end', function () {
            req2.end();
        });
        
    }).bind(this);

};

Proxy.prototype.addResFilter = function(fn) {
    this.resFilter.push(fn);
};

Proxy.prototype.reqFilter = function(req) {
    this.reqFilter.push(fn);
};

Proxy.prototype.listen = function(port, hostname) {
    port = port || 8080;
    hostname = hostname || "127.0.0.1";
    console.log("Proxy server is running on " + hostname + ":" + port);
    return this.server.listen(port, hostname);
};

exports.createServer = function(cache) {
    return new Proxy(cache);
};

// Useful for testing:

/*

function fetch {
  http_proxy=http://127.0.0.1:8080/ wget -q -S -O - $1 > /dev/null
}

alias fetch1="fetch http://farm4.static.flickr.com/3018/3015967651_7aa409dcc7_t.jpg"
alias fetch2="fetch http://farm4.static.flickr.com/3193/2908727439_5a5e1b602e_t.jpg"
alias fetch3="fetch http://farm4.static.flickr.com/3206/3016791220_279bb60cb3_t.jpg"
alias fetch4="fetch http://farm4.static.flickr.com/3282/3015960965_f9d9588e3b_t.jpg"
alias fetch5="fetch http://farm4.static.flickr.com/3074/2911591297_9c3b3ca1ca_t.jpg"

*/
