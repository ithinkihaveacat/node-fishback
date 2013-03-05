[![Build Status](https://travis-ci.org/ithinkihaveacat/node-fishback.png)](https://travis-ci.org/ithinkihaveacat/node-fishback)

## Overview

Fishback is an simple NodeJS-powered caching HTTP proxy.  It tries pretty hard
to be RFC2616 compliant (and many of the slightly unusual features like
`only-if-cached` and `max-stale` are supported), but there's probably some
things it doesn't do completely correctly.  (Though any variation from RFC2616
should be considered a bug.)

## Design

Fishback is heavily event based, and in particular relies heavily on the four
event emitters http.ServerRequest, http.ServerResponse, http.ClientRequest and 
http.ClientResponse.

### Class: fishback.Proxy(cache, client)

#### Event: 'newRequest'

`function (serverRequest) { }`

#### Event: 'newResponse'

`function (serverResponse) { }`

#### proxy.request(serverRequest, serverResponse)

Listens to http.Server's 'request' event, reading from serverRequest and writing to
serverResponse.

### Class: fishback.Cache(...)

e.g. `fishback.CacheMemory`, `fishback.CacheMongoDb`.

#### Event: 'newRequest'

`function (serverRequest) { }`

#### Event: 'newResponse'

`function (serverResponse) { }`

#### cache.request(serverRequest, serverResponse)

Fires `reject` event on `serverRequest` if unable to handle the request.  (e.g.
not cached.)

If request not rejected, fires `endHead` event on `serverResponse` when headers
have been set on the response.

#### cache.response(clientResponse)

For populating the cache.  (If the cache fires a `reject` event, Fishback will
arrange for a "real" HTTP request to be issued; the response from this request
is then passed to the cache.)

### Class: fishback.Client(backend_hostname, backend_port, http)

Does a real HTTP request, if the request cannot be satisfied by the cache.

#### Event: 'newRequest'

`function (serverRequest) { }`

#### Event: 'newResponse'

`function (serverResponse) { }`

#### client.request(serverRequest, serverResponse)

Fires `endHead` event on `serverResponse` when headers have been set on the 
response.

## Bugs/Issues

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
