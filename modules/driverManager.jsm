/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- DriverManager: " + s + "\n"); };
else
  debug = function (s) { };

var EXPORTED_SYMBOLS = ['DriverManager'];

const MANAGER_EXE = 'resource://ffosassistant-drivermanager';
const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://ffosassistant/utils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, "ParentModule", "resource://ffosassistant/parentModule.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "WinMutex", "resource://ffosassistant/WinMutex.jsm");

var driverManagerModule = new ParentModule({
  messages: ['DriverManager:isRunning', 'DriverManager:start'],

  onmessage: function dm_onmessage(name, msg) {
    debug('Receive message:' + name);
    var self = this;

    switch (name) {
      // This is a sync message
      case 'DriverManager:isRunning':
        return isDriverManagerRunning();
      case 'DriverManager:start':
        startDriverManager();
        break;
    }
  }
});

let process = null;
const DM_MUTEX_NAME = "FirefoxOS USB Daemon";

function isDriverManagerRunning() {
  try {
    // Trying to get and release the MUTEX which is supposed to
    // be acquired by DriverManager, if failed, then it means the
    // Driver Manager is running.
    let mutex = new WinMutex(DM_MUTEX_NAME);
    mutex.release();
    mutex.close();
  } catch (e) {
    return true;
  }

  return false;
}

function startDriverManager() {
  if (isDriverManagerRunning()) {
    debug("The process is already running.");
    return;
  }

  var managerFile = utils.getChromeFileURI(MANAGER_EXE).file;
  process = Cc['@mozilla.org/process/util;1']
              .createInstance(Ci.nsIProcess);
  process.init(managerFile);
  var args = ['install'];
  process.runAsync(args, args.length, processObserver);
}

var processObserver = {
  observe: function observe(aSubject, aTopic, aData) {
    debug('subject:' + aSubject + ', topic:' + aTopic + ', data: ' + aData);
  }
};

debug("inited.");

