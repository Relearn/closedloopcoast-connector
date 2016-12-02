
var utils = require('./utils.js');
var MongoInstance = require('./MongoInstance.js');
var ModbusInstance = require('./ModbusInstance.js');
var SNMPInstance = require('./SNMPInstance.js');
var LowPassFilter = require('./LowPassFilter.js');
var dateFormat = require('dateformat');
var cluster = require('cluster');
var networkInterfaces  = require('os').networkInterfaces();

const DATA_DB_URL = 'mongodb://writer:icanwrite@ds049624.mlab.com:49624/domesensors';
const CONFIG_DB_URL = "mongodb://reader:icanread@ds143777.mlab.com:43777/closedloopconfig";

var DATE_TIME_FORMAT = "yymmdd-HH:MM:ss";
var PERIOD = 1000*2;
var PERIOD_HISTORY_MINOR = 1000;
var PERIOD_HISTORY_MAJOR = 1000*60*30;
var deviceID = "";

if (cluster.isMaster) {
  cluster.fork();

  cluster.on('exit', function(worker, code, signal) {
    cluster.fork();
  });
}

if (cluster.isWorker) {

  var mac = [];
  for(let key in networkInterfaces){
    mac = mac.concat(networkInterfaces[key].filter((f)=> f.family == "IPv4" && !f.internal).map((m)=>m.mac))
  }
  deviceID = mac.join(" ");
  

  var lowPassFilter = null;

  var sources = [];
  var status = {"generic":{}};




  var configs = new MongoInstance(CONFIG_DB_URL);
  configs.connect((db) => {
    var cfgPromises = [  
      db.collection('data_sources').find({}).toArray(),
      db.collection('data_processing').find({}).toArray(),
      db.collection('generic').find({}).next()
    ]

    Promise.all(cfgPromises).then(function(response) {
      utils.log("Received configs:", response);
      let data_sources = response[0];
      let data_processing = response[1];
      let generic = response[2];

      if(generic.dateTimeFormat) DATE_TIME_FORMAT = generic.dateTimeFormat;
      if(generic.period_ms) PERIOD = generic.period_ms;
      if(generic.periodHistoryMinor_ms) PERIOD_HISTORY_MINOR = generic.periodHistoryMinor_ms;
      if(generic.periodHistoryMajor_ms) PERIOD_HISTORY_MAJOR = generic.periodHistoryMajor_ms;

      lowPassFilter = new LowPassFilter(data_processing);

      data_sources.forEach((source) => {
        let reader = null;
        switch (source.reader){
          case "modbus": reader = new ModbusInstance(source); break;
          case "snmp": reader = new SNMPInstance(source); break;
          default: utils.log("Unknown reader found in config:", source.reader);
        }
        reader.connect(() => {sources.push(reader)});
      })
      configs.close();
    })
    .catch((err)=>{utils.log(err)});
  });



  var storage = new MongoInstance(DATA_DB_URL);
  storage.connect((db) => {
    db.on('close', restart);
    
    var upload = {};
    var lastUpdateMinorTime = null;
    var lastUpdateMajorTime = null;
    var majorUpdate = false;
    var minorUpdate = false;
    setInterval(() => {
      var time = (new Date()).valueOf();
      
      if(!lastUpdateMajorTime || (time > lastUpdateMajorTime + PERIOD_HISTORY_MAJOR)){
        majorUpdate = true;
        lastUpdateMajorTime = (new Date(time)).valueOf();
      }else{
        majorUpdate = false;
      }      
      if(!lastUpdateMinorTime || (time > lastUpdateMinorTime + PERIOD_HISTORY_MINOR)){
        minorUpdate = true;
        lastUpdateMinorTime = (new Date(time)).valueOf();
      }else{
        minorUpdate = false;
      }

      sources.forEach((source) => {
        source.read((data) => {

          Object.keys(data).forEach((channel) => {
            let id = source.config.alias+channel;
            let value = data[channel];
            status[id] = data[channel];
            let processed = lowPassFilter.run(id, time, value);

            if(minorUpdate && processed.significant || majorUpdate){ 
              if(!upload[time]) upload[time] = {}
              upload[time]._id = time;
              upload[time][id] = processed.value;
            }
          });
        });
      })

      for(let key in upload) {
        storage.insert("timeseries", upload[key]);
        delete upload[key];
      }
      
      
      //store the status
      status.generic.historyUpdated = storage.lastDataUpdate().valueOf();
      status.generic.heartbeat = time;      
      storage.db().collection("status").updateOne({"_id": "status "+deviceID}, status, {upsert:true});
      
      //restart on demand from mongo
      storage.db().collection("status").find({_id: "restart " +deviceID}).next((err,d)=>{
        storage.db().collection("status").updateOne({_id: "restart " +deviceID}, {"_id": "restart "+deviceID,"restart": false}, {upsert:true});
        if((d||{}).restart) restart()
      });

    }, PERIOD);
  });
  
  var restart = function(){
    utils.log("restart!");
    cluster.close();
  };

}