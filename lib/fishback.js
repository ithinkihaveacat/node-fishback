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
h = { };
console.log(h, wantsCache(h)); // true
h = { "cache-control": "jjjj", "foo": "no-cache" };
console.log(h, wantsCache(h)); // true
h = { "cache-control": "no-cachejjj,foo=no-cache" };
console.log(h, wantsCache(h)); // true
h = { "cache-control": "no-cachejjj,foo=no-cache, no-cache", "foo": "bar" };
console.log(h, wantsCache(h)); // false
*/

function wantsCache(reqHeaders)
{
    return !("cache-control" in reqHeaders) || 
           (reqHeaders["cache-control"].indexOf("no-cache") == -1) || 
           // final, more specific check to ensure the one above didn't find a substring
           !("no-cache" in parseHeader(reqHeaders["cache-control"])); 
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

function isVaryMatch(resHeaders, reqHeaders)
{
    if (!("vary" in resHeaders)) {
        return true;
    }
    
    if (resHeaders.vary == "*") {
        return false;
    }
    
    return resHeaders.vary.split(/\s*,\s/).every(function (h) {
        return reqHeaders[h] == resHeaders[h];
    });
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
*/

// Accept "private" as well as "public" on the theory that
// there's really only one user of the proxy

function canCache(resHeaders)
{
    if (!("cache-control" in resHeaders)) {
        return false;
    }
    
    if ((resHeaders["cache-control"].indexOf("public")  == -1) &&
        (resHeaders["cache-control"].indexOf("private") == -1)) {
        return false;
    }
    
    var headers = parseHeader(resHeaders["cache-control"]);
    
    return ("public" in headers) || ("private" in headers);
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

function isFreshEnough(res, reqHeaders)
{
    if (!("cache-control" in reqHeaders)) {
        return true;
    }
    
    var headers = parseHeader(reqHeaders["cache-control"]);
    
    var flag = true;
    
    if (("max-stale" in headers) && res.expires) {
        // RFC2616 says we MUST tell the client that the resource is stale 
        flag &= (headers["max-stale"] * 1000) > (new Date().getTime() - res.expires); // max-stale > "staleness"
    }
    
    if (("max-age" in headers) && res.created) {
        flag &= (headers["max-age"] * 1000) > (new Date().getTime() - res.created); // max-age > "age"
    }
    
    if (("min-fresh" in headers) && res.expires) {
        flag &= (headers["min-fresh"] * 1000) < (res.expires - new Date().getTime()); // min-fresh < "time until expiry"
    }
    
    return flag;
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

function expiresAt(resHeaders)
{
    if (!("expires" in resHeaders) && !("cache-control" in resHeaders)) {
        return null;
    }
    
    if (resHeaders["cache-control"]) {
        var headers = parseHeader(resHeaders["cache-control"]);
        if (headers["s-maxage"]) {
            return new Data().getTime() + (headers["s-maxage"] * 1000);
        } else if (headers["max-age"]) {
            return new Date().getTime() + (headers["max-age"] * 1000);
        }
    }
    
    if (resHeaders["expires"]) {
        return Date.parse(resHeaders["expires"]);
    }
    
    return null;
}

var cacheData = { };
var cacheList = [ ];

var server = http.createServer(function (req1, res1) {
    
    var i;

    var t = timer();

    var tmp = url.parse(req1.url);
    if (!tmp.port) { 
        tmp.port = 80; // set default port; parse() doesn't do this for us
    }

    // Whether it's worth bothering to look in the cache
    var canTryCache = (req1.method == 'GET') && wantsCache(req1.headers);
    
    if (canTryCache && cacheData[req1.url]) {

        for (i = 0; i < cacheData[req1.url].length; i++) {

            if (isVaryMatch(cacheData[req1.url][i].headers, req1.headers) && isFreshEnough(cacheData[req1.url][i], req1.headers)) {
                
                (function(res) {
                    
                    res1.writeHead(200, res.headers);
                    res1.write(res.body);
                    res1.end();
                    
                    console.log(req1.method + " " + req1.url + " (cached; " + t() + " seconds)");
                    
                })(cacheData[req1.url][i]);
                
                return;

            }
        }
    }
    
    // TODO Error handling: what if we don't have a hostname?
    
    var client = http.createClient(tmp.port, tmp.hostname); // TODO Share clients somehow?
    
    var req2 = client.request(
        req1.method, 
        tmp.pathname + (tmp.search ? tmp.search : ''),
        req1.headers
    );
    
    req1.on('data', function (chunk) {
        req2.write(chunk);
    });
    
    req1.on('end', function () {
        req2.end();
    });
    
    req2.on('response', function (res2) {
        
        res1.writeHead(res2.statusCode, res2.headers);

        res2.on('data', function (chunk) {
            res1.write(chunk);
        });

        res2.on('end', function() {
            res1.end();
            console.log(req1.method + " " + req1.url + " (fetched; " + t() + " seconds)");
        });
        
        if (canCache(res2.headers)) {
            
            (function() {
                
                var id = Math.floor(Math.random() * 4294967296).toString(16);
                
                var res = {
                    id: id,
                    headers: res2.headers,
                    body: '', // appended to below, as we receive data
                    expires: expiresAt(res2.headers),
                    created: new Date().getTime()
                };
            
                res2.on('data', function (chunk) {
                    res.body += chunk;
                });
                
                res2.on('end', function() {
                    
                    if (!cacheData[req1.url]) {
                        cacheData[req1.url] = [ res ];
                    } else {
                        cacheData[req1.url].push(res);
                    }
                    
                    cacheList.push({ url: req1.url, id: res.id, expires: res.expires });
                    
                    console.log(req1.method + " " + req1.url + " (saved; " + t() + " seconds)");

                });
                
            })();
            
        }
        
    });
    
});

server.listen(8080, 'localhost');
