/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  let DEBUG = 1;
  if (DEBUG) debug = function(s) {
    dump("-*- ADBService FF Overlay: " + s + "\n");
  };
  else
  debug = function(s) {};

  var modules = {};
  XPCOMUtils.defineLazyServiceGetter(modules, "cpmm", "@mozilla.org/childprocessmessagemanager;1", "nsISyncMessageSender");

  function init() {
    // Import ADB Service module
    debug('Import adbService module');

    try {
      Components.utils.import('resource://ffosassistant/ADBService.jsm');
      Components.utils.import('resource://ffosassistant/driverDownloader.jsm');
      Components.utils.import('resource://ffosassistant/driverManager.jsm');
    } catch (e) {
      debug('Error occurs when import modules: ' + e);
    }

    // Register messages
    const messages = ['ADBService:statechange'];
    messages.forEach(function(msgName) {
      modules.cpmm.addMessageListener(msgName, messageHandler)
    });

    checkFirstRun();
  }

  function checkFirstRun() {
    var firstRunPref = 'extensions.ffosassistant@mozillaonline.com.firstrun';
    if (Services.prefs.getBoolPref(firstRunPref, true)) {
      Services.prefs.setBoolPref(firstRunPref, false);
      openFFOSInAPinnedTab();
      addToolbarButton();
    }
  }

  function addToolbarButton() {
    var navBar = document.getElementById('nav-bar');
    var currentSet = navBar.currentSet;

    var buttonId = 'ffosassistant-button';
    if (currentSet.indexOf(buttonId) == -1) {
      var set = navBar.currentSet + '';
      var MANULLAY_REMOVE_PREF = 'extensions.ffosassistant@mozillaonline.com.manuallyRemovedButton';
      var manuallyRemovedButton = Services.prefs.getBoolPref(MANULLAY_REMOVE_PREF, false);

      if (manuallyRemovedButton) {
        return;
      }

      set = set + ',' + buttonId;

      navBar.setAttribute('currentset', set);
      navBar.currentSet = set;
      document.persist('nav-bar', 'currentset');

      BrowserToolboxCustomizeDone(true);
    }

    // Check whether user has manually removed the toolbar button
    navBar.addEventListener('DOMAttrModified', function(event) {
      if (event.type == 'DOMAttrModified' && event.attrName == 'currentset') {
        if (event.newValue.indexOf('ffosassistant-button') == -1) {
          Services.prefs.setBoolPref(MANULLAY_REMOVE_PREF, true);
        }
      }
    });
  }

  function openFFOSInAPinnedTab() {
    var tab = null;
    if (isTabEmpty(gBrowser.selectedTab)) {
      tab = gBrowser.selectedTab;
      gBrowser.selectedBrowser.loadURI('about:ffos');
    } else {
      tab = gBrowser.loadOneTab('about:ffos', {
        inBackground: false
      });
    }

    var pinPref = 'extensions.ffosassistant@mozillaonline.com.pinnedOnOpen';
    if (Services.prefs.getBoolPref(pinPref, true)) {
      gBrowser.pinTab(tab);
    }
  }

  // Copy from Firefox4
  if (!window["switchToTabHavingURI"]) {
    window["isTabEmpty"] = function(aTab) {
      var browser = aTab.linkedBrowser;
      return browser.sessionHistory.count < 2 && browser.currentURI.spec == "about:blank" && !browser.contentDocument.body.hasChildNodes() && !aTab.hasAttribute("busy");
    }

    window["switchToTabHavingURI"] = function(aURI, aOpenNew) {
      function switchIfURIInWindow(aWindow) {
        var browsers = aWindow.gBrowser.browsers;
        for (var i = 0; i < browsers.length; i++) {
          var browser = browsers[i];
          if (browser.currentURI.equals(aURI)) {
            aWindow.focus();
            aWindow.gBrowser.tabContainer.selectedIndex = i;
            return true;
          }
        }
        return false;
      }

      if (!(aURI instanceof Ci.nsIURI)) {
        var ioServices = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
        aURI = ioServices.newURI(aURI, null, null);
      }

      var isBrowserWindow = !! window.gBrowser;
      if (isBrowserWindow && switchIfURIInWindow(window)) {
        return true;
      }

      var winEnum = jsm.windowMediator.getEnumerator("navigator:browser");
      while (winEnum.hasMoreElements()) {
        var browserWin = winEnum.getNext();
        if (browserWin.closed || browserWin == window) {
          continue;
        }
        if (switchIfURIInWindow(browserWin)) {
          return true;
        }
      }

      if (aOpenNew) {
        if (isBrowserWindow && isTabEmpty(gBrowser.selectedTab)) {
          gBrowser.selectedBrowser.loadURI(aURI.spec);
        } else {
          openUILinkIn(aURI.spec, "tab");
        }
      }

      return false;
    }
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
  if (Services.prefs.getBoolPref('extensions.ffosassistant@mozillaonline.com.debug')) {
    let domain = Services.prefs.getCharPref('extensions.ffosassistant@mozillaonline.com.tcp_socket_allow_domain');
    var ios = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
    uri = ios.newURI(domain, null, null);

    Services.perms.add(uri, 'tcp-socket', Components.interfaces.nsIPermissionManager.ALLOW_ACTION);
  }

  window.addEventListener('load', function wnd_onload(e) {
    window.removeEventListener('load', wnd_onload);
    window.setTimeout(init, 1000);
  });
})();