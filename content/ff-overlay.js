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

  function debug(s) {
    if (DEBUG) {
      this.console = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
      this.console.logStringMessage("-*- ADBService FF Overlay: " + s + "\n");
    }
  }

  var isDisabled = false;

  var modules = {};
  XPCOMUtils.defineLazyServiceGetter(modules, "cpmm", "@mozilla.org/childprocessmessagemanager;1", "nsISyncMessageSender");
  XPCOMUtils.defineLazyServiceGetter(modules, "xulRuntime", '@mozilla.org/xre/app-info;1', "nsIXULRuntime");
  XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://ffosassistant/utils.jsm');

  function startADBService() {
    isDisabled = false;
    ADBService.startAdbServer();
    ADBService.startDeviceDetecting(true);
    DriverManager.startDriverManager();
    connectToDriverManager();
  }

  function stopADBService() {
    isDisabled = true;
    if ( !! client && client.isConnected()) client.sendCommand('shutdown', function() {});
    ADBService.startDeviceDetecting(false);
    ADBService.killAdbServer();
  }

  function init() {
    // Import ADB Service module
    debug('Import adbService module');
    Components.utils.import('resource://ffosassistant/ADBService.jsm');
    Components.utils.import('resource://ffosassistant/driverDownloader.jsm');
    Components.utils.import('resource://ffosassistant/driverManager.jsm');
    Components.utils.import('resource://ffosassistant/utils.jsm');
    Components.utils.import("resource://gre/modules/AddonManager.jsm");

    // Register messages
    const messages = ['ADBService:statechange'];
    messages.forEach(function(msgName) {
      modules.cpmm.addMessageListener(msgName, messageHandler)
    });

    let libPath = utils.getChromeFileURI(LIB_FILE_URL);
    let adbPath = utils.getChromeFileURI(ADB_FILE_URL);
    ADBService.initAdbService(modules.xulRuntime.OS == 'WINNT', libPath.file.path, adbPath.file.path);
    if (modules.xulRuntime.OS == 'WINNT') {
      this._addonListener = {
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
      };
      setAddonInfo(true);
      var otherAdbService = navigator.mozFFOSAssistant.runCmd('listAdbService');
      otherAdbService.onsuccess = function on_success(event) {
        //TODO:
        debug('output ' + event.target.result);
      }
      AddonManager.addAddonListener(this._addonListener);
      DriverManager.startDriverManager();
      connectToDriverManager();
    }
    checkFirstRun();
    if (isDisabled == false) {
      ADBService.startDeviceDetecting(true);
    }
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
      let file = utils.getChromeFileURI(DRIVER_MANAGER_HOME).file;
      file.append(DRIVER_MANAGER_INI_FILE_NAME);
      if (!file.exists()) {
        file.create(Ci.nsIFile.NORMAL_FILE_TYPE, '0644');
      }
      utils.saveIniValue(file, 'firefox', 'path', getFirefoxPath());
      utils.saveIniValue(file, 'status', 'isRun', isRun);
    } catch (e) {
      debug(e);
    }
  }

  function getDriverManagerPort() {
    // Read port number from driver_manager.ini
    try {
      let file = utils.getChromeFileURI(DRIVER_MANAGER_HOME).file;
      file.append(DRIVER_MANAGER_INI_FILE_NAME);
      if (!file.exists()) {
        debug('No ini file is found');
        return 0;
      }

      return parseInt(utils.getIniValue(file, 'socket', 'port'));
    } catch (e) {
      debug(e);
      return 0;
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
      var serverIP = aMessage.json.serverip;
      debug('Receive message: ' + connected);
      if (connected) {
        ADBService.startDeviceDetecting(false);
        // Establish a heart-beat socket, and stop usb querying interval
        heartBeatSocket = navigator.mozTCPSocket.open(serverIP, 10010);
        heartBeatSocket.onclose = function onclose_socket() {
          // Restart usb querying interval
          if (isDisabled == false) {
            ADBService.startDeviceDetecting(true);
          }
        };
      }
    }
  };

  var client = null;

  function connectToDriverManager() {
    var port = getDriverManagerPort();
    if (port) {
      client = new TelnetClient({
        host: '127.0.0.1',
        port: port,
        onmessage: handleMessage,
        onopen: onopen,
        onclose: onclose
      }).connect();
    } else {
      window.setTimeout(connectToDriverManager, 1000);
      debug("DriverManager process is not running, try to connect it again!");
    }
  }

  function handleMessage(msg) {
    if (!msg) {
      return;
    }
    switch (msg.type) {
    case 'notification':
      debug('Got an notification');
      checkNotification();
      break;
    case 'deviceChanged':
      onDeviceChanged(msg);
      break;
    case 'driverInstalled':
      onDriverInstalled(msg);
      break;
    }
  }

  function onDeviceChanged(msg) {
    window.clearTimeout(failToInstallTimeout);
    checkDriverStatus();
  }

  var failToInstallTimeout = null;

  function onDriverInstalled(msg) {
    // `driverInstalled` means the driver installer running completes, however it
    // does not mean the driver for the plugged device is installed, so it's not
    // a reliable event for ensuring driver-failed-to-be-installed, we need to try
    // to connect to the device and double check `adbConnected`.
    //
    // We don't need to fire device-ready-event here, we will might receive a
    // device-change event if driver is installed successfully.
    if (msg.data.errorName && !navigator.mozFFOSAssistant.adbConnected) {
      //todo: handle driver installation error
    } else {
      // Sometimes we can't receive a device-change event, we need to set a timeout
      // to fire fail-to-install event
      failToInstallTimeout = window.setTimeout(function() {
        //todo: handle failure of driver installation
      }, 5000);
    }
  }
  var _doubleCheckTimeout = null;

  function checkDriverStatus() {
    client.sendCommand('list', function(message) {
      if (message.data.length == 0) {
        return;
      }
      // TODO handle all devices
      if (message.data[0].state == 'installed') {
        return;
      }

      // Windows need to load the driver when USB connected, so sometimes
      // the message told us it's not installed, we need wait for seconds
      // and query again to double check the status.
      if (_doubleCheckTimeout) {
        window.clearTimeout(_doubleCheckTimeout);
      }
      _doubleCheckTimeout = window.setTimeout(doCheckAndInstallDrivers, 5000);
    });
  }

  function doCheckAndInstallDrivers() {
    debug('Double check the driver installation state.');
    client.sendCommand('list', function(message) {
      if (message.data.length == 0) {
        return;
      }
      if (message.data[0].state == 'installed') {
        return;
      }
      var instanceId = message.data[0].deviceInstanceId;
      var driverPath = DriverDownloader.getInstallerPath(instanceId);
      client.sendCommand('install', instanceId, driverPath, function(message) {
        debug('Receive install message: ' + JSON.stringify(message));
      });
    });
  }

  function onopen() {
    debug('Telnet client is opened.');
    client.sendCommand("info", function(message) {
      debug("info: " + message);
    });
    checkDriverStatus();
  }

  function onclose() {
    debug('telnet client is closed.');
  }

  function checkNotification() {
    // Check the message, and decide what to do next.
    client.sendCommand('message', handleMessage);
  }

  window.addEventListener('load', function wnd_onload(e) {
    window.removeEventListener('load', wnd_onload);
    window.setTimeout(init, 1000);
  });

  window.addEventListener('unload', function wnd_onunload(e) {
    window.removeEventListener('unload', wnd_onunload);
    if (modules.xulRuntime.OS == 'WINNT') {
      setAddonInfo(false);
    }
  });

  function TelnetClient(options) {
    this.initialize(options);
  }

  TelnetClient.prototype = {
    initialize: function tc_init(options) {
      this.options = utils.extend({
        host: 'localhost',
        port: 0,
        onmessage: utils.emptyFunction,
        onopen: utils.emptyFunction,
        onclose: utils.emptyFunction
      }, options);

      if (!this.options.port) {
        throw Error('No port is specified.');
      }

      this._callback = null;
      this._queue = [];
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
      this._callback = null;
      this._queue = [];
      this.options.onclose(event);
    },

    _ondata: function ondata(event) {
      debug('Received data: ' + event.data);
      var recvData = this._filterNotification(event.data);
      var data = null;
      try {
        data = JSON.parse(recvData);
      } catch (e) {
        debug('Not a valid JSON string.');
        return;
      }
      // Check if the _callback is null, if yes, it means the message
      // is the echo for last command.
      try {
        if (this._callback) {
          this._callback(data);
        } else {
          this.options.onmessage(data);
        }
      } catch (e) {
        debug('Error occurs when invoking callback: ' + e);
      } finally {
        this._callback = null;
        this._sendQueuedCommand();
      }
    },

    _filterNotification: function(str) {
      // Tranverse the event.data, if we received '\b' (charcode: 7), it
      // means we received a notification.
      var filteredStr = '';

      for (var i = 0; i < str.length; i++) {
        var charCode = str.charCodeAt(i);
        if (charCode == 7) {
          // We got a notification.
          this.options.onmessage({
            type: 'notification'
          });
        } else {
          filteredStr += str.charAt(i);
        }
      }

      return filteredStr;
    },

    _sendQueuedCommand: function() {
      if (this._queue.length > 0) {
        this.sendCommand.apply(this, this._queue.shift());
      }
    },

    /* Interfaces */
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

    /**
     * arguments:
     *   command, arg1, arg2 ... argn, callback
     *
     * The last argument should be the callback function to receive
     * the echo message.
     */
    sendCommand: function tc_sendCommand() {
      if (!this.isConnected()) {
        throw Error('Server is disconnected.');
      }

      // One command at a time.
      if (this._callback) {
        this._queue.push(arguments);
        return;
      }

      // There will be an echo sent back whenever we send a command,
      // so we need cache the callback here.
      var args = [];
      for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] == 'function') {
          this._callback = arguments[i];
          break;
        }
        args.push(arguments[i]);
      }

      // Check if the callback is null, if yes, set it with emptyFunction
      // which means the next message is an echo for this command, not an
      // initiative message from the server.
      this._callback = this._callback || emptyFunction;

      var command = args.join("\t") + "\n";
      this._socket.send(command);
    }
  };
})();
