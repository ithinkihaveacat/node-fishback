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

    return !("private" in headers) && !("no-store" in headers) && !("must-revalidate" in headers) && 
        (("public" in headers) || ("max-age" in headers) || ("s-maxage" in headers));
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

[parseHeader, expiresAt, canCache, isFreshEnough, wantsCache, onlyWantsCache, isVaryMatch].forEach(function (fn) {
    exports[fn.name] = fn;
});
