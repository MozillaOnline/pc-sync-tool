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

var libadb = (function() {
  let library = null;
  let findDevice = null;
  let setupDevice = null;
  let setupPath = null;

  return {
    loadLib: function(path) {
      debug('Lib path: ' + path);
      if (library) {
        return;
      }

      library = ctypes.open(path);
      findDevice  = library.declare('findDevice',  ctypes.default_abi, ctypes.char.ptr);
      setupDevice = library.declare('setupDevice', ctypes.default_abi, ctypes.int, ctypes.char.ptr);
      setupPath   = library.declare('setupPath',   ctypes.default_abi, ctypes.void_t, ctypes.char.ptr);
      runadbcmd   = library.declare('runadbcmd',   ctypes.default_abi, ctypes.char.ptr, ctypes.char.ptr);
    },

    findDevice: function() {
      if (findDevice) {
        return findDevice();
      }

      return 0;
    },

    setupDevice: function() {
      if (setupDevice) {
        if (device != '')
          return setupDevice(device);
      }
      return 0;
    },

    setupPath: function(adbPath) {
      if (setupPath) {
        return setupPath(adbPath);
      }
      return;
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
      libadb.setupPath(e.data.adbPath);
      ADB_PATH = e.data.adbPath;
      postMessage({
        id: id,
        result: true
      });
      break;
    case 'findDevice':
      postMessage({
        id: id,
        result: libadb.findDevice()
      });
      break;
    case 'setupDevice':
      let result = libadb.setupDevice();
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
      cmd = ADB_PATH + ' ' + e.data.data;
      libadb.runadbcmd(cmd);
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
      var ret = libadb.setupDevice(device);
      if (!libadb.setupDevice(device)) {
        setConnected(false);
      } else {
        setConnected(true);
      }
    }, 2000);
  }
}

startDetecting(true);
debug('ADB Service worker is inited.');

