#!/usr/local/bin/node

require.paths.unshift("lib");

var fishback = require("fishback");

var server = fishback.createServer();

server.addResFilter(function (res) {
    // If origin doesn't return a cache-control header, make everything cacheable 
    // for 0 seconds.  This seems useless, but it means that if the client 
    // explicitly passes max-stale, it will get a cached response, and clients
    // that don't won't break.
    if (!("cache-control" in res.headers)) {
        res.headers["cache-control"] = "max-age=0";
    }
    // Change the "private" cache-control directive to public--for most use cases,
    // you want to cache "private" resources.  (e.g. Flickr returns cache-control: private.)
    res.headers["cache-control"] = res.headers["cache-control"].replace(/\bprivate\b/, "public");
});

server.listen();
