var sys = require('sys'),
    http = require('http');

function Fetcher() {
    this.maxStale = null;
    this.lastRequest = null;
    this.timeoutId = null;
    this.cachedResponse = null;
}

Fetcher.prototype.execute = function(request) {
    
    if (request.method != "GET") {
        // Uncacheable, do standard request
    } else {
        var cacheControl = request.header["cache-control"].split(/,\s*/).reduce(function (p, c) {
            var t = c.split(/=/, 2);
            p[t[0]] = t[1];
            return p;
        }, {});
        return cacheControl;
    }
    
};
var f = new Fetcher();

var p = f.execute({"method": "GET", "header": {"cache-control": "max-age=23300, max-stale"}});

sys.p(p);

function Proxy() {
}

Proxy.prototype.request = function() {
    
    var method, url, headers;

    if (typeof(arguments[1]) != "string") {
        method = "GET";
        url = arguments[0];
        headers = arguments[1];
    } else {
        method = arguments[0];
        url = arguments[1];
        headers = arguments[2];
    }
    
    if (method != "GET") {
        return http.request(method, url, headers);
    }
    
    var cacheControl = "cache-control" in headers ? headers["cache-control"].split(/\s*,\s*/).reduce(function (p, c) {
        var t = c.split(/\s*=\s*/, 2);
        p[t[0].toLowerCase()] = t[1];
        return p;
    }, {}) : {}
    
    if ("no-cache" in cacheControl) {
        return http.request(method, url, headers);
    }
    
//    var request = this._get(method, url, headers);
    
    if (url in this.cache) {
        
        this.cache[url].forEach(function (v) {
            if (this._isVaryMatch(v[0], headers)) {
                return v[1]; // TODO convert to request/response event emitter
            }
        });

    }
    
    // Not in cache, do regular request (and insert into cache).
    
    return this._request(method, url, headers);
};

Proxy.prototype._request(method, url, headers) {

    var request = http.request(method, url, headers);

    request.on("response", function (response) {
        
        var body = "";
        
        if (response.statusCode == 200) {
            
            response.on("data", function (chunk) {
                body += chunk;
            });

            response.on("end", function() {
                
                if (!this.cache[url]) {
                    this.cache[url] = [ ];
                }
                
                if (response.headers["vary"]) {
                    
                    // e.g. If response includes the header "Vary: Accept, Foo", the following
                    // expression might return { "accept": "text/xml", "foo": "qqqq" }.  (The
                    // keys are also sorted in alphabetical order.)
                    
                    var key = response.headers["vary"].toLowerCase().split(/\s*,\s*/).sort().reduce(function (p, c) {
                        p[c] = headers[c];
                        return p;
                    }, {}));
                    
                    var value = {
                        statusCode: response.statusCode,
                        httpVersion: response.httpVersion,
                        headers: response.headers,
                        body: body
                    };
                    
                    this.cache[url].push([key, value]);

                }
                
                // TODO Add setTimeout() to periodically fetch.  Maybe have to add some metadata
                // fields as well (maxStale, lastRequestTime, etc.).
                
            });

        }

    });
    
    return request;

};

Proxy.prototype._isVaryMatch = function(vary, headers) {
    // e.g. vary header of the candidate response (i.e. cache entry) = { "accept": "text/xml", "foo": "bar" }
    // e.g. headers of the actual request = { "accept": "text/json", "foo": "bar", "jjjj": "qqqq" } 
    if ("*" in vary) { 
        return true; 
    }
    for (k in vary) {
        if (headers[k] != vary[k]) {
            return false;
        }
    }
    return true;
};