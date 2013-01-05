/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict"

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- adbService: " + s + "\n"); };
else
  debug = function (s) { };

const LOCAL_PORT = 6666;

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const ADBSERVICE_CONTRACT_ID = '@mozilla.org/adbservice;1';
const ADBSERVICE_CID = Components.ID('{ed7c329e-5b45-4e99-bdae-f4d159a8edc8}');

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, 'ctypes', 'resource://gre/modules/ctypes.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');

XPCOMUtils.defineLazyGetter(this, 'libadb', function() {
  // TODO open platform related library.
  let fileUri = Services.io.newURI('resource://adbservice-components/libadbservice.so', null, null);

  if (fileUri instanceof Ci.nsIFileURL) {
    let library = ctypes.open(fileUri.file.path);
    return {
      findDevice: library.declare('findDevice', ctypes.default_abi, ctypes.int),
      setupDevice: library.declare('setupDevice', ctypes.default_abi, ctypes.int)
    };
  } else {
    return {
      findDevice: function libadb_fake_findDevice() {
        return 0;
      },

      setupDevice: function libadb_fake_setupDevice() {
        return 0;
      }
    };
  }
});

function ADBService() { }

ADBService.prototype = {
  classID: ADBSERVICE_CID,

  classInfo: XPCOMUtils.generateCI({
               classID: ADBSERVICE_CID,
               contractID: ADBSERVICE_CONTRACT_ID,
               classDescription: "adbService",
               interfaces: [Ci.nsIADBService],
               flags: Ci.nsIClassInfo.DOM_OBJECT
             }),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIADBService, Ci.nsIDOMGlobalPropertyInitializer]),

  // nsIDOMGlobalPropertyInitializer implementation
  init: function(aWindow) {
    // TODO add privileges checking
  },

  /* implementation */
  hello: function() {
    debug('Hello world');
    try {
      let ret = libadb.findDevice();
      debug('return value: ' + ret);
    } catch (e) {
      debug('Error occurs when invoking lib: ' + e);
    }
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([ADBService]);

