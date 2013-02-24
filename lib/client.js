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
