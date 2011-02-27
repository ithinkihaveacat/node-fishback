var lib = require("lib");

var response = { headers: { "cache-control": "max-age=60, public" }, body: "Hello, World" };
var expected = [
	{ headers: { "x-cache": "MISS", "cache-control": "max-age=60, public" }, body: "Hello, World" },
	{ headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, body: "Hello, World" },
	{ headers: { "x-cache": "HIT",  "cache-control": "max-age=60, public" }, body: "Hello, World" }
];

var service = lib.createService(response);

service.request(expected.length, function (actual) {
	for (var i = 0; i < actual.length; i++) {
	    lib.responseEqual(actual[i], expected[i]);
	}
	service.shutdown();
});
