var http = require('http');
var sys = require('sys');
var url = require('url');

/**
 * Returns a closure that, when called, returns the number of seconds
 * since the function was originally called.
 */

function timer(digits)
{
    var t0 = new Date().getTime();

    return function() {
        var t1 = new Date().getTime();
        return new Number((t1 - t0) / 1000).toFixed(digits ? digits : 2);
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
        return null;
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

function Cache() {
    this.data = { };
    this.list = [ ];
}

Cache.prototype.find = function(req, cacheHit, cacheMiss)
{
    var i, entry;
    
    if ((req.method == 'GET') && this.data[req.url] && wantsCache(req)) {
        for (i = 0; i < this.data[req.url].length; i++) {
            entry = this.data[req.url][i];
            if (isVaryMatch(entry, req) && isFreshEnough(entry, req)) {
                break;
            }
        }
    }
    
    if (entry) {
        return cacheHit(entry);
    }
    
    if (onlyWantsCache(req)) {
        entry = {
            statusCode: "504",
            headers: []
        };
        return cacheHit(entry);
    } else {
        return cacheMiss(this);
    }
    
};

Cache.prototype.add = function(res, t)
{
    
    if ((res.method != 'GET') || !canCache(res)) {
        return;
    }
    
    var id = Math.floor(Math.random() * 4294967296).toString(16);

    var entry = {
        id: id,
        statusCode: res.statusCode,
        headers: res.headers,
        body: '', // appended to below, as we receive data
        expires: expiresAt(res),
        created: new Date().getTime(),
        accessed: new Date().getTime()
    };

    res.on('data', function (chunk) {
        entry.body += chunk;
    });

    res.on('end', function() {

        if (!this.data[res.url]) {
            this.data[res.url] = [ entry ];
        } else {
            this.data[res.url].push(entry);
        }

        this.list.push({ url: res.url, id: entry.id, expires: entry.expires });

        console.log(res.method + " " + res.url + " (saved; " + t() + " seconds)");

    }.bind(this));

};

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

function isFreshEnough(entry, req)
{
    if (!("cache-control" in req.headers)) {
        return true;
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

function cacheHit(req, res, t)
{
    return function(entry) {
        res.writeHead(entry.statusCode, entry.headers);
        if (entry.body) {
            res.write(entry.body);
        }
        res.end();
        
        console.log(req.method + " " + req.url + " (cached; " + t() + " seconds)");
    }
}

function cacheMiss(req1, res1, t)
{
    return function(cache) {
        
        var tmp = url.parse(req1.url);
        if (!tmp.port) { 
            tmp.port = 80; // set default port; parse() doesn't do this for us
        }

        // TODO Error handling: what if we don't have a hostname?

        var options = {
            "host": tmp.hostname,
            "port": tmp.port,
            "path": tmp.pathname + (tmp.search ? tmp.search : ''),
            "method": req1.method
        };

        var req2 = http.request(options, function(res2) {

            // Add some properties to res2, so that we normalise
            // res1 and res2 somewhat.

            res2.url = req1.url;
            res2.method = req1.method;

            res1.writeHead(res2.statusCode, res2.headers);

            res2.on('data', function(chunk) {
                res1.write(chunk);
            });

            res2.on('end', function() {
                res1.end();
                console.log(req1.method + " " + req1.url + " (fetched; " + t() + " seconds)");
            });

            cache.add(res2, t);

        });

        req1.on('data', function (chunk) {
            req2.write(chunk);
        });

        req1.on('end', function () {
            req2.end();
        });
        
    };
}

var cache = new Cache();

var server = http.createServer(function (req1, res1) {
    
    var t = timer();
    
    cache.find(req1, cacheHit(req1, res1, t), cacheMiss(req1, res1, t));
    
});

server.listen(8080, '127.0.0.1');
