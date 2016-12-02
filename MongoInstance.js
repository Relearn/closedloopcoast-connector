var utils = require('./utils.js');
var mongodb = require('mongodb');
const Long = mongodb.Long;

function MongoInstance(url) {
  var db = null;
  var lastDataUpdate = null;
  this.url = url;
  
  this.name = function(){
    return this.url.split("/")[3];
  };
  
  this.db = function(arg){
    if (!arguments.length) return db;
    db = arg;
    return this;
  };
  
  this.lastDataUpdate = function(arg){
    if (!arguments.length) return lastDataUpdate||{};
    lastDataUpdate = arg;
    return this;
  };

  this.connect = function(cb){
    var _this = this;
    return mongodb.MongoClient.connect(this.url, function(err, database) {
      if(err) {
        utils.log("DB error:", _this.name(), err);
      }else{
        utils.log("DB connect:", _this.name());
        _this.db(database);
        if(cb) cb(database);
        database.on('close', function() {
          utils.log("DB disconnect:", _this.name());
          _this.db(null);
        });
      }
    });
  };
  
  this.insert = function(collection, data){
    var _this = this;
    data._id = Long.fromNumber(data._id);
    db.collection(collection).insert(data, null, (err) => {
      if(err){
        utils.log(err);
      }else{
        utils.log("Storing:" + JSON.stringify(data));
        _this.lastDataUpdate(new Date);
      }
    });
  };
  


  
  this.close = function(){
    this.db().close();
  };
}

module.exports = MongoInstance;