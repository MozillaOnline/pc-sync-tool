/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  let DEBUG = 1;
  if (DEBUG)
    debug = function (s) { dump("-*- ADBService FF Overlay: " + s + "\n"); };
  else
    debug = function (s) { };

  var modules = {};
  XPCOMUtils.defineLazyServiceGetter(modules, "cpmm",
                                     "@mozilla.org/childprocessmessagemanager;1",
                                     "nsISyncMessageSender");
  function init() {
    // Import ADB Service module
    debug('Import adbService module');

    try {
    Components.utils.import('resource://ffosassistant/ADBService.jsm');
    Components.utils.import('resource://ffosassistant/driverDownloader.jsm');
    } catch (e) {
      debug('Error occurs when import modules: ' + e);
    }

    // Register messages
    const messages = ['ADBService:statechange'];
    messages.forEach(function(msgName) {
      modules.cpmm.addMessageListener(msgName, messageHandler)
    });
  }

  let heartBeatSocket = null;
  let messageHandler = {
    receiveMessage: function(aMessage) {
      var connected = aMessage.json.connected;
      debug('Receive message: ' + connected);
      if (connected) {
        // Establish a heart-beat socket, and stop usb querying interval
        heartBeatSocket = navigator.mozTCPSocket.open('localhost', 10010);
        heartBeatSocket.onclose = function onclose_socket() {
          // Restart usb querying interval
          ADBService.startDeviceDetecting(true);
        };

        ADBService.startDeviceDetecting(false);
      }
    }
  };

  // Add tcp socket permissions for debugging
  if (Services.prefs.getBoolPref('extensions.ffosassistant.debug')) {
    let domain = Services.prefs.getCharPref('extensions.ffosassistant.tcp_socket_allow_domain');
    var ios = Components.classes['@mozilla.org/network/io-service;1']
                .getService(Components.interfaces.nsIIOService);
    uri = ios.newURI(domain, null, null);

    Services.perms.add(uri, 'tcp-socket', Components.interfaces.nsIPermissionManager.ALLOW_ACTION);
  }

  window.addEventListener('load', function wnd_onload(e) {
    window.removeEventListener('load', wnd_onload);
    window.setTimeout(init, 1000);
  });
})();

