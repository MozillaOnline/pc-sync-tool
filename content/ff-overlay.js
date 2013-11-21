/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  const DRIVER_MANAGER_HOME = 'resource://ffosassistant-dmhome';
  const DRIVER_MANAGER_INI_FILE_NAME = 'driver_manager.ini';
  const LIB_FILE_URL = 'resource://ffosassistant-libadbservice';
  const ADB_FILE_URL = 'resource://ffosassistant-adb';
  const ADDON_ID = 'ffosassistant@mozillaonline.com';
  let DEBUG = 0;

  var jsm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);

  function debug(s) {
    if (DEBUG) {
      let console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
      console.logStringMessage("-*- ADBService FF Overlay: " + s + "\n");
    }
  }

  var isDisabled = false;

  var modules = {};
  XPCOMUtils.defineLazyServiceGetter(modules, "cpmm", "@mozilla.org/childprocessmessagemanager;1", "nsISyncMessageSender");
  XPCOMUtils.defineLazyModuleGetter(modules, 'utils', 'resource://ffosassistant/utils.jsm');
  XPCOMUtils.defineLazyModuleGetter(modules, 'ADBService', 'resource://ffosassistant/ADBService.jsm');
  XPCOMUtils.defineLazyModuleGetter(modules, 'DriverDownloader', 'resource://ffosassistant/driverDownloader.jsm');
  XPCOMUtils.defineLazyModuleGetter(modules, 'DriverManager', 'resource://ffosassistant/driverManager.jsm');
  XPCOMUtils.defineLazyModuleGetter(modules, 'AddonManager', 'resource://gre/modules/AddonManager.jsm');

  var _bundles = Cc["@mozilla.org/intl/stringbundle;1"].
          getService(Ci.nsIStringBundleService).
          createBundle("chrome://ffosassistant/locale/browser.properties");

  function getString(key) {
    return _bundles.GetStringFromName(key);
  }

  function startADBService() {
    isDisabled = false;
    modules.DriverManager.startDriverManager();
    connectToDriverManager();
  }

  function stopADBService() {
    isDisabled = true;
    if (client && client.isConnected()) {
      client.sendCommand('shutdown');
    }
    modules.ADBService.startDeviceDetecting(false);
    modules.ADBService.killAdbServer();
  }

  function init() {
    // Import ADB Service module
    debug('Import adbService module');

    // Register messages
    const messages = ['ADBService:statechange'];
    messages.forEach(function(msgName) {
      modules.cpmm.addMessageListener(msgName, messageHandler)
    });

    let libPath = modules.utils.getChromeFileURI(LIB_FILE_URL);
    let adbPath = modules.utils.getChromeFileURI(ADB_FILE_URL);
    let profilePath = Services.dirsvc.get('ProfD', Ci.nsIFile);
    modules.ADBService.initAdbService(navigator.mozFFOSAssistant.isWindows, libPath.file.path, adbPath.file.path, profilePath.path);

    checkFirstRun();

    if (!navigator.mozFFOSAssistant.isWindows) {
      modules.ADBService.startDeviceDetecting(true);
      return;
    }

    modules.AddonManager.addAddonListener({
      onUninstalling: function(addon) {
        if (addon.id == ADDON_ID) {
          stopADBService();
        }
      },
      onDisabling: function(addon, needsRestart) {
        if (addon.id == ADDON_ID) {
          stopADBService();
        }
      },
      onEnabling: function(addon, needsRestart) {
        if (addon.id == ADDON_ID) {
          startADBService();
        }
      },
      onOperationCancelled: function(addon, needsRestart) {
        if (addon.id == ADDON_ID && isDisabled == true) {
          startADBService();
        }
      }
    });
    setAddonInfo(true);
    modules.DriverManager.startDriverManager();
    connectToDriverManager();
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
    var navBar = document.getElementById('nav-bar');
    var currentSet = navBar.currentSet;

    var buttonId = 'ffosassistant-button';
    if (!currentSet.contains(buttonId)) {
      var set = navBar.currentSet + '';
      var MANULLAY_REMOVE_PREF = 'extensions.' + ADDON_ID + '.manuallyRemovedButton';
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
        if (!event.newValue.contains('ffosassistant-button')) {
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

    var pinPref = 'extensions.' + ADDON_ID + '.pinnedOnOpen';
    if (Services.prefs.getBoolPref(pinPref, true)) {
      gBrowser.pinTab(tab);
    }
  }

  function getFirefoxPath() {
    return Services.dirsvc.get('XREExeF', Ci.nsIFile).path;
  }

  function setAddonInfo(isRun) {
    try {
      let file = modules.utils.getChromeFileURI(DRIVER_MANAGER_HOME).file;
      file.append(DRIVER_MANAGER_INI_FILE_NAME);
      if (!file.exists()) {
        file.create(Ci.nsIFile.NORMAL_FILE_TYPE, '0644');
      }
      // USB monitor will launch firefox corresponding to the path
      modules.utils.saveIniValue(file, 'firefox', 'path', getFirefoxPath());
      modules.utils.saveIniValue(file, 'status', 'isRun', isRun);
    } catch (e) {
      debug(e);
    }
  }

  function getDriverManagerPort() {
    // Read port number from driver_manager.ini
    try {
      let file = modules.utils.getChromeFileURI(DRIVER_MANAGER_HOME).file;
      file.append(DRIVER_MANAGER_INI_FILE_NAME);
      if (!file.exists()) {
        debug('No ini file is found');
        return 0;
      }

      return parseInt(modules.utils.getIniValue(file, 'socket', 'port'));
    } catch (e) {
      debug(e);
    }
    return 0;
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

  let heartBeatSocket = null;
  let mode;
  let connected;
  let serverIP;
  let port;

  function onclose_heartBeatSocket() {
    heartBeatSocket = null;
    if (isDisabled) {
      return;
    }
    if (mode == 'USB') {
      modules.ADBService.startDeviceDetecting(true);
    }
  };

  let messageHandler = {
    receiveMessage: function(aMessage) {
      mode = aMessage.json.mode;
      connected = aMessage.json.connected;
      serverIP = aMessage.json.serverip;
      port = aMessage.json.port;

      if (heartBeatSocket) {
        heartBeatSocket.close();
        return;
      }

      if (connected) {
        modules.ADBService.startDeviceDetecting(false);
        // Establish a heart-beat socket, and stop usb querying interval
        heartBeatSocket = navigator.mozTCPSocket.open(serverIP, port);
        heartBeatSocket.onclose = onclose_heartBeatSocket;
      }

      if (!navigator.mozFFOSAssistant.isWindows) {
        return;
      }

      var otherAdbService = navigator.mozFFOSAssistant.runCmd('listAdbService');
      otherAdbService.onsuccess = function on_success(event) {
        if (event.target.result.indexOf('ffosadb.exe') >= 0) {
          return;
        }
        var message = getString('list-adb-service') + event.target.result;
        showNotification(message);
      }
    }
  };

  function showNotification(message) {
    if (!("Notification" in window)) {
      return;
    } else if (Notification.permission === "granted") {
      new Notification(message);
    } else {
      Notification.requestPermission(function (permission) {
        if (!('permission' in Notification)) {
          Notification.permission = permission;
        }
        if (permission === "granted") {
          new Notification(message);
        }
      });
    }
  }

  var client = null;

  function connectToDriverManager() {
    var port = getDriverManagerPort();
    if (!port) {
      window.setTimeout(connectToDriverManager, 1000);
      debug("DriverManager process is not running, try to connect it again!");
      return;
    }

    client = new TelnetClient({
      host: '127.0.0.1',
      port: port,
      onmessage: handleMessage,
      onopen: onopen,
      onclose: onclose
    }).connect();
  }

  function handleMessage(msg) {
    if (!msg) {
      return;
    }

    if (msg.length == 0) {
      modules.ADBService.startDeviceDetecting(false);
      return;
    }

    switch (msg[0].InstallState) {
    case 0: // device driver installed
      modules.ADBService.startDeviceDetecting(true);
      break;
    case 1: // device driver needs reinstalling
    case 2: // device driver failed installing
    case 3: // device driver finishes installation
    default:
      modules.ADBService.startDeviceDetecting(false);
      let url = '';
      if (navigator.language == 'zh-CN') {
        url = 'http://os.firefox.com.cn/zh-CN/about/help.html';
      } else {
        url = 'http://os.firefox.com.cn/en-US/about/help.html';
      }
      openUILinkIn(url, "tab");
      break;
    }
  }

  function onopen() {
    debug('Telnet client is opened.');
  }

  function onclose() {
    debug('telnet client is closed.');
  }

  window.addEventListener('load', function wnd_onload(e) {
    var winEnum = jsm.getEnumerator("navigator:browser");
    if (winEnum.hasMoreElements() && winEnum.getNext() && !winEnum.hasMoreElements()) {
      window.removeEventListener('load', wnd_onload);
      window.setTimeout(init, 1000);
    }
  });

  window.addEventListener('unload', function wnd_onunload(e) {
    window.removeEventListener('unload', wnd_onunload);
    if (navigator.mozFFOSAssistant.isWindows) {
      setAddonInfo(false);
    }
  });

  function TelnetClient(options) {
    this.initialize(options);
  }

  TelnetClient.prototype = {
    initialize: function tc_init(options) {
      this.options = modules.utils.extend({
        host: 'localhost',
        port: 0,
        onmessage: modules.utils.emptyFunction,
        onopen: modules.utils.emptyFunction,
        onclose: modules.utils.emptyFunction
      }, options);

      if (!this.options.port) {
        throw Error('No port is specified.');
      }

      this._connected = false;
      this._socket = null;
    },

    _onopen: function onopen(event) {
      debug('Connection is opened.');
      this._connected = true;
      this._socket.onclose = this._onclose.bind(this);
      this._socket.ondata = this._ondata.bind(this);
      this.options.onopen(event);
    },

    _onclose: function onclose(event) {
      debug('Connection is closed.');
      this._connected = false;
      this._socket = null;
      this.options.onclose(event);
    },

    _ondata: function ondata(event) {
      debug('Received data: ' + event.data);
      var data = null;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        debug('Not a valid JSON string.');
        return;
      }
	  this.options.onmessage(data);
    },

    isConnected: function() {
      return !!this._connected;
    },

    connect: function() {
      if (this._socket) {
        return this;
      }

      this._socket = navigator.mozTCPSocket.open(this.options.host, this.options.port, {
        binaryType: 'string'
      });

      this._socket.onopen = this._onopen.bind(this);
      this._socket.onerror = function(event) {
        debug("telnet error: " + event.data);
      };

      return this;
    },

    disconnect: function() {
      debug("disconnect socket: " + this._connected);
      if (this._connected) {
        this._socket.close();
      }
    },

    sendCommand: function tc_sendCommand() {
      if (!this.isConnected()) {
        throw Error('Server is disconnected.');
      }

      var command = arguments.join("\t") + "\n";
      this._socket.send(command);
    }
  };
})();
