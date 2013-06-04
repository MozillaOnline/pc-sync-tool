/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- adb service worker: " + s + "\n"); };
else
  debug = function (s) { };

var device = '';
var ADB_PATH = '';
var LOCAL_PORT = 10010;
var REMOTE_PORT = 10010;

var libadb = (function() {
  let library = null;
  let runCmd = null;

  return {
    loadLib: function(path) {
      debug('Lib path: ' + path);
      if (library) {
        return;
      }
      library = ctypes.open(path);
      runCmd = library.declare('runCmd', ctypes.default_abi, ctypes.char.ptr, ctypes.char.ptr);
    },

    findDevice: function() {
      if(runCmd != null){
        if(ADB_PATH != ''){
	  return runCmd(ADB_PATH +' devices');
        }
      }
      return null;
    },

    setupDevice: function() {
      if(runCmd != null){
        if(ADB_PATH != ''){
          if(device != '')
            return runCmd(ADB_PATH + ' -s ' + device + ' forward tcp:' + LOCAL_PORT + ' tcp:' + REMOTE_PORT);
          else
            return runCmd(ADB_PATH  + ' forward tcp:' + LOCAL_PORT + ' tcp:' + REMOTE_PORT);
        }
      }
      return null;
    },
    
    pullFile: function(sfilepath,dfilepath) {
      if(runCmd != null){
        if(ADB_PATH != ''){
          if(device != '')
            return runCmd(ADB_PATH + ' -s ' + device + ' pull ' + sfilepath + '  ' + dfilepath);
          else
            return runCmd(ADB_PATH  + ' pull ' + sfilepath + '  ' + dfilepath);
        }
      }
      dump('return null');
      return null;
    },

    pushFile: function(sfilepath,dfilepath) {
      if(runCmd != null){
        if(ADB_PATH != ''){
          if(device != '')
            return runCmd(ADB_PATH + ' -s ' + device + ' push ' + sfilepath + '  ' + dfilepath);
          else
            return runCmd(ADB_PATH  + ' push ' + sfilepath + '  ' + dfilepath);
        }
      }
      return NULL;
    },
    
    listAdbService: function() {
      if(runCmd != NULL){
        var pinfo = runCmd('cmd.exe /c netstat -ano | findstr 5037');
        var plisten = pinfo.indexOf("LISTENING");
        if(plisten > 0 ){
	  var pid = plisten.substring("LISTENING","\r\n");
	  return runCmd('cmd.exe /c Tasklist | findstr ' + pid);
        }
        return null;
      }
    },

    runLocalCmd: function (cmd) {
      var commands = cmd.split(' ');
      if (commands[0] == 'adb') {
        if (commands[1] == 'push') {
          return this.pushFile(commands[2], commands[3]).readString().trim();
        }
        if (commands[1] == 'pull') {
          return this.pullFile(commands[2], commands[3]).readString().trim();
        }
      }
    }
  };
})();

let connected = false;

self.onmessage = function(e) {
  debug('Receive message: ' + e.data.cmd);
  let id = e.data.id;
  let cmd = e.data.cmd;
  switch (cmd) {
    case 'loadlib':
      // Load adb service library
      libadb.loadLib(e.data.libPath);
      // Set the path of adb executive file
      ADB_PATH = e.data.adbPath;
      postMessage({
        id: id,
        result: true
      });
      break;
    case 'findDevice':
      postMessage({
        id: id,
        result: libadb.findDevice().readString().trim()
      });
      break;
    case 'setupDevice':
      let result;
      let ret = libadb.setupDevice().readString().trim();
      if((ret.indexOf("error") > 0) || (ret.indexOf("failed") > 0))
		result = false;
	  else
	    result = true;
      postMessage({
        id: id,
        result: result
      });
      setConnected(!!result);
      break;
    case 'startDeviceDetecting':
      startDetecting(e.data.start);
      break;
    case 'RunCmd':
      cmd = e.data.data;
      postMessage({
        id: id,
        result: libadb.runLocalCmd(cmd)
      });
      break;
    default:
      postMessage({
        id: id,
        message: 'No handle for \'' + cmd + '\''
      });
      break;
  }
};

/**
 * Change connected state, and send 'statechange' message if changed.
 */
function setConnected(newState) {
  let oldState = connected;
  connected = newState;

  if (oldState !== connected) {
    debug('Connection state is changed!');
    postMessage({
      cmd: 'statechange',
      connected: connected
    });
  }
}

let detectingInterval = null;
function startDetecting(start) {
  if (detectingInterval) {
    clearInterval(detectingInterval);
    detectingInterval = null;
  }

  if (start) {
    detectingInterval = setInterval(function checkConnectState() {
      var devices = libadb.findDevice().readString().trim();
      //todo: hard coded for full_unagi only now, try to add other devices
      if (devices.indexOf('full_unagi') == -1) {
        setConnected(false);
      } else
      device = 'full_unagi';
      var ret = libadb.setupDevice(device).readString().trim();
      
      if ((ret.indexOf("error") > 0) || (ret.indexOf("failed") > 0)) {
        setConnected(false);
      } else {
        setConnected(true);
      }
    }, 2000);
  }
}

startDetecting(true);
debug('ADB Service worker is inited.');

