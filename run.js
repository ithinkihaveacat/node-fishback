require.paths.unshift("lib");

var fishback = require("fishback.js");

var server = fishback.createServer();

server.addResFilter(function (res) {
    // If origin doesn't return a cache-control header, make everything cacheable 
    // for 0 seconds.  This seems useless, but it means that if the the client 
    // explicitly passes max-stale, it will get a cached response.
    if (!("cache-control" in res.headers)) {
        res.headers["cache-control"] = "max-age=0";
    }
});

server.listen();
