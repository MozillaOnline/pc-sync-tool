/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let DEBUG = 0;

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

    copyAdb: function() {
      if (runCmd && ADB_PATH != '') {
        var oldPath = ADB_PATH;
        ADB_PATH = oldPath.replace('extensions\\ffosassistant@mozillaonline.com\\components\\binary\\win\\adb.exe', 'ffosadb.exe')
        runCmd('cmd.exe /c copy/Y ' + oldPath.replace('adb.exe', 'AdbWinApi.dll') + '/B ' + ADB_PATH.replace('ffosadb.exe', 'AdbWinApi.dll') + '/B');
        runCmd('cmd.exe /c copy/Y ' + oldPath.replace('adb.exe', 'AdbWinUsbApi.dll') + '/B ' + ADB_PATH.replace('ffosadb.exe', 'AdbWinUsbApi.dll') + '/B');
        runCmd('cmd.exe /c copy/Y ' + oldPath + '/B ' + ADB_PATH + '/B');
      }
      return;
    },

    findDevice: function() {
      var ret = null;
      if (runCmd && ADB_PATH != '') {
        ret = runCmd(ADB_PATH + ' devices');
        if (ret) {
          return ret.readString().trim();
        }
      }
      return ret;
    },

    setupDevice: function() {
      var ret = null;
      if (runCmd && ADB_PATH != '') {
        if (device != '') {
          ret = runCmd(ADB_PATH + ' -s ' + device + ' forward tcp:' + LOCAL_PORT + ' tcp:' + REMOTE_PORT);
        } else {
          ret = runCmd(ADB_PATH + ' forward tcp:' + LOCAL_PORT + ' tcp:' + REMOTE_PORT);
        }
        if (ret) {
          return ret.readString().trim();
        }
      }
      return ret;
    },

    startAdbServer: function() {
      var ret = null;
      if (runCmd && ADB_PATH != '') {
        ret = runCmd(ADB_PATH + ' start-server');
        if (ret) {
          return ret.readString().trim();
        }
      }
      return ret;
    },

    killAdbServer: function() {
      var ret = null;
      if (runCmd && ADB_PATH != '') {
        ret = runCmd(ADB_PATH + ' kill-server');
        if (ret) {
          return ret.readString().trim();
        }
      }
      return ret;
    },

    listAdbService: function() {
      var ret = null;
      if (!runCmd) {
        return null;
      }
      var pinfo = runCmd('cmd.exe /c netstat -ano | findstr 5037');
      if (pinfo) {
        pinfo = pinfo.readString().trim();
        var listenString = 'LISTENING';
        var plisten = pinfo.indexOf(listenString);
        if (plisten > 0) {
          var pid = pinfo.substring(plisten + listenString.length, pinfo.length);
          if (pid) {
            pid = pid.split('\r\n');
            ret = runCmd('cmd.exe /c Tasklist | findstr ' + pid[0]);
            if (ret) {
              return ret.readString().trim();
            }
          }
        }
      }
      return ret;
    },

    runLocalCmd: function(cmd) {
      if (!cmd) {
        return null;
      }

      var commands = cmd.split(' ');
      switch (commands[0]) {
      case 'adb':
        if (ADB_PATH) {
          if (device) {
            commands[0] = ADB_PATH + ' -s ' + device;
          }
          let result = runCmd(commands.join(' '));
          if (result) {
            result = result.readString().trim();
          }
          return result;
        }
        return null;
      case 'listAdbService':
        return this.listAdbService();
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
      result: libadb.findDevice()
    });
    break;
  case 'setupDevice':
    let ret = libadb.setupDevice();
    let result = !/error|failed/ig.test(ret);
    postMessage({
      id: id,
      result: result
    });
    setConnected(result);
    break;
  case 'startAdbServer':
    libadb.startAdbServer();
    break;
  case 'killAdbServer':
    libadb.killAdbServer();
    break;
  case 'initAdbService':
    initAdbService(e.data.isWindows, e.data.libPath, e.data.adbPath);
    break;
  case 'startDeviceDetecting':
    startDetecting(e.data.start);
    break;
  case 'RunCmd':
    postMessage({
      id: id,
      result: libadb.runLocalCmd(e.data.data);
    });
    break;
  default:
    postMessage({
      id: id,
      message: 'No handle for "' + cmd + '"'
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
      connected: connected,
      device: device,
      serverip: 'localhost'
    });
  }
}

function initAdbService(isWindows, libPath, adbPath) {
  // Load adb service library
  libadb.loadLib(libPath);
  // Set the path of adb executive file
  ADB_PATH = '"' + adbPath + '"';
  if (isWindows) {
    // Move adb to profiles, so the addon can be removed when adb is running.
    libadb.copyAdb();
  }
}

function startDetecting(start) {
  debug('startDetecting = ' + start);
  if (detectingInterval) {
    clearInterval(detectingInterval);
    detectingInterval = null;
  }

  if (!start) {
    return;
  }

  libadb.startAdbServer();
  detectingInterval = setInterval(function checkConnectState() {
    var devicesStr = libadb.findDevice();

    var regExp = /\n([0-9a-z]+)\tdevice/ig;
    var devices = [];
    var result = null;
    while(result = regExp.exec(devicesStr)){
      devices.push(result[1]);
    }

    if (devices.length == 0) {
      setConnected(false);
      return;
    }
    // TODO: Select the first device now. If multi-devices plugged-in, it should
    // popup a dialog for users to choose which device would be connected.
    device = devices[0];
    debug(device);
    var ret = libadb.setupDevice(device);
    setConnecte(!/error|failed/ig.test(ret));
  }, 2000);
}

debug('ADB Service worker is inited.');
