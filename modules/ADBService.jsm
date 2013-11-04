/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 1;

debug = function(s) {
  if (DEBUG) {
    dump("-*- adbService module: " + s + "\n");
  }
};

var EXPORTED_SYMBOLS = ['ADBService'];

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "ppmm", "@mozilla.org/parentprocessmessagemanager;1", "nsIMessageListenerManager");

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://ffosassistant/utils.jsm');

let connected = false;
let isWifiConnected = false;
let ffosDeviceName = 'Unknown';
let libWorker = null;
let serverPort = 10010;

function worker_onMessage(e) {
  let data = e.data;
  let callback = callbacks[data.id];

  if (callback) {
    delete callbacks[data.id];
    callback(data);
  } else {
    messageReceiver.handleWorkerMessage(data);
  }
}

// Auto-increament id for messages
let idgen = 0;
// Message callbacks
let callbacks = {};

function controlMessage(msg, callback) {
  let id = ++idgen;
  msg.id = id;

  if (callback) {
    callbacks[id] = callback;
  }

  libWorker.postMessage(msg);
}

// Create chrome worker to load adbservice lib
const WORKER_FILE = 'resource://ffosassistant/worker.js';
let libWorker = new ChromeWorker(WORKER_FILE);
libWorker.onmessage = worker_onMessage;

let messageReceiver = {
  receiveMessage: function msgRev_receiveMessage(aMessage) {
    let msg = aMessage.json || {};
    msg.manager = aMessage.target;

    var self = this;
    switch (aMessage.name) {
    case 'ADBService:connected':
      return connected;
    case 'ADBService:ffosDeviceName':
      return ffosDeviceName;
    case 'ADBService:disconnect':
      // Not implemented
      this._sendMessage('ADBService:disconnect:Return', false, null, msg);
      break;
    case 'ADBService:RunCmd':
      self = this;
      controlMessage({
        cmd: 'RunCmd',
        data: msg.data
      }, function Result_RunCmd(data) {
        self._sendMessage('ADBService:RunCmd:Return', true, data.result, msg);
      });
      break;
    case 'ADBService:getWifiConnectionState':
      return isWifiConnected;
      break;
    case 'ADBService:setWifiConnectionState':
      isWifiConnected = msg.state;
      ADBService.startDeviceDetecting(!isWifiConnected);
      break;
    case 'ADBService:switchConnectionMode':
      if (msg.mode == 'USB' && connected) {
        return;
      }
      if (msg.mode == 'WIFI' && isWifiConnected) {
        return;
      }
      ppmm.broadcastAsyncMessage('ADBService:statechange', {
        mode: msg.mode,
        connected: true,
        serverip: msg.serverip,
        port: serverPort
      });
      break;
    }
    return null;
  },

  handleWorkerMessage: function msgRev_handleWorkerMessage(msg) {
    let cmd = msg.cmd;
    switch (cmd) {
    case 'statechange':
      // Update ADB forward state
      connected = msg.connected;
      ffosDeviceName = msg.device;
      ppmm.broadcastAsyncMessage('ADBService:statechange', {
        mode: 'USB',
        connected: connected,
        serverip: msg.serverip,
        port: serverPort
      });
      break;
    default:
      break;
    }
  },

  _sendMessage: function(message, success, data, msg) {
    msg.manager.sendAsyncMessage(message + (success ? ":OK" : ":NO"), {
      data: data,
      rid: msg.rid,
      mid: msg.mid
    });
  }
};

const messages = ['ADBService:connected', 'ADBService:ffosDeviceName', 'ADBService:RunCmd', 'ADBService:setWifiConnectionState',
                  'ADBService:getWifiConnectionState', 'ADBService:switchConnectionMode'];
messages.forEach(function(msgName) {
  ppmm.addMessageListener(msgName, messageReceiver);
});

var ADBService = {
  initAdbService: function initAdbService(isWindows, libPath, adbPath) {
    controlMessage({
      cmd: 'initAdbService',
      isWindows: isWindows,
      libPath: libPath,
      adbPath: adbPath
    });
  },

  startDeviceDetecting: function startDeviceDetecting(start) {
    controlMessage({
      cmd: 'startDeviceDetecting',
      start: start
    });
  },

  startAdbServer: function startAdbServer() {
    controlMessage({
      cmd: 'startAdbServer'
    });
  },

  killAdbServer: function killAdbServer() {
    controlMessage({
      cmd: 'killAdbServer'
    });
  }
};

debug('ADBService module is inited.');
