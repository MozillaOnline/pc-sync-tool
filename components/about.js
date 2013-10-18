/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

function AboutNTab() {}
AboutNTab.prototype = {
  classDescription: 'about:ffos',
  contractID: '@mozilla.org/network/protocol/about;1?what=ffos',
  classID: Components.ID('7a3435e0-5138-4ba1-bcdf-8f60cedefdc8'),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },

  newChannel: function(aURI) {
    var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    var secMan = Cc['@mozilla.org/scriptsecuritymanager;1'].getService(Ci.nsIScriptSecurityManager);
    var principal = 'getSimpleCodebasePrincipal' in secMan ? secMan.getSimpleCodebasePrincipal(aURI) : secMan.getCodebasePrincipal(aURI);
    var home = 'chrome://ffosassistant/content/index.html';
    var channel = ios.newChannel(home, null, null);
    channel.originalURI = aURI;
    return channel;
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutNTab]);