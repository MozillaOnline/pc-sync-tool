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

  return {
    loadLib: function(path) {
      debug('Lib path: ' + path);
      if (library) {
        return;
      }

      library = ctypes.open(path);
      findDevice = library.declare('findDevice', ctypes.default_abi, ctypes.int);
      setupDevice = library.declare('setupDevice', ctypes.default_abi, ctypes.int);
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
      libadb.loadLib(e.data.path);
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
      connected = !!result;

      postMessage({
        id: id,
        result: result
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

setInterval(function checkConnectState() {
  let oldState = connected;

  if (!libadb.findDevice()) {
    connected = false;
  } else if (!libadb.setupDevice()) {
    connected = false;
  } else {
    connected = true;
  }

  if (oldState !== connected) {
    debug('Connection state is changed!');
    postMessage({
      cmd: 'statechange',
      connected: connected
    });
  }
}, 2000);

debug('ADB Service worker is inited.');

