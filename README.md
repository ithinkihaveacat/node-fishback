## About

Fishback is an simple NodeJS-powered caching HTTP proxy.  It tries pretty hard to be RFC2616 compliant (and many of the slightly unusual features like `only-if-cached` and `max-stale` are supported), but there's probably some things it doesn't do right.

It's been tested under node 0.4.0, and is likely to require node 0.3.7+.

## Bugs/Issues

  * There's no HTTPS support.

## Installation

The simplest way is with `npm`:

    $ npm install fishback

This also creates a `fishback` executable that runs on 127.0.0.1:8080.

## Example

    # Terminal #1
    $ node run.js 
    Proxy server is running on 127.0.0.1:8080
    
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

## Author

Michael Stillwell <mjs@beebo.org>
