/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

Components.utils.import("resource://gre/modules/devtools/Devices.jsm");
const {devtools} = Components.utils.import("resource://gre/modules/devtools/Loader.jsm", {});
const {require} = devtools;
const adbStore = require("devtools/app-manager/builtin-adb-store");

let DEBUG = 0;

debug = function(s) {
  if (DEBUG) {
    dump("-*- adbService module: " + s + "\n");
  }
};

var EXPORTED_SYMBOLS = ['ADBService'];

var ADBService = {
  init: function(callback) {
    adbStore.on('set', function(event, path, value) {
      if (path[0] !== 'devices') {
        return;
      }

      callback(Devices.available());
    });
  },

  setupDevice: function(name) {
    let device = Devices.getByName(name);
    device.forwardPort('tcp:25679', 'tcp:25679');
  },

  getAvailable: function() {
      return Devices.available();
  }
};
