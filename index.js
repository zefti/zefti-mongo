var MongoClient = require('mongodb').MongoClient;

var mongoCommands = [
    'find'
  , 'findOne'
  , 'findAndModify'
  , 'insert'
  , 'remove'
]

var init = function(options){
  var connectString = (options.username && options.password) ?
    'mongodb://' + options.username + ':' + options.password + '@' + options.replicaSet :
    'mongodb://' + options.replicaSet;
  if (options.database) {
    connectString = connectString + '/' + options.database;
  }
  return mongoCommand(connectString, {}, options.collection);
}

function mongoCommand(connectString, config, collection){
  var db = null;
  var status = null;
  var mongoVirtualClient = {};
  var pendingCommands = [];
  mongoCommands.forEach(function(command, cb){
    mongoVirtualClient[command] = function(){
      if (db) {
        //console.log('already db')
        db[command].apply(db, arguments);
      } else if (!db && !status) {
        status = 'connecting';
        pendingCommands.push({cmd:command, args:arguments});
        MongoClient.connect(connectString, config, function(err, returnedDb) {
          if (err) throw new Error('err connecting to mongo: ' + err);
          db = returnedDb.collection(collection);
          status = 'ready';
          pendingCommands.forEach(function(request){
            db[request.cmd].apply(db, request.args)
          });
        });
      } else {
        //console.log('status is not ready - pushing')
        pendingCommands.push({cmd:command, args:arguments})
      }
    }
  });
  return mongoVirtualClient;
}



module.exports = init;