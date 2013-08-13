/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 0;

function debug(s) {
  if (DEBUG) {
    dump("-*- ParentModule: " + s + "\n");
  }
}

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyServiceGetter(this, "ppmm", "@mozilla.org/parentprocessmessagemanager;1", "nsIMessageListenerManager");
XPCOMUtils.defineLazyModuleGetter(this, "utils", "resource://ffosassistant/utils.jsm");

var EXPORTED_SYMBOLS = ['ParentModule'];

function ParentModule(options) {
  this.initialize(options);
}

ParentModule.prototype = {
  initialize: function pm_initialize(options) {
    this.options = utils.extend({
      messages: [],
      onmessage: utils.emptyFunction
    }, options);

    this._addMessageListeners();
  },

  _addMessageListeners: function pm_addMessageListeners() {
    var self = this;
    this.options.messages.forEach(function(msgName) {
      ppmm.addMessageListener(msgName, self);
    });
  },

  receiveMessage: function pm_receiveMessage(aMessage) {
    debug('Receive message: ' + JSON.stringify(aMessage));

    let msg = aMessage.json || {};
    msg.manager = aMessage.target;

    return this.options.onmessage(aMessage.name, msg);
  },

  sendMessage: function(message, success, data, msg) {
    msg.manager.sendAsyncMessage(message + (success ? ":OK" : ":NO"), {
      data: data,
      rid: msg.rid,
      mid: msg.mid
    });
  }
};
