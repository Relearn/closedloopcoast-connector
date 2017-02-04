var utils = require('./utils.js');
var snmp = require ("net-snmp");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

function SNMPInstance(config) {
  this.config = Object.assign({
    alias: config._id,
    prefix: "1.3.6.1.4.1.22626.1.5.2.", 
    community: "public",
    unit: 1,
    dataPerChannel: 2,
    raw: ["1.3.0","1.9.0","2.3.0","2.9.0","3.3.0","3.9.0","4.3.0","4.9.0"],
    probeNames: ["Channel 1","Channel 2","Channel 3","Channel 4"],
    probeEnabled: [1,1,1,1],
    probeTypes: [1,1,1,1],
    port: 161,
    retries: 2,
    timeout: 1000,
    transport: "udp4",
    trapPort: 162,
    version: snmp.Version1
  }, config)
  
  var unitsByProbeType = {
    0:["clone channel"], //no probe
    1:["C", "F"], //"temperature probe"
    2:["RH", "C", "F"] //"humidity+temperature probe"
  };
  
  
  
  this.connect = function(cb){
    if(cb) cb();
  };
  
  
  this.read = function(cb){
    var _this = this;
    var result = {};
    var l = this.config.dataPerChannel;
    
    var instance = snmp.createSession(this.config.host, this.config.community, this.config);

    var oids = this.config.raw.map((m) => this.config.prefix + m);
    
    instance.get(oids, function (error, varbinds) {
      
      _this.config.raw.forEach(function(raw, i){
        var ch = ~~(i / l) + 1;

        if(error && error.name == "RequestTimedOutError"){
          v = {value: -11100}; 
          u = {value: "c"};
        } else if(error){
          utils.error(error);
          v = {value: -11101}; 
          u = {value: "c"};
        } else { 

          var v = varbinds[i];
          var u = l<=1 ? {value: "c"} : varbinds[~~(i / l) * l + _this.config.unit];

          if(snmp.isVarbindError(v)) {
            utils.error(snmp.varbindError(v));
            v = {value: -11102};
          }

          if(snmp.isVarbindError(u)) {
            utils.error(snmp.varbindError(u));
            u = {value: "c"};
          }
        }

        if(i % l === 0) result["" + ch + u.value.toString("ascii",1).toLowerCase()] = v.value;
      }); 

      if(cb) cb(result);
      //if(!error && _this.config.probeTypes.indexOf(2)!==-1) _this.switchUnit()
    });
  }
  
  // switch the probe unit between temperature and humidity
  // by immitating the web interface that would normally do that
  // neither SNMP nor Modbus implementations on the sensor give functionality of modifying configs
  // Modbus implementation doesn't even have the capability of reading the current unit
  this.switchUnit = function(cb){
    var _this = this;
    
    if(!this.config.probeRoms || !this.config.probeRoms.length) return utils.log("incorrect config.probeRoms", this.config.probeRoms);
    
    // skipping channel 0 to simplify addressing, adding channel 5 because there are actually five channels in P8641!
    var enabled = [""].concat(this.config.probeEnabled).concat(1);
    var names = [""].concat(this.config.probeNames).concat("Channel 5");
    var types = [""].concat(this.config.probeTypes).concat(0);
    var roms = [""].concat(this.config.probeRoms).concat("00 00 00 00 00 00 00 00");
    this.units = this.units || [""].concat([0,0,0,0]).concat(0);
    
    types.forEach(function(probeType, i){
      if(probeType==2) _this.units[i] = _this.units[i] == 0? 1 : 0;
    })

    var data="\ntype=4";
    for (var i=1;i<=5;i++) { 
      data=data+"\nc"+i+"e="+enabled[i]
      data=data+"\nc"+i+"n="+names[i]
      data=data+"\nc"+i+"i="+this.units[i];
      data=data+"\nc"+i+"t="+types[i];
      data=data+"\nc"+i+"r="+roms[i];
    }
    data=data+"\n";

    http_request=new XMLHttpRequest()
    http_request.ontimeout = function(){
      utils.log("switchUnit: timeout", _this.config._id, _this.config.host);
    }
    http_request.onreadystatechange=function(){
      if(http_request.readyState==4) {
        if(http_request.status==200) {
          
          var code = /<code>(.*?)<\/code>/.exec(http_request.responseText)[1];
          if(code && code !=="") {
            
            var text = "";
            switch(code) {
              case "3"  : text="Access denied. Please restart your browser."; break;
              case "4"  : text="Message rejected by the device."; break;
              case "450": text="Message accepted. Configuration didn't change: " + JSON.stringify(_this.units); break;
              case "451": text="Message accepted. Configuration saved: " + JSON.stringify(_this.units); break;
              case "402": text="Wrong channel 1 name!"; break;
              case "407": text="Wrong channel 2 name!"; break;
              case "412": text="Wrong channel 3 name!"; break;
              case "417": text="Wrong channel 4 name!"; break;
              case "422": text="Wrong channel 5 name!"; break;
              default:    text="Unexpected code - "+code; break;
             }
            
            if(code!="451") utils.log("switchUnit:", text, _this.config._id, _this.config.host);
            if(cb) cb(code);
          } else {
            utils.log("switchUnit: Wrong XML element <code>!", _this.config._id, _this.config.host);
          }
        } else {
          utils.log("switchUnit: AJAX callback error:", http_request.status, _this.config._id, _this.config.host);
        }
      }
    }

    http_request.open("POST","http://"+this.config.host+":80/config.xml",true);
    http_request.timeout = 1000;
    http_request.send(data);
  }
}

module.exports = SNMPInstance;