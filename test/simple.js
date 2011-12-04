var lib = require('./lib');

var response = { headers: { "foo": "bar" }, body: "Hello, World" };

lib.createService(response, function (service) {
  service.request(10, function(actual) {
      actual.forEach(function (a) {
          lib.responseEqual(a, response);
      })
      service.shutdown();
  });
});