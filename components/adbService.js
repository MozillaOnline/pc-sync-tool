/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict"

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- adbService: " + s + "\n"); };
else
  debug = function (s) { };

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const ADBSERVICE_CONTRACT_ID = '@mozilla.org/adbservice;1';
const ADBSERVICE_CID = Components.ID('{ed7c329e-5b45-4e99-bdae-f4d159a8edc8}');

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

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

  },

  /* implementation */
  hello: function() {
    debug('Hello world');
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([ADBService]);

