/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var assert = require('assert');
var fishback = require('../lib/fishback');
var lib = require('./lib');

(function () {

    assert.doesNotThrow(function () {
        lib.step([]); 
    });

    assert.throws(function () {
        lib.step([1]);
    });

})();

(function () {

    var a = [];

    lib.step([
        function (callback) {
            a.push(1);
            callback(null, "a");
        },
        function (s, callback) {
            a.push(s);
            a.push(2);
            callback(null, "b");
        },
        function (s, callback) {
            a.push(s);
            a.push(3);
            callback(null, "c");
        },
        function (s, callback) {
            assert.equal(s, "c");
            assert.deepEqual(a, [1, "a", 2, "b", 3]);
            callback();
        }
    ]);
    
})();

(function () {

    var a = [];

    lib.step(
        [
            function (callback) {
                a.push(1);
                callback("ooops", "a");
            },
            function (s, callback) {
                // This shouldn't be called, because previous function returned error
                a.push(s);
                a.push(2);
                callback();
            }
        ], function (err) {
            assert.equal(err, "ooops");
            assert.deepEqual(a, [ 1 ]);
        }
    );
    
})();

(function () {

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

(function () {

    var now = 1295222561275;
    Date.prototype.getTime = function () { return now; };

    var data = [
        [ 
            { created: (now - (180 * 1000)), expires: (now + (180 * 1000)) }, 
            { "cache-control": "max-age=120" },
            false 
        ],
        [ 
            { created: now, expires: now + (180 * 1000) }, 
            { "cache-control": "max-age=120" },
            true 
        ],
        [ 
            { created: 0, expires: now - (60 * 1000) }, 
            { "cache-control": "max-stale=120" },
            true 
        ],
        [ 
            { created: 0, expires: now - (60 * 1000) }, 
            { "cache-control": "max-stale=30" },
            false 
        ],
        [ 
            { created: 0, expires: now + (60 * 1000) }, 
            { "cache-control": "min-fresh=30" },
            true 
        ],
        [ 
            { created: 0, expires: now + (60 * 1000) },
            { "cache-control": "min-fresh=120" },
            false
        ]
    ];

    data.forEach(function (d) {
        assert.equal(fishback.isFreshEnough(d[0], { headers: d[1] }), d[2]);
    });

})();

(function () {

    var getTime = Date.prototype.getTime;

    var now = 1295222561275;
    Date.prototype.getTime = function () { return now; };

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

(function () {

    var data = [
        [ { "cache-control": "jjjj", "foo": "no-cache" }, true ],
        [ { "cache-control": "no-cachejjj,foo=no-cache" }, true ],
        [ { "cache-control": "no-cachejjj,foo=no-cache, no-cache", "foo": "bar" }, false ]
    ];

    data.forEach(function (d) {
        assert.equal(fishback.wantsCache({ headers: d[0] }), d[1]);
        
    });

})();

(function () {

    var data = [
        [ { "cache-control": "jjjj", "foo": "no-cache" }, false ],
        [ { "cache-control": "no-cachejjj,only-if-cached" }, true ]
    ];

    data.forEach(function (d) {
        assert.equal(fishback.onlyWantsCache({ headers: d[0] }), d[1]);
        
    });

})();

(function () {

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

(function () {

    var data = [
        [ "", {} ],
        [ "  ", {} ],
        [ "foo=bar  ", { "foo": "bar" } ],
        [ "foo=bar,baz", { "foo": "bar", "baz": undefined } ],
        [ "   MAX-AGE=60,  private", { "max-age": 60, "private": undefined } ]
    ];

    data.forEach(function (d) {
        assert.deepEqual(fishback.parseHeader(d[0]), d[1]);
    });
    
})();

(function () {
    var calledFoo = false;
    var calledBar = false;
    lib.group({
        foo: function (callback) {
            process.nextTick(function () {
                calledFoo = true;
                callback("qqqq");
            });
        },
        bar: function (callback) {
            process.nextTick(function () {
                calledBar = true;
                callback(1, 2, 3);
            });
        }
    }, function (group) {
        assert.equal(true, calledFoo);
        assert.equal(true, calledBar);
        assert.deepEqual({ foo: "qqqq", bar: [ 1, 2, 3 ]}, group);
    });
    assert.equal(false, calledFoo);
    assert.equal(false, calledBar);
})();

(function () {
    var called = false;
    var n = 0;
    var knock = lib.knock(n, function () {
        assert.equal(false, called);
        called = true;
    });
    assert.equal(true, called);
    knock();
    assert.equal(true, called);
})();

(function () {
    var called = false;
    var n = 3;
    var knock = lib.knock(n, function () {
        assert.equal(false, called);
        called = true;
    });
    assert.equal(false, called);
    knock();
    assert.equal(false, called);
    knock();
    assert.equal(false, called);
    knock();
    assert.equal(true, called);
    assert.equal(3, n);
})();
