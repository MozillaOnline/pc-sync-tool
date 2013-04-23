/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- DriverDownloader: " + s + "\n"); };
else
  debug = function (s) { };

var EXPORTED_SYMBOLS = ['DriverDownloader'];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyServiceGetter(this, "ppmm",
                                   "@mozilla.org/parentprocessmessagemanager;1",
                                   "nsIMessageListenerManager");

let messageReceiver = {
  receiveMessage: function ddMsgRev_receiveMessage(aMessage) {
    debug('Receive message: ' + JSON.stringify(aMessage));

    let msg = aMessage.json || {};
    msg.manager = aMessage.target;

    var self = this;
    switch (aMessage.name) {
      // This is a sync message.
      case 'DriverDownloader:syncCommand':
        return {
          data: 'OK'
        };
      case 'DriverDownloader:asyncCommand':
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

const messages = ['DriverDownloader:syncCommand', 'DriverDownloader:asyncCommand'];
messages.forEach(function(msgName) {
  ppmm.addMessageListener(msgName, messageReceiver);
});

debug('Inited');

