/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var chromeWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                         .getInterface(Components.interfaces.nsIWebNavigation)
                         .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                         .rootTreeItem
                         .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                         .getInterface(Components.interfaces.nsIDOMWindow);

var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
var browserEnumerator = wm.getEnumerator("navigator:browser");
var bFound = false;
var bInit = false;

while (browserEnumerator.hasMoreElements()) {
  var browserWin = browserEnumerator.getNext();
  var tabbrowser = browserWin.gBrowser;

  // Check each tab of this browser instance
  var numTabs = tabbrowser.browsers.length;
  for (var index = 0; index < numTabs; index++) {
    var currentBrowser = tabbrowser.getBrowserAtIndex(index);
    if ('about:ffos' == currentBrowser.currentURI.spec) {
      if(!bFound) {
        bFound = true;
      } else {
        browserWin.focus();
        tabbrowser.removeCurrentTab();
      }
    }
  }
}

chromeWindow.switchToTabHavingURI('about:ffos', true);

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, 'ADBService', 'resource://ffosassistant/ADBService.jsm');
var connectState = {
  disconnected: 1,
  connected: 2,
  connecting: 3,
  error: 4
};
var device = '';
var animationLoading = null;
var customEventElement = document;
var isWifiConnected = false;
var observer = null;
var devicesList = null;
var deviceSocketState = connectState.disconnected;
var REMOTE_PORT = 25679;
var FFOSAssistant = (function() {
  var connPool = null;
  var connListenSocket = null;

  function showSummaryView(serverIP) {
    $id('connect-button').classList.add('hiddenElement');
    $id('disconnect-button').classList.remove('hiddenElement');
    if (serverIP != 'localhost') {
      isWifiConnected = true;
    }
    if (connListenSocket) {
      connListenSocket.socket.close();
      connListenSocket = null;
    }
    var socket = navigator.mozTCPSocket.open(serverIP, REMOTE_PORT, {
      binaryType: 'arraybuffer'
    });
    socket.onopen = function tc_onListenSocketOpened(event) {
      connListenSocket = new TCPSocketWrapper({
        socket: event.target,
        onmessage: function(socket, jsonCmd, sendCallback, recvData) {
          if (connListenSocket == null) {
            return;
          }
          var message = JSON.parse(recvData);
          var event = new CustomEvent('dataChange',{'detail': {'type': message.type, 'data': message}});
          customEventElement.dispatchEvent(event);
        },
        onclose: function() {
          connListenSocket = null;
        }
      });
      CMD.Listen.listenMessage(null, null);
    };
    if (isWifiConnected) {
      $id('device-image-connection').classList.add('wifiConnection');
    } else {
      $id('device-image-connection').classList.remove('wifiConnection');
    }
    $id('device-connected').classList.remove('hiddenElement');
    $id('device-unconnected').classList.add('hiddenElement');
    ViewManager.showContent('summary-view');
  }

  /**
   * Format storage size.
   */
  function formatStorage(sizeInBytes) {
    var sizeInMega = sizeInBytes / 1024 / 1024;

    if (sizeInMega > 900) {
      var sizeInGiga = sizeInMega / 1024;
      return sizeInGiga.toFixed(2) + 'G';
    }

    return sizeInMega.toFixed(2) + 'M';
  }

  function getAndShowStorageInfo() {
    var loadingGroupId = animationLoading.start();
    CMD.Device.getStorage(function onresponse_getDeviceInfo(message) {
      var dataJSON = JSON.parse(message.data);
      var elem = $id('device-storage-summary');
      var total = dataJSON.apps.usedSpace + dataJSON.apps.freeSpace;
      if (total > 0) {
        var usedInP = Math.floor(dataJSON.apps.usedSpace / total * 100) + '%';
        $expr('.storage-number', elem)[0].textContent =
          formatStorage(dataJSON.apps.usedSpace) + '/' + formatStorage(total) + ' ' + usedInP;
        $expr('.storage-graph .used', elem)[0].style.width = usedInP;
      } else {
        $expr('.storage-number', elem)[0].textContent = '0.00M/0.00M';
        $expr('.storage-graph .used', elem)[0].style.width = '0%';
      }
      elem = $id('sdcard-storage-summary');
      total = dataJSON.sdcard.usedSpace + dataJSON.sdcard.freeSpace;
      if (total > 0) {
        var usedInP = Math.floor(dataJSON.sdcard.usedSpace / total * 100) + '%';
        $expr('.storage-number', elem)[0].textContent =
          formatStorage(dataJSON.sdcard.usedSpace) + '/' + formatStorage(total) + ' ' + usedInP;
        $expr('.storage-graph .used', elem)[0].style.width = usedInP;
        var subInP = Math.floor(dataJSON.pictures.usedSpace / dataJSON.sdcard.usedSpace * 100);
        $expr('.storage-used', elem)[0].style.width = subInP + '%';
        subInP = Math.floor(dataJSON.music.usedSpace / dataJSON.sdcard.usedSpace * 100);
        $expr('.storage-used', elem)[1].style.width = subInP + '%';
        subInP = Math.floor(dataJSON.videos.usedSpace / dataJSON.sdcard.usedSpace * 100);
        $expr('.storage-used', elem)[2].style.width = subInP + '%';
        subInP = Math.floor((dataJSON.sdcard.usedSpace - dataJSON.music.usedSpace - dataJSON.pictures.usedSpace - dataJSON.videos.usedSpace) / dataJSON.sdcard.usedSpace * 100);
        $expr('.storage-used', elem)[3].style.width = subInP + '%';
      } else {
        $expr('.storage-number', elem)[0].textContent = '0.00M/0.00M';
        $expr('.storage-graph .used', elem)[0].style.width = '0%';
        var storageIndicators = $expr('.storage-used', elem);
        for (var i = 0; i < 4; i++) {
          storageIndicators[i].style.width = '0%';
        }
      }
      animationLoading.stop(loadingGroupId);
    }, function onerror_getStorage(message) {
      animationLoading.stop(loadingGroupId);
      console.log('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });
  }

  function summaryHeadMouseOver(self, body) {
    if (body.classList.contains('hiddenElement')) {
      self.classList.add('expanded');
      self.classList.remove('collapsed');
    } else {
      self.classList.add('collapsed');
      self.classList.remove('expanded');
    }
  }

  function summaryHeadMouseout() {
    this.classList.remove('collapsed');
    this.classList.remove('expanded');
  }

  function summaryHeadClick(self, body) {
    body.classList.toggle('hiddenElement');
    if (body.classList.contains('hiddenElement')) {
      self.classList.remove('collapsed');
      self.classList.add('expanded');
    } else {
      self.classList.remove('expanded');
      self.classList.add('collapsed');
    }
  }

  function getAndShowSummaryInfo() {
    getAndShowStorageInfo();
    var loadingGroupId = animationLoading.start();
    CMD.Device.getSettings(function onresponse_getDeviceInfo(message) {
      var dataJSON = JSON.parse(message.data);
      var elem = $id('device-storage-summary');
      $expr('.device-os-version-number', elem)[0].textContent = dataJSON["deviceinfo.os"];
      $expr('.device-hardware-revision-number', elem)[0].textContent = dataJSON["deviceinfo.hardware"];
      $expr('.device-platform-version-number', elem)[0].textContent = dataJSON["deviceinfo.platform_version"];
      $expr('.device-build-identifier-number', elem)[0].textContent = dataJSON["deviceinfo.platform_build_id"];
      $id('device-info-head').onmouseover = function() {
        var body = $id('device-info-body');
        summaryHeadMouseOver(this, body);
      };
      $id('device-storage-head').onmouseover = function() {
        var body = $id('device-storage-body');
        summaryHeadMouseOver(this, body);
      };
      $id('device-info-head').onmouseout = $id('device-storage-head').onmouseout = summaryHeadMouseout;
      $id('device-info-head').onclick = function() {
        var body = $id('device-info-body');
        summaryHeadClick(this, body);
      };
      $id('device-storage-head').onclick = function() {
        var body = $id('device-storage-body');
        summaryHeadClick(this, body);
      };
      animationLoading.stop(loadingGroupId);
    }, function onerror_getSettings(message) {
      animationLoading.stop(loadingGroupId);
      console.log('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });
  }

  function connectToDevice() {
    if (!devicesList || devicesList.length == 0) {
      if (deviceSocketState == connectState.connected) {
        releaseConnPool();
        resetConnect();
      }
      return;
    }
    if (deviceSocketState == connectState.connecting) {
      return;
    }
    deviceSocketState = connectState.connecting;
    var availableDevices = [];
    if (isWindows()) {
      for (var i=0; i<devicesList.length; i++) {
        if (devicesList[i].InstallState == 0) {
          availableDevices.push(devicesList[i]);
        }
      }
      if (availableDevices.length == 0) {
        new AlertDialog({
          id: 'popup_dialog',
          titleL10nId: 'alert-dialog-title',
          message: {
            head: _('connection-alert-dialog-title'),
            description: _('connection-alert-dialog-message-header'),
            content: _('connection-alert-dialog-message-check-nodriver'),
            detail: _('connection-alert-dialog-detail'),
            href: 'chrome://ffosassistant/content/Help/Help-cn.html'
          },
          callback: resetConnect
        });
        return;
      }
    } else {
      availableDevices = devicesList;
    }
    var loadingGroupId = animationLoading.start();
    ADBService.findDevice(function find(data) {
      var regExp = /\n([0-9a-z]+)\tdevice/ig;
      var devices = [];
      var result = null;
      while(result = regExp.exec(data.result)){
        devices.push(result[1]);
      }
      var connectDevices = [];
      if (devices.length > 0) {
        for (var i=0; i<availableDevices.length; i++) {
          if (devices.indexOf(availableDevices[i].display_name) < 0) {
            continue;
          }
          connectDevices.push(availableDevices[i].display_name);
        }
      }
      if (connectDevices.length == 0) {
        animationLoading.stop(loadingGroupId);
        var contentInfo = [_('connection-alert-dialog-message-check-remotedebugger'), _('connection-alert-dialog-message-check-lockscreen')];
        if (isWindows()) {
          contentInfo.push(_('connection-alert-dialog-message-check-otheradb'));
        } else {
          contentInfo.push(_('connection-alert-dialog-message-check-edit51android'));
        }
        new AlertDialog({
          id: 'popup_dialog',
          titleL10nId: 'alert-dialog-title',
          message: {
            head: _('connection-alert-dialog-title'),
            description: _('connection-alert-dialog-message-header'),
            content: contentInfo,
            detail: _('connection-alert-dialog-detail'),
            href: 'chrome://ffosassistant/content/Help/Help-cn.html'
          },
          callback: resetConnect
        });
        return;
      }
      device = connectDevices[0];
      ADBService.setupDevice(device, function setup(data) {
        animationLoading.stop(loadingGroupId);
        if (!/error|failed/ig.test(data.result)) {
          connectToServer('localhost');
        } else {
          deviceSocketState = connectState.error;
        }
      });
    });
  }

  function releaseConnPool() {
    if (connPool) {
      connPool.finalize();
      connPool = null;
    }
  }

  function resetConnect() {
    if (!isWindows()) {
      isWifiConnected = false;
    }
    showConnectView();
    ViewManager.reset();
    deviceSocketState = connectState.disconnected;
  }

  function connectToServer(serverIP) {
    if (!serverIP) {
      return;
    }
    var loadingGroupId = animationLoading.start();
    releaseConnPool();
    connPool = new TCPConnectionPool({
      host: serverIP,
      port: REMOTE_PORT,
      size: 1,
      onerror: function onerror() {
        animationLoading.stop(loadingGroupId);
        if (deviceSocketState != connectState.connecting) {
          return;
        }
        releaseConnPool();
        var contentInfo = [_('connection-alert-dialog-message-check-version'),
                           _('connection-alert-dialog-message-check-lockscreen'),
                           _('connection-alert-dialog-message-check-runapp')];
        if (isWifiConnected) {
          contentInfo.push(_('connection-alert-dialog-message-check-samewifi'));
          contentInfo.push(_('connection-alert-dialog-message-check-wificode'));
        }
        new AlertDialog({
          id: 'popup_dialog',
          titleL10nId: 'alert-dialog-title',
          message: {
            head: _('connection-alert-dialog-title'),
            description: _('connection-alert-dialog-message-header'),
            content: contentInfo,
            detail: _('connection-alert-dialog-detail'),
            href: 'chrome://ffosassistant/content/Help/Help-cn.html'
          },
          callback: resetConnect
        });
      },
      onconnected: function onconnected() {
        animationLoading.stop(loadingGroupId);
        if (deviceSocketState != connectState.connecting) {
          return;
        }
        deviceSocketState = connectState.connected;
        $id('device-name').innerHTML = device;
        showSummaryView(serverIP);
      },
      ondisconnected: function ondisconnected() {
        animationLoading.stop(loadingGroupId);
        releaseConnPool();
        if (deviceSocketState == connectState.connecting) {
          var contentInfo = [_('connection-alert-dialog-message-check-version'), _('connection-alert-dialog-message-check-runapp')];
          new AlertDialog({
            id: 'popup_dialog',
            titleL10nId: 'alert-dialog-title',
            message: {
              head: _('connection-alert-dialog-title'),
              description: _('connection-alert-dialog-message-header'),
              content: contentInfo,
              detail: _('connection-alert-dialog-detail'),
              href: 'chrome://ffosassistant/content/Help/Help-cn.html'
            },
            callback: resetConnect
          });
        } else{
           resetConnect();
        }
      }
    });
  }

  function showConnectView() {
    animationLoading.reset();
    $id('connect-button').classList.remove('hiddenElement');
    var templateData = {
      name: 'connect'
    };
    new Tip({
      element: $id('connect-button'),
      innerHTML: tmpl('tmpl_singletip', templateData),
      container: $id('connect-action')
    });
    $id('disconnect-button').classList.add('hiddenElement');
    templateData = {
      name: 'disconnect'
    };
    new Tip({
      element: $id('disconnect-button'),
      innerHTML: tmpl('tmpl_singletip', templateData),
      container: $id('connect-action')
    });

    $id('device-connected').classList.add('hiddenElement');
    $id('device-unconnected').classList.remove('hiddenElement');
    $id('views').classList.add('hidden-views');

    $id('usb-connection-button').onclick = function() {
      $id('wifi-connection-button').dataset.checked = false;
      $id('wifi-connection-button').classList.remove('wifi-connection-button-select');
      $id('usb-connection-button').dataset.checked = true;
      $id('usb-connection-button').classList.add('usb-connection-button-select');
      $id('wifi-connection-settings').classList.add('hiddenElement');
      $id('usb-connection-settings').classList.remove('hiddenElement');
    };

    $id('wifi-connection-button').onclick = function() {
      $id('wifi-connection-button').dataset.checked = true;
      $id('wifi-connection-button').classList.add('wifi-connection-button-select');
      $id('usb-connection-button').dataset.checked = false;
      $id('usb-connection-button').classList.remove('usb-connection-button-select');
      $id('usb-connection-settings').classList.add('hiddenElement');
      $id('wifi-connection-settings').classList.remove('hiddenElement');
    };

    $id('wifi-connection-code').onkeyup = function() {
      this.value = this.value.replace(/\D/g, '');
    }

    $id('wifi-connection-code').onafterpaste = function() {
      this.value = this.value.replace(/\D/g, '');
    }

    $id('wifi-connect-button').onclick = function() {
      var wifiCode = $id('wifi-connection-code');
      if (!wifiCode || !wifiCode.value.trim()) {
        return;
      }
      var ip = '';
      var dataArray = new ArrayBuffer(4);
      var int8Array = new Uint8Array(dataArray);
      var int32Array = new Uint32Array(dataArray);
      int32Array[0] = parseInt(wifiCode.value);
      ip = int8Array[0].toString() + '.' + int8Array[1].toString() + '.' + int8Array[2].toString() + '.' + int8Array[3].toString();
      if (int32Array[0] == 0
          || int8Array[0] == 0
          || int8Array[0] == 127
          || int8Array[0] > 223
          || int8Array[3] == 0
          || int8Array[3] == 255) {
        new AlertDialog({
          message: _('wifi-code-error')
        });
        return;
      }
      ip = int8Array[0].toString() + '.' + int8Array[1].toString() + '.' + int8Array[2].toString() + '.' + int8Array[3].toString();
      var elem = $id('mgmt-list');
      $expr('.header', elem)[0].textContent = wifiCode.value;
      if (ip) {
        $id('device-name').innerHTML = wifiCode;
        connectToServer(ip);
      }
    };

    $id('help_btn').onclick = function(e) {
      var url = '';
      if (navigator.mozL10n.language.code == 'zh-CN') {
        //url = 'http://os.firefox.com.cn/zh-CN/about/help.html';
        url = 'chrome://ffosassistant/content/Help/Help-cn.html';
      } else {
        url = 'chrome://ffosassistant/content/Help/Help-en.html';
      }
      window.open(url);
    };
    ViewManager.showContent('connect-view');
  }

  var observerService = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);

  function Observer()
  {
    this.register();
  }

  Observer.prototype = {
    observe: function(subject, topic, data) {
      devicesList = JSON.parse(data);
      connectToDevice();
    },
    register: function() {
      observerService.addObserver(this, "init-devices", false);
    },
    unregister: function() {
      observerService.removeObserver(this, "init-devices");
    }
  };

  function init() {
    $id('lang-settings').addEventListener('click', function onclick_langsetting(event) {
      if (!event.target.classList.contains('language-code-button')) {
        return;
      }
      navigator.mozL10n.language.code = event.target.dataset.languageCode;
      $expr('.language-code-button', this).forEach(function(elem) {
        elem.classList.remove('current');
      });
      event.target.classList.add('current');
    });
    $id('connect-button').addEventListener('click', function onclick_connect(event) {
      connectToDevice();
    });
    $id('disconnect-button').addEventListener('click', function onclick_disconnect(event) {
      releaseConnPool();
      if (!isWindows()) {
        isWifiConnected = false;
      }
      showConnectView();
      ViewManager.reset();
    });
    customEventElement.addEventListener('firstshow', function(e) {
      switch (e.detail.type) {
        case 'summary-view':
          getAndShowSummaryInfo(e.detail.data);
          break;
        case 'contact-view':
          ContactList.init(e.detail.data);
          break;
        case 'sms-view':
          SmsList.init(e.detail.data);
          break;
        case 'music-view':
          MusicList.init(e.detail.data);
          break;
        case 'gallery-view':
          Gallery.init(e.detail.data);
          break;
        case 'video-view':
          Video.init(e.detail.data);
          break;
        default:
          break;
      }
    });
    customEventElement.addEventListener('othershow', function(e) {
      switch (e.detail.type) {
        case 'summary-view':
          getAndShowStorageInfo(e.detail.data);
          break;
        case 'contact-view':
          ContactList.show(e.detail.data);
          break;
        case 'sms-view':
          SmsList.resetView();
          break;
        default:
          break;
      }
    });
    if (!animationLoading) {
      animationLoading = new animationLoadingDialog();
    }
    showConnectView();
    observer = new Observer();
    observerService.notifyObservers(null, 'chrome-start-connection', '');
  }

  window.addEventListener('unload', function window_onunload(event) {
    window.removeEventListener('unload', window_onunload);
    bInit = false;
    if (observer) {
      observer.unregister();
    }
    releaseConnPool();
  });

  window.addEventListener('localized', function showBody() {
    document.documentElement.lang = navigator.mozL10n.language.code;
    document.documentElement.dir = navigator.mozL10n.language.direction;
    document.body.hidden = false;
    $expr('#lang-settings .language-code-button').forEach(function(label) {
      if (label.dataset.languageCode == navigator.mozL10n.language.code) {
        label.classList.add('current');
      } else {
        label.classList.remove('current');
      }
    });
    if (!bInit) {
      bInit = true;
      init();
    }
  });

  return {
    sendRequest: function(obj) {
      if (connPool) {
        connPool.send(obj);
      }
    },

    sendListenRequest: function(obj) {
      if (connListenSocket) {
        obj.cmd = extend({
          cmd: null,
          data: null,
          datalength: 0,
          json: false
        }, obj.cmd);
        obj.cmd.id = 1;
        connListenSocket.send(obj.cmd, obj.cmd.data);
      }
    }
  };
})();
