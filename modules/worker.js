/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- adb service worker: " + s + "\n"); };
else
  debug = function (s) { };

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
      findDevice  = library.declare('findDevice',  ctypes.default_abi, ctypes.int);
      setupDevice = library.declare('setupDevice', ctypes.default_abi, ctypes.int);
      setupPath   = library.declare('setupPath',   ctypes.default_abi, ctypes.void_t, ctypes.char.ptr);
    },

    findDevice: function() {
      if (findDevice) {
        return findDevice();
      }

      return 0;
    },

    setupDevice: function() {
      if (setupDevice) {
        return setupDevice();
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

setInterval(function checkConnectState() {
  if (!libadb.findDevice()) {
    setConnected(false);
  } else if (!libadb.setupDevice()) {
    setConnected(false);
  } else {
    setConnected(true);
  }
}, 2000);

debug('ADB Service worker is inited.');

