[![Build Status](https://travis-ci.org/ithinkihaveacat/node-fishback.png)](https://travis-ci.org/ithinkihaveacat/node-fishback)

## About

Fishback is an simple NodeJS-powered caching HTTP proxy.  It tries pretty hard to be RFC2616 compliant (and many of the slightly unusual features like `only-if-cached` and `max-stale` are supported), but there's probably some things it doesn't do completely correctly.  (Any variation from RFC2616 should be considered a bug.)

## `only-if-cached`

If the `Cache-Control` header of a request includes the [`only-if-cached`](http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.4) header, then the client receives a 504 response, as mandated by the RFC.  However, the proxy also issues the request to the origin server in the background, storing the returned content in the cache if possible so that subsequent requests can be fulfilled by the cache.

## Installation

The simplest way is with `npm`:

    $ npm install fishback

This also creates a `fishback` executable that runs on `127.0.0.1:8080`.

Note that `fishback` has no dependencies (`npm` does not need to install any other modules), so you can also run it directly from a git working copy:

    $ git clone https://github.com/ithinkihaveacat/node-fishback.git
    $ cd node-fishback
    $ node run.js

## Examples

    # Terminal #1
    $ fishback-standalone 
    Proxy server is running on localhost:8080
    
    # Terminal #2
    # Request #1
    $ http_proxy=http://127.0.0.1:8080/ wget -q -O - http://www.google.co.uk/ > /dev/null
    $ http_proxy=http://127.0.0.1:8080/ wget -q -O - http://www.google.co.uk/ > /dev/null

In the output of Terminal #1, you'll see the page being fetched, and then saved to the cache.  (In this case the cache is never used because max-age=0.)

    # Request #2
    $ http_proxy=http://127.0.0.1:8080/ wget -q -O - http://www.google.co.uk/images/logos/ps_logo2a_cp.png > /dev/null
    $ http_proxy=http://127.0.0.1:8080/ wget -q -O - http://www.google.co.uk/images/logos/ps_logo2a_cp.png > /dev/null

In this case the cache is used.

    # Request #3
    $ http_proxy=http://127.0.0.1:8080/ wget -q -O - --header="cache-control: max-stale=60" http://www.google.co.uk/ > /dev/null

In this case the cache is again used, because the client specifically permitted a stale entry.

    # Request #4
    $ http_proxy=http://127.0.0.1:8080/ wget -S -q -O - --header="cache-control: only-if-cached" http://www.bbc.co.uk/favicon.ico > /dev/null
      HTTP/1.1 504 Gateway Time-out
      Connection: close

The client only wanted a response if it was already in the cache, which in this case it wasn't.  However, in this case, even though the 504 response is issued immediately, the full request is also made, in the background, so that subsequent requests will get the benefit of the cache:

    $ http_proxy=http://127.0.0.1:8080/ wget -S -q -O - --header="cache-control: only-if-cached" http://www.bbc.co.uk/favicon.ico > /dev/null

## Bugs/Issues

  * There's no HTTPS support.
  * If the proxy server is able to read from the origin faster than the client can receive data, content needs to be buffered, either by node or the kernel.  (This can be fixed by backing off when `write()` returns false, and resuming only when the ["drain" event](http://nodejs.org/docs/v0.4.1/api/all.html#event_drain_) is triggered.  This is only likely to be a problem if you're streaming very large files through node.)
  * ETags (and `must-revalidate`) are not supported.  (You don't get incorrect results; you just need retrieve the entire resource from the origin each time.)

## Author

Michael Stillwell 
<mjs@beebo.org>
