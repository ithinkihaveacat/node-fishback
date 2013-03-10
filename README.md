[![Build Status](https://travis-ci.org/ithinkihaveacat/node-fishback.png)](https://travis-ci.org/ithinkihaveacat/node-fishback)

## Overview

Fishback is a simple NodeJS-powered caching HTTP proxy.

As well as supporting different caching backends, the design lends itself to
filtering and processing the headers of both requests and responses.  (For
example, changing `Cache-Control` headers.)  It is not well-suited to
transforming request or response *bodies*, though it can be integrated into
systems that do provide this feature.

Fishback tries hard to be RFC2616 compliant (and many of the slightly unusual
features like `only-if-cached` and `max-stale` are supported), but there's
probably some things it doesn't do completely correctly.  (Though any variation
from RFC2616 should be considered a bug.)

## Example

````js
var fishback = require("../lib/fishback");
var http = require("http");

var proxy = fishback.createProxy(new fishback.Client("localhost", 9000));
proxy.on("newRequest", function (req) {
    console.log(req.method + " " + req.url);
});
proxy.on("newResponse", function (res) {
    res.setHeader("cache-control", "public, max-age=3600");
});

http.createServer(proxy.request.bind(proxy)).listen(8000);

console.log("Listening on port 8000, and proxying to localhost:9000");
````

For more, see the [examples](examples) directory.

## Installation

````sh
$ npm install fishback
````

## API

Fishback is heavily event based, and in relies heavily on the four event
emitters `http.ServerRequest`, `http.ServerResponse`, `http.ClientRequest` and
`http.ClientResponse`.

In contrast to most NodeJS "middleware" systems (including
[Connect](http://www.senchalabs.org/connect/)), Fishback itself does not contain
a web server.  Instead, Fishback provides a handler for `http.Server's`
['request' event](http://nodejs.org/api/http.html#http_event_request).

### fishback.createProxy(client)

* `fishback.Handler` `client` - probably a `fishback.Client`

Convenience function for creating a simple proxy from a client.

### fishback.createCachingProxy(cache, client)

* `fishback.Handler` `cache` - probably one of the cache backends
* `fishback.Handler` `client` - probably a `fishback.Client`

Convenience function for creating a proxy from a cache and client.

### Class: fishback.Handler(...)

"Abstract" base class for all handlers.  All the classes below (the HTTP client
that does real requests, the various cache backends, and the Fishback class that
ties them together) are derived from this class.

#### Event: 'newRequest'

`function (serverRequest) { }`

  * [`http.ServerRequest`](http://nodejs.org/api/http.html#http_class_http_serverrequest) `serverRequest`

Emitted when a new request has been received.  (At the point the event is
emitted, only headers are available, though you can of course arrange to listen
to other events.)

#### Event: 'newResponse'

`function (serverResponse) { }`

  * [`http.ServerResponse`](http://nodejs.org/api/http.html#http_class_http_serverresponse) `serverResponse`

Emitted when a new response is being sent.  (At the point the event is emitted,
only headers are available.  Because of limitations in the
[http.ServerResponse](http://nodejs.org/api/http.html#http_class_http_serverresponse)
API (`write()` does not fire any events), it is not possible to observe any
"write" events.)

#### cache.request(serverRequest, serverResponse)

  * [`http.ServerRequest`](http://nodejs.org/api/http.html#http_class_http_serverrequest) `serverRequest`
  * [`http.ServerResponse`](http://nodejs.org/api/http.html#http_class_http_serverresponse) `serverResponse`

Processes a request/response pair.

If unable to handle the request (e.g. resource is not cached), `serverRequest`
will emit the `reject` event.

If request is accepted (i.e. the handler is writing to `serverResponse`),
`serverResponse` will emit the `endHead` event when headers have been set on the
response.

(If overriding this method, note that the handler must ensure that if a request
is rejected, any handlers that may subsequently be invoked are actually able to
fulfill the request!  The most important implication of this constraint is that
if the request method is not `GET`, it must be rejected immediately
(synchronously).  If the method is `GET`, the request can be rejected
asynchronously since subsequent handlers do not need any information from `data`
events they would otherwise have missed).)

#### cache.response(clientResponse)

  * [`http.ClientResponse`](http://nodejs.org/api/http.html#http_http_clientresponse) `clientResponse`

Process a *client* response.

This is really only useful for caching handlers--it allows them to populate
their caches from responses to any real HTTP requests that are issued.

(For example, `fishback.createCachingProxy()` arranges things so that if the
cache handler fires a `reject` event, a "real" HTTP request to be issued; the
response from this request is then passed to the cache.)

### Class: fishback.Fishback(list)

Derived from `fishback.Handler`.

  * `list` an array of `fishback.Handler` objects

The last object in list is assumed to be a real HTTP client that will never
`reject` a request.  The other objects can reject requests.

### Class: fishback.Client(backend_hostname, backend_port, http)

Derived from `fishback.Handler`.

  * `backend_hostname` - e.g. 'localhost'
  * `backend_port` - e.g. 80
  * `http` - object with a `request()` method, such as `require('http')`

Does a real HTTP request.

### Class: fishback.Memory()

Derived from `fishback.Handler`.

Caching backend.

### Class: fishback.MongoDb()

Derived from `fishback.Handler`.

## Bugs

  * None of the backends are any good.  I'd like to use memcached, but the
    client I was using has bugs.
  * There's no HTTPS support.
  * If the proxy server is able to read from the origin faster than the client
    can receive data, content needs to be buffered, either by node or the
    kernel.  (This can be fixed by backing off when `write()` returns false, and
    resuming only when the ["drain"
    event](http://nodejs.org/api/stream.html#stream_event_drain) is
    triggered.  This is only likely to be a problem if you're streaming very
    large files through node.)
  * ETags (and `must-revalidate`) are not supported.  (You don't get incorrect
    results; you just need retrieve the entire resource from the origin each
    time.)

## See Also

If you're only after a proxy (rather than a caching proxy),
[node-http-proxy](https://github.com/nodejitsu/node-http-proxy) may be more
suitable.

## Author

Michael Stillwell 
<mjs@beebo.org>
