var utils = require('./utils.js');

function LowPassFilter(config){
  var cfg = {};
  (config || [{
    _id: "defaults",
    lowpassWeights: [0.5,0.5],
    lowpassTolerance: 0.1,
  }]).forEach((d)=>{cfg[d._id] = d});
  
  var previous = {};
  this.previous = function(arg){
    if (!arguments.length) return previous;
    previous = arg;
    return this;
  };
  
  var weights =     (id) => cfg[id].lowpassWeights;
  var length =      (id) => cfg[id].lowpassWeights.length;
  var tolerance =   (id) => cfg[id].lowpassTolerance;
  
  this.save = function(id, time, value){
    if(!previous[id]) previous[id] = [];
    previous[id].push({value: value, time: time});
    if(previous[id].length > length(id))previous[id].splice(0, 1);
  }
  
  this.run = function(id, time, value){
    var _this = this;
    if(!cfg[id]) cfg[id] = Object.assign({}, cfg["defaults"], cfg[id]);
    let result = {value: -11103, significant: true};
            
    //check if we have accumulated the previous values
    if(previous[id] && previous[id].length == length(id)){
      //if yes, compute the average
      let avg = 0;
      previous[id].forEach((p,i)=>{avg += p.value * weights(id)[i];})
      result.value = value;
      
      //if current value is within the tolerance around average then update is not significant
      if((avg - tolerance(id) <= value) && (value <= avg + tolerance(id))) result.significant = false;
    }
    
    this.save(id, time, result.value);
    return result;
  }
}

module.exports = LowPassFilter;