require.paths.unshift("lib");

var fishback = require("fishback.js");

var server = fishback.createServer();

server.addResFilter(function (res) {
    // If origin doesn't specify, make everything cachable for an hour
    if (!("cache-control" in res.headers)) {
        res.headers["cache-control"] = "max-age=3600";
    }
});

server.listen();
