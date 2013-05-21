/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:false, strict:true, undef:true, unused:true, curly:true, node:true, indent:4, maxerr:50, globalstrict:true */

"use strict";

var assert = require('assert');

/**
 * Convenience function for checking whether expected matches actual.
 * actual can contain headers not present in expected, but the reverse
 * is not true.
 * 
 * @param  {object} actual
 * @param  {object} expected
 * @return {boolean}
 */
function response(actual, expected) {
    Object.keys(expected.headers).forEach(function (k) {
        assert.equal(actual.headers[k], expected.headers[k]);
    });
    assert.equal(actual.data, expected.data);
}

function calls(callback, context) {

    if (calls.count === undefined) {
        calls.count = 0;
        process.on('exit', function () {
            var n_functions = calls.count === 1 ? "1 function" : (calls.count + " functions");
            assert.equal(calls.count, 0, "Failed to call " + n_functions);
        });
    }

    calls.count++;

    return function () {
        calls.count--;
        return callback.apply(context, arguments);
    };
}

function once(callback, context) {
    var count = 0;
    process.on('exit', function () {
        var name = callback.name ? callback.name : "unknown";
        assert.equal(count, 1, "Unexpectedly called function [" + name + "] " + count + " times"); 
    });
    return function () {
        count++;
        return callback.apply(context, arguments);
    }
}

function never(callback, context) {
    return function () {
        var name = callback.name ? callback.name : "unknown";
        assert.ok(false, "Unexpectedly called function [" + name + "]");
        return callback.apply(context, arguments);
    };
}

process.setMaxListeners(20);

[response, calls, once, never].forEach(function (fn) {
    exports[fn.name] = fn;
});
