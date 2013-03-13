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

function calls(callback) {

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
        return callback.apply(null, arguments);
    };
}

[response, calls].forEach(function (fn) {
    exports[fn.name] = fn;
});
