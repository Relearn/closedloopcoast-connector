#!/bin/bash
# Switch to the directory with the project
cd /home/pi/closedloopcoast-modbus-connector/
# Update nodejs
sudo apt install nodejs
# Get the latest code from github
git pull origin master
# Fetch dependencies if there are updates and install them
npm install
# Start node app as a user pi
su pi -c 'screen -dm -S closedloopcoast node /home/pi/closedloopcoast-modbus-connector/index.js < /dev/null &'