/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  const ADDON_ID = 'ffosassistant@mozillaonline.com';

  var devices = [];
  let DEBUG = 1;

  var jsm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
  var observerService = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);

  function debug(s) {
    if (DEBUG) {
      let console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
      console.logStringMessage("-*- FF Overlay: " + s + "\n");
    }
  }

  var isFirstrun = false;
  var modules = {};
  Components.utils.import("resource://gre/modules/NetUtil.jsm");
  Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
  XPCOMUtils.defineLazyModuleGetter(modules, 'utils', 'resource://ffosassistant/utils.jsm');
  XPCOMUtils.defineLazyModuleGetter(modules, 'ADBService', 'resource://ffosassistant/ADBService.jsm');

  function Observer()
  {
    this.register();
  }

  Observer.prototype = {
    observe: function(subject, topic, data) {
      switch (topic) {
        case 'ffosassistant-start-connection':
          setTimeout(function() {
            observerService.notifyObservers(null, "ffosassistant-init-devices", JSON.stringify(devices));
          }, 1000);
          break;
      }
    },
    register: function() {
      observerService.addObserver(this, "ffosassistant-start-connection", false);
    },
    unregister: function() {
      observerService.removeObserver(this, "ffosassistant-start-connection");
    }
  };

  function init() {
    debug('init');
    new Observer();
    modules.ADBService.init(handlemessage);

    checkFirstRun();
  }

  function handlemessage(deviceList) {
    devices = deviceList;
    if (devices.length > 0) {
      switchToTabHavingURI('about:ffos', true);
    }
    setTimeout(function() {
      observerService.notifyObservers(null, "ffosassistant-init-devices", JSON.stringify(devices));
    }, 1000);
  }

  function checkFirstRun() {
    var firstRunPref = 'extensions.' + ADDON_ID + '.firstrun';
    if (Services.prefs.getBoolPref(firstRunPref, true)) {
      Services.prefs.setBoolPref(firstRunPref, false);
      openFFOSInAPinnedTab();
      addToolbarButton();
    }
  }

  function addToolbarButton() {
    var buttonId = 'ffosassistant-button';
    if (!CustomizableUI) {
      return;
    }
    let widget = CustomizableUI.getWidget(buttonId);
    if (widget && widget.provider == CustomizableUI.PROVIDER_API) {
      return;
    }
    var bundle = Services.strings.createBundle('chrome://ffosassistant/locale/browser.properties');
    CustomizableUI.createWidget({
      id: buttonId,
      type: 'button',
      defaultArea: CustomizableUI.AREA_NAVBAR,
      label: bundle.GetStringFromName('title'),
      tooltiptext: bundle.GetStringFromName('tooltip'),
      onCommand: (aEvent) => {
        var doc = aEvent.target && aEvent.target.ownerDocument;
        var win = doc && doc.defaultView;
        if (!win) {
          return;
        }
        if (win.switchToTabHavingURI) {
          win.switchToTabHavingURI('about:ffos', true);
        } else {
          win.openUILink('about:ffos');
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

      var winEnum = jsm.getEnumerator("navigator:browser");
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

  window.addEventListener('load', function wnd_onload(e) {
    var winEnum = jsm.getEnumerator("navigator:browser");
    if (winEnum.hasMoreElements() && winEnum.getNext() && !winEnum.hasMoreElements()) {
      window.removeEventListener('load', wnd_onload);
      window.setTimeout(init, 1000);
    }
  });
})();
