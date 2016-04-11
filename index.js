var MongoClient = require('mongodb').MongoClient;
var errors = require('./lib/errors.json');
var errorHandler = require('zefti-error-handler');
errorHandler.addErrors(errors);

var mongoCommands = [
    'count'
  , 'find'
  , 'findOne'
  , 'findAndModify'
  , 'insert'
  , 'remove'
  , 'stats'
  , 'update'
];

var init = function(options){
  var dataSource = options.dataSource;
  var connectString = (dataSource.username && dataSource.password) ?
    'mongodb://' + dataSource.username + ':' + dataSource.password + '@' + dataSource.replicaSet :
    'mongodb://' + dataSource.replicaSet;
  if (dataSource.database) {
    connectString = connectString + '/' + dataSource.database;
  }
  if (options.errorHandler) errorHandler.addErrors(errors);
  return mongoCommand(connectString, {}, dataSource.collection);
};

function mongoCommand(connectString, config, collection){
  var db = null;
  var status = null;
  var mongoVirtualClient = {};
  var pendingCommands = [];
  mongoCommands.forEach(function(command){

    mongoVirtualClient[command] = function(){
      var args = [].slice.call(arguments);
      //TODO: fix the below
      var outerCb = args.splice(args.length-1, 1)[0];
      function errHandler(err, result){
        if (err) return outerCb(({errCode:'56b66547b19d2b3236345648', err:err}));
        return outerCb(null, result);
      }
      args.push(errHandler);
      if (db) {
        db[command].apply(db, args);
      } else if (!db && !status) {
        status = 'connecting';
        pendingCommands.push({cmd:command, args:args});
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
        pendingCommands.push({cmd:command, args:args})
      }
    }
  });
  return mongoVirtualClient;
}



module.exports = init;