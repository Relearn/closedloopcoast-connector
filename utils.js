var dateFormat = require('dateformat');

function utils() {
  return {
    log: function(message){
      message = Array.prototype.slice.call(arguments)
        .map(function(m){return m instanceof Object? JSON.stringify(m, null, 4) : m })
        .join(' ');
      message = dateFormat(new Date, "yymmdd-HH:MM:ss.l") + " - " + message;
      if(console && typeof console.log === 'function') console.log(message);
      return true;
    },
    error: function(error){
      console.error(error);
      return true;
    }
  }
}

module.exports = utils();