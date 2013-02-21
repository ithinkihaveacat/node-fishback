var MongoClient = require('mongodb').MongoClient;
var Server = require('mongodb').Server

var mongoUri = process.env.MONGOLAB_URI || 
  process.env.MONGOHQ_URL || 
  'mongodb://localhost:27017/fishback'; 

// var mongoClient = new MongoClient(new Server(mongoUri));

MongoClient.connect(mongoUri, function(err, client) {
    if (err) { console.error(err); return; }
    client.createCollection("cache", { capped: true, size: 10 }, function (err, res) {
        if (err) { console.error(err); return; }
        res.save({ ffff: "asdfasdfasdf" }, function (err, res) {
            if (err) { console.error(err); return; }
            console.log("saved!");
        });
        res.save({ jjjj: "asdfasdfasdf" }, function (err, res) {
            if (err) { console.error(err); return; }
            console.log("saved!");
        });
    });
});
