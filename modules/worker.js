/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let DEBUG = 1;
function debug(s) {
  if (DEBUG) {
    dump("-*- adb service worker: " + s + "\n");
  }
}

var device = '';
var ADB_PATH = '';
var LOCAL_PORT = 10010;
var REMOTE_PORT = 10010;
let detectingInterval = null;

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

    moveAdb: function() {
      if (runCmd != null) {
        if (ADB_PATH != '') {
          var oldPath = ADB_PATH;
          ADB_PATH = oldPath.replace('extensions\\ffosassistant@mozillaonline.com\\components\\binary\\win\\adb.exe', 'adb.exe')
          runCmd('cmd.exe /c copy/Y ' + oldPath.replace('adb.exe', 'AdbWinApi.dll') + '/B '+ ADB_PATH.replace('adb.exe', 'AdbWinApi.dll') + '/B');
          runCmd('cmd.exe /c copy/Y ' + oldPath.replace('adb.exe', 'AdbWinUsbApi.dll') + '/B '+ ADB_PATH.replace('adb.exe', 'AdbWinUsbApi.dll') + '/B');
          return runCmd('cmd.exe /c copy/Y ' + oldPath + '/B '+ ADB_PATH + '/B');
        }
      }
      return null;
    },

    findDevice: function() {
      if (runCmd != null) {
        if (ADB_PATH != '') {
          return runCmd(ADB_PATH + ' devices');
        }
      }
      return null;
    },

    setupDevice: function() {
      var ret =null;
      if (runCmd != null) {
        if (ADB_PATH != '') {
          if (device != '') {
            ret = runCmd(ADB_PATH + ' -s ' + device + ' forward tcp:' + LOCAL_PORT + ' tcp:' + REMOTE_PORT);
          } else {
            ret = runCmd(ADB_PATH + ' forward tcp:' + LOCAL_PORT + ' tcp:' + REMOTE_PORT);
          }
        }
      }
      return ret;
    },

    startAdbServer: function() {
      if (runCmd != null) {
        if (ADB_PATH != '') {
          return runCmd(ADB_PATH + ' start-server');
        }
      }
      return null;
    },

    killAdbServer: function() {
      debug('killAdbServer ' + ADB_PATH);
      debug('killAdbServer ' + runCmd);
      if (runCmd != null) {
        if (ADB_PATH != '') {
          return runCmd(ADB_PATH + ' kill-server');
        }
      }
      return null;
    },

    listAdbService: function() {
      if (runCmd) {
        var pinfo = runCmd('cmd.exe /c netstat -ano | findstr 5037');
        var plisten = pinfo.indexOf("LISTENING");
        if (plisten > 0) {
          var pid = plisten.substring("LISTENING", "\r\n");
          return runCmd('cmd.exe /c Tasklist | findstr ' + pid);
        }
      }
      return null;
    },

    runLocalCmd: function(cmd) {
      if (!cmd) {
        return null;
      }

      var commands = cmd.split(' ');
      switch (commands[0]) {
      case 'adb':
        {
          if (ADB_PATH) {
            if (device) {
              commands[0] = ADB_PATH + ' -s ' + device;
            }
            let result = runCmd(commands.join(' ')).readString().trim();
            return result;
          }
          return null;
        }
      case 'listAdbService':
        {
          return this.listAdbService();
        }
      default:
        return 'not supported';
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
  case 'findDevice':
    postMessage({
      id: id,
      result: libadb.findDevice().readString().trim()
    });
    break;
  case 'setupDevice':
    let result;
    let ret = libadb.setupDevice().readString().trim();
    if ((ret.indexOf("error") > 0) || (ret.indexOf("failed") > 0)) result = false;
    else
    result = true;
    postMessage({
      id: id,
      result: result
    });
    setConnected( !! result);
    break;
  case 'startAdbServer':
    libadb.startAdbServer();
    break;
  case 'killAdbServer':
    libadb.killAdbServer();
    break;
  case 'initAdbService':
    initAdbService(e.data.isWindows,e.data.libPath, e.data.adbPath);
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

  if ((oldState !== connected) || ( oldState && connected)) {
    debug('Connection state is changed!');
    postMessage({
      cmd: 'statechange',
      connected: connected,
      device: device
    });
  }
}

function initAdbService(isWindows, libPath, adbPath) {
  // Load adb service library
  libadb.loadLib(libPath);
  // Set the path of adb executive file
  ADB_PATH = adbPath;
  if(isWindows){
    //change adb to profiles
    libadb.moveAdb();
  }
}

function startDetecting(start) {
  debug('startDetecting = ' + start);
  if (detectingInterval) {
    clearInterval(detectingInterval);
    detectingInterval = null;
  }

  if (start) {
    libadb.startAdbServer();
    detectingInterval = setInterval(function checkConnectState() {
      var devices = libadb.findDevice().readString().trim();
      // TODO: hard coded for full_unagi only now, try to add other devices
      var sigstr = 'List of devices attached';//in windows need cat ' \r\n',in linux need cat ' \n'
      var devstr = '\tdevice';
      var splitestr = '\n';
      var indexStart = devices.indexOf(sigstr);
      debug('startDetecting indexStart = ' + indexStart);
      if (indexStart < 0) {
        setConnected(false);
        return;
      } 
      devices = devices.substring(indexStart + sigstr.length, devices.length);
      indexStart = devices.indexOf(splitestr);
      if (indexStart < 0) {
        setConnected(false);
        return;
      }
      devices = devices.substring(indexStart + splitestr.length, devices.length);
      var indexEnd = devices.indexOf(devstr);
      debug('startDetecting indexEnd = ' + indexEnd);
      if (indexEnd < 0) {
        setConnected(false);
        return;
      }
      device = devices.substring(0, indexEnd);
      debug(device);
      var ret = libadb.setupDevice(device).readString().trim();
      if ((ret.indexOf("error") > 0) || (ret.indexOf("failed") > 0)) {
        setConnected(false);
      } else {
        setConnected(true);
      }
    }, 2000);
  }
}
debug('ADB Service worker is inited.');
