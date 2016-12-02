var utils = require('./utils.js');
var modbus = require('jsmodbus');

function ModbusInstance(config) {
  this.config = config;
  this.config.autoReconnect = true;
  this.config.reconnectTimeout = 1000;
  this.config.timeout = 5000;
  this.config.unitId = 0;
  this.config.unit = this.config.unit||["c","c","c","c"];
  this.config.raw = this.config.raw||[0,6,12,18];
  
  
  var instance = modbus.client.tcp.complete(this.config);
  
  instance.on('connect', function () {
      utils.log("Modbus connected:", config._id);
    })
  instance.on('error', function (err) {
      utils.log("Modbus error:", config._id, err);
    })
  
  
  this.connect = function(cb){
    instance.connect();
    cb();
  }
  
  this.read = function(cb){
    var _this = this;
    var raw = _this.config.raw;
    instance
      .readInputRegisters(raw[0], raw[raw.length-1]+1)
      .then(function (resp) {
        var result = {};
        var response = resp.register
          //decode the data from a buffer. this fixes problems with number encodings
          .map((r, i) => resp.payload.readInt16BE(i*2))
          //keep only the data that we have requested in "raw"  
          .filter((v,i) => raw.indexOf(i)!==-1)
          //map the data to channels
          .forEach(function(v, i){
            result["" + (i+1) + _this.config.unit[i]] = v;
          }); 
        
        cb(result);
      
      })
      .fail(utils.log);
  }
}

module.exports = ModbusInstance;