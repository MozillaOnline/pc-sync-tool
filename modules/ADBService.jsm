/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 0;

debug = function(s) {
  if (DEBUG) {
    dump("-*- adbService module: " + s + "\n");
  }
};

var EXPORTED_SYMBOLS = ['ADBService'];

// Create chrome worker to load adbservice lib
const WORKER_FILE = 'resource://ffosassistant/worker.js';
let libWorker = new ChromeWorker(WORKER_FILE);
libWorker.onmessage = worker_onMessage;
// Auto-increament id for messages
let idgen = 0;
// Message callbacks
let callbacks = {};

function worker_onMessage(e) {
  let data = e.data;
  let callback = callbacks[data.id];
  if (callback) {
    if (!data.noDelete) {
      delete callbacks[data.id];
    }
    if (!data.noCallback) {
      callback(data);
    }
  }
}

function controlMessage(msg, callback) {
  let id = ++idgen;
  msg.id = id;

  if (callback) {
    callbacks[id] = callback;
  }
  libWorker.postMessage(msg);
}

var ADBService = {
  initAdbService: function initAdbService(isWindows, libPath, adbPath, profilePath) {
    controlMessage({
      cmd: 'initAdbService',
      isWindows: isWindows,
      libPath: libPath,
      adbPath: adbPath,
      profilePath: profilePath
    });
  },

  findDevice: function findDevice(callback) {
    controlMessage({
      cmd: 'findDevice'
    }, callback);
  },

  setupDevice: function setupDevice(device, callback) {
    controlMessage({
      cmd: 'setupDevice',
      device: device
    }, callback);
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
  },

  runCmd: function runCmd(cmd, callback) {
    controlMessage({
      cmd: 'RunCmd',
      data: cmd
    }, callback);
  },

  checkDevice: function(enable, isMac, devices, callback) {
    controlMessage({
      cmd: 'checkDevice',
      enable: enable,
      isMac: isMac,
      devices: devices
    }, callback);
  },
};

debug('ADBService module is inited.');
