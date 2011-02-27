require.paths.unshift("../lib");

var assert = require('assert');
var fishback = require('fishback');

(function(){

    var data = [
        [ { }, false ],
        [ { "cache-control": "public" }, true ],
        [ { "cache-control": "s-maxage=7773, public, foo=bar" }, true ],
        [ { "cache-control": "s-maxage=7773, private, foo=bar" }, false ],
        [ { "cache-control": "s-maxage=7773, qqq=public, foo=bar" }, false ],
        [ { "expires": "Tue, 17 Jan 2012 00:49:02 GMT", "cache-control": "public, max-age=31536000" }, true ]
    ];

    data.forEach(function (d) {
        assert.equal(fishback.canCache({ headers: d[0] }), d[1]);
    });
    
})();

(function() {

    var getTime = Date.prototype.getTime;

    var now = 1295222561275;
    Date.prototype.getTime = function() { return now; };

    var data = [
        [ 
            { created: now - (180*1000), expires: now + (180*1000) }, 
            { "cache-control": "max-age=120" },
            false 
        ],
        [ 
            { created: now, expires: now + (180*1000) }, 
            { "cache-control": "max-age=120" },
            true 
        ],
        [ 
            { created: 0, expires: now - (60*1000) }, 
            { "cache-control": "max-stale=120" },
            true 
        ],
        [ 
            { created: 0, expires: now - (60*1000) }, 
            { "cache-control": "max-stale=30" },
            false 
        ],
        [ 
            { created: 0, expires: now + (60*1000) }, 
            { "cache-control": "min-fresh=30" },
            true 
        ],
        [ 
            { created: 0, expires: now + (60*1000) },
            { "cache-control": "min-fresh=120" },
            false
        ]
    ];

    data.forEach(function (d) {
        assert.equal(fishback.isFreshEnough(d[0], { headers: d[1] }), d[2]);
    })

})();

(function() {

    var getTime = Date.prototype.getTime;

    var now = 1295222561275;
    Date.prototype.getTime = function() { return now; };

    var data = [
        [ { }, 1295222561275 ],
        [ { "expires": "Thu, 01 Dec 1994 16:00:00 GMT" }, 786297600000 ],
        [ { "cache-control": "max-age=60" }, 1295222621275 ]
    ];

    data.forEach(function (d) {
        assert.equal(fishback.expiresAt({ headers: d[0] }), d[1]);
    });

    Date.prototype.getTIme = getTime;
    
})();

(function() {

    var data = [
        [ { "cache-control": "jjjj", "foo": "no-cache" }, true ],
        [ { "cache-control": "no-cachejjj,foo=no-cache" }, true ],
        [ { "cache-control": "no-cachejjj,foo=no-cache, no-cache", "foo": "bar" }, false ]
    ];

    data.forEach(function (d) {
        assert.equal(fishback.wantsCache({ headers: d[0] }), d[1]);
        
    });

})();

(function() {

    var data = [
        [ { "cache-control": "jjjj", "foo": "no-cache" }, false ],
        [ { "cache-control": "no-cachejjj,only-if-cached" }, true ],
    ];

    data.forEach(function (d) {
        assert.equal(fishback.onlyWantsCache({ headers: d[0] }), d[1]);
        
    });

})();

(function() {

    var data = [
        [
            { },
            { },
            true
        ],
        [
            { "foo": "bar" },
            { },
            true
        ],
        [
            { "foo": "bar", "vary": "*" },
            { }, // doesn't have foo: bar
            false
        ],
        [
            { "foo": "bar", "vary": "quux" },
            { },
            true
        ],
        [
            { "foo": "bar", "vary": "foo" },
            { },
            false
        ],
        [
            { "foo": "bar", "vary": "foo" },
            { "foo": "bar" },
            true
        ]

    ];

    data.forEach(function (d) {
        assert.equal(fishback.isVaryMatch({ headers: d[0] }, { headers: d[1] }), d[2]);
    });

})();

(function() {

    var data = [
        [ "", {} ],
        [ "  ", {} ],
        [ "foo=bar  ", { "foo": "bar" } ],
        [ "foo=bar,baz", { "foo": "bar", "baz": undefined } ],
        [ "   MAX-AGE=60,  private", { "max-age": 60, "private": undefined } ]
    ];

    data.forEach(function (d) {
        assert.deepEqual(fishback.parseHeader(d[0]), d[1]);
    })
    
})();