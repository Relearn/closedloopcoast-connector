# closedloopcoast-connector
A node.js application to collect data from different sources and upload it online to a DB

### installing  
Clone this repo  
Run `npm install`

### using
Run `node index.js`  
On a headless Linux device you probably want to send the app to background when starting it. In this case run `screen node index.js`. If you want the app to start automatically when computer starts, use the provided script in file `onboot.sh`.

### configuring
Most configuration is done in this mongo database: https://mlab.com/databases/closedloopconfig

### developing
Run `npm install -g devtool` to install devtools  
Run `devtool app.js --watch`  
For more info: [See how to debug node.js app with Crome](https://mattdesl.svbtle.com/debugging-nodejs-in-chrome-devtools)
