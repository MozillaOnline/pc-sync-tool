/* This Source Code Form is subject to the terms of the Mozilla Public
 * * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 0;

function debug(s) {
  if (DEBUG) {
    dump("-*- DriverManager: " + s + "\n");
  }
}

var EXPORTED_SYMBOLS = ['DriverManager'];

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://ffosassistant/utils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, "WinMutex", "resource://ffosassistant/WinMutex.jsm");

var DriverManager = {
  managerExe: 'resource://ffosassistant-drivermanager',
  dmMutexName: 'FirefoxOS USB Daemon',
  process: null,
  processObserver: {
    observe: function observe(aSubject, aTopic, aData) {
      debug('subject:' + aSubject + ', topic:' + aTopic + ', data: ' + aData);
    }
  },

  isDriverManagerRunning: function isDriverManagerRunning() {
    return WinMutex(this.dmMutexName);
  },

  startDriverManager: function startDriverManager() {
    var isRunning = this.isDriverManagerRunning();
    if (isRunning == 'false') {
      var managerFile = utils.getChromeFileURI(this.managerExe).file;
      this.process = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
      this.process.init(managerFile);
      var args = ['install'];
      this.process.runAsync(args, args.length, this.processObserver);
    }
  }
};

debug("driverManager inited.");
