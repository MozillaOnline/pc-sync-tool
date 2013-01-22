/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- adbService module: " + s + "\n"); };
else
  debug = function (s) { };

var EXPORTED_SYMBOLS = [];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
const LIB_FILE_URL = 'resource://ffosassistant-components/libadbservice.so';

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "ppmm",
                                   "@mozilla.org/parentprocessmessagemanager;1",
                                   "nsIMessageListenerManager");

XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');

let connected = false;
let libWorker = null;

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

function startADBForward(onsuccess, onerror) {
  onsuccess = onsuccess || function() {};
  onerror = onerror || function() {};

  let fileUri = Services.io.newURI(LIB_FILE_URL, null, null);
  if (!(fileUri instanceof Ci.nsIFileURL)) {
    onerror();
    return;
  }

  controlMessage({
    cmd: 'loadlib',
    path: fileUri.file.path
  }, function callback_loadlib(data) {
    if (!data.result) {
      onerror();
      return;
    }

    controlMessage({
      cmd: 'setupDevice'
    }, function callback_setupDevice(data) {
      debug('Setup device result: ' + data.result);
      if (!data.result) {
        onerror();
      } else {
        onsuccess();
      }
    });
  });
}

let messageReceiver = {
  receiveMessage: function msgRev_receiveMessage(aMessage) {
    let msg = aMessage.json || {};
    msg.manager = aMessage.target;

    var self = this;
    switch (aMessage.name) {
      case 'ADBService:connected':
        // This message is sync
        return connected;
      case 'ADBService:connect':
        startADBForward(function onsuccess() {
          connected = true;
          self._sendMessage('ADBService:connect:Return', true, null, msg);
        }, function onerror() {
          connected = false;
          self._sendMessage('ADBService:connect:Return', false, null, msg);
        });
        break;
      case 'ADBService:disconnect':
        // Not implemented
        this._sendMessage('ADBService:disconnect:Return', false, null, msg);
        break;
    }
  },

  handleWorkerMessage: function msgRev_handleWorkerMessage(msg) {
    let cmd = msg.cmd;
    switch (cmd) {
      case 'statechange':
        // Update ADB forward state
        connected = msg.connected;
        ppmm.broadcastAsyncMessage('ADBService:statechange', { });
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
  },
};

const messages = ['ADBService:connect', 'ADBService:connected'];
messages.forEach(function(msgName) {
  ppmm.addMessageListener(msgName, messageReceiver);
});

// Tell the worker to load lib and forward
startADBForward();
debug('ADBService module is inited.');

