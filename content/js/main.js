/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, 'ADBService', 'resource://ffosassistant/ADBService.jsm');

var connectState = {
  disconnected: 1,
  connected: 2,
  connecting: 3,
  error: 4
};
var storageInfoList = [];
var connectedDevice = '';
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

  function showUsbConnection() {
    $id('wifi-connection-button').dataset.checked = false;
    $id('devices').innerHTML = '';
    var html = '<p data-l10n-id="extenal-devices"></p>';
    devicesList = ADBService.getAvailable();
    if (devicesList.length == 0) {
      $id('device-list').style.display = 'none';
      $id('device-list-empty').style.display = 'block';
    } else {
      $id('device-list-empty').style.display = 'none';
      for (var i = 0; i < devicesList.length; i++) {
        if (i == 0 ) {
          html += '<input type="radio" name="device" checked value="' + devicesList[i] + '">' + devicesList[i] + '</input><br/>';
        } else {
          html += '<input type="radio" name="device" value="' + devicesList[i] + '">' + devicesList[i] + '</input></br>';
        }
      }
      $id('devices').innerHTML = html;
      $id('device-list').style.display = 'block';
    }
    $id('usb-connection-button').dataset.checked = true;
  }

  function showSummaryView() {
    $id('connect-button').classList.add('hiddenElement');
    $id('disconnect-button').classList.remove('hiddenElement');
    $id('device-empty').classList.add('hiddenElement');
    $id('device-name').classList.remove('hiddenElement');

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

  function getStorageInfo() {
    var loadingGroupId = animationLoading.start();
    CMD.Device.getStorage(function onresponse_getDeviceInfo(message) {
      var dataJSON = JSON.parse(message.data);
      var container = $id('summary-infos');
      container.innerHTML = '';
      storageInfoList = [];
      for (var uname in dataJSON) {
        var elem = document.createElement('div');
        var templateData = {
          headerId: uname + '-header',
          bodyId: uname + '-body',
          storageName: uname,
          storageNumber: '',
          storageUsed: '',
          pictureUsed: '',
          musicUsed: '',
          videoUsed: ''
        };

        total = dataJSON[uname].sdcard.usedSpace + dataJSON[uname].sdcard.freeSpace;
        var storageInfo = {
          name: uname,
          id: dataJSON[uname].id,
          path: '',
          totalSpace: total,
          freeSpace: dataJSON[uname].sdcard.freeSpace
        };
        storageInfoList.push(storageInfo);
        if (total > 0) {
          templateData.storageUsed = Math.floor(dataJSON[uname].sdcard.usedSpace / total * 100) + '%';
          templateData.storageNumber = formatStorage(dataJSON[uname].sdcard.usedSpace) + '/' + formatStorage(total) + ' ' + templateData.storageUsed;
          templateData.pictureUsed = Math.floor(dataJSON[uname].pictures.usedSpace / total * 100) + '%';
          templateData.musicUsed = Math.floor(dataJSON[uname].music.usedSpace / total * 100) + '%';
          templateData.videoUsed = Math.floor(dataJSON[uname].videos.usedSpace / total * 100) + '%';
        } else {
          templateData.storageNumber = '0.00M/0.00M';
          templateData.storageUsed = '0%';
          templateData.pictureUsed = '0%';
          templateData.musicUsed = '0%';
          templateData.videoUsed = '0%';
        }
        elem.innerHTML = tmpl('tmpl_storage_summary', templateData);
        container.appendChild(elem);
        navigator.mozL10n.translate(elem);
        $id(templateData.headerId).dataset.body = templateData.bodyId;
        $id(templateData.headerId).onmouseover = function() {
          var body = $id(this.dataset.body);
          summaryHeadMouseOver(this, body);
        };
        $id(templateData.headerId).onmouseout = summaryHeadMouseout;
        $id(templateData.headerId).onclick = function() {
          var body = $id(this.dataset.body);
          summaryHeadClick(this, body);
        };
      }
      if (storageInfoList.length == 1) {
        storageInfoList[0].path = 'sdcard';
      } else if (storageInfoList.length > 1) {
        for (var i = 0; i < storageInfoList.length; i ++) {
          storageInfoList[i].path = 'storage/sdcard' + storageInfoList[i].id;
        }
      }
      console.log(storageInfoList);
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

  function getVersionandShow() {
    CMD.Device.getVersion(function onresponse_getDeviceInfo(message) {
      var clientVer = parseInt(message.data);
      if (clientVer > 2) {
        getStorageInfo();
      } else {
        //Todo: msg-please-download-from-marketplace
      }
    }, function onerror_getStorage(message) {
      //Todo: msg-please-download-from-marketplace
    });
  }

  function connectToDevice() {
    if (deviceSocketState == connectState.connected) {
      releaseConnPool();
      resetConnect();
    }
    if (deviceSocketState == connectState.connecting) {
      return;
    }
    deviceSocketState = connectState.connecting;

    if (devicesList.length == 0 ) {
      return;
    }

    var loadingGroupId = animationLoading.start();
    var deviceName = devicesList[0];
    $id('device-name').innerHTML = deviceName;
    ADBService.setupDevice(deviceName);
    setTimeout(function() {
      connectToServer('localhost');
    }, 1000);
    animationLoading.stop(loadingGroupId);
    return;
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
        if (deviceSocketState == connectState.connected) {
          releaseConnPool();
          resetConnect();
        } else if (deviceSocketState == connectState.connecting) {
          releaseConnPool();
          var contentInfo = [_('connection-alert-dialog-message-check-runapp')];
          if (isWifiConnected) {
            contentInfo.push(_('connection-alert-dialog-message-check-wificode'));
          }
          var url = 'chrome://ffosassistant/content/Help/Help-en.html';
          if (navigator.mozL10n.language.code == 'zh-CN') {
            url = 'chrome://ffosassistant/content/Help/Help-cn.html';
          }
          new AlertDialog({
            id: 'popup_dialog',
            titleL10nId: 'alert-dialog-title',
            message: {
              head: _('connection-alert-dialog-title'),
              description: _('connection-alert-dialog-message-header'),
              content: contentInfo,
              detail: _('connection-alert-dialog-detail'),
              href: url
            },
            okCallback: resetConnect,
            cancelCallback: resetConnect
          });
        }
      },
      onconnected: function onconnected() {
        animationLoading.stop(loadingGroupId);
        $id('sidebar').style.display = 'block';
        if (deviceSocketState != connectState.connecting) {
          return;
        }
        deviceSocketState = connectState.connected;
        if (serverIP != 'localhost') {
          isWifiConnected = true;
        } else {
          isWifiConnected = false;
        }
        if (connListenSocket) {
          connListenSocket.socket.close();
          connListenSocket = null;
        }
        var socket = connPool.TCPSocket.open(serverIP, REMOTE_PORT, {
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
              if (message == null) {
                return;
              }
              var event = new CustomEvent('dataChange',{'detail': {'type': message.type, 'data': message}});
              customEventElement.dispatchEvent(event);
            },
            onclose: function() {
              connListenSocket = null;
            }
          });
          CMD.Listen.listenMessage(null, null);
        };
        showSummaryView();
      },
      ondisconnected: function ondisconnected() {
        animationLoading.stop(loadingGroupId);
        releaseConnPool();
        if (deviceSocketState == connectState.connecting) {
          var contentInfo = [_('connection-alert-dialog-message-check-runapp')];
          var url = 'chrome://ffosassistant/content/Help/Help-en.html';
          if (navigator.mozL10n.language.code == 'zh-CN') {
            url = 'chrome://ffosassistant/content/Help/Help-cn.html';
          }
          new AlertDialog({
            id: 'popup_dialog',
            titleL10nId: 'alert-dialog-title',
            message: {
              head: _('connection-alert-dialog-title'),
              description: _('connection-alert-dialog-message-header'),
              content: contentInfo,
              detail: _('connection-alert-dialog-detail'),
              href: url
            },
            okCallback: resetConnect,
            cancelCallback: resetConnect
          });
        } else{
           resetConnect();
        }
      }
    });
  }

  function showConnectView() {
    animationLoading.reset();
    $id('sidebar').style.display = 'none';
    MusicList.resetView();
    if (connListenSocket) {
      connListenSocket.socket.close();
      connListenSocket = null;
    }
    $id('connect-button').classList.remove('hiddenElement');
    $id('disconnect-button').classList.add('hiddenElement');
    $id('device-empty').classList.remove('hiddenElement');
    $id('device-name').classList.add('hiddenElement');
    $id('device-connected').classList.add('hiddenElement');
    $id('device-unconnected').classList.remove('hiddenElement');
    $id('views').classList.add('hidden-views');
    $id("mgmt-list").hidden = true;

    $id('usb-connection-button').onclick = showUsbConnection;
    $id('wifi-connection-button').onclick = function() {
      $id('wifi-connection-button').dataset.checked = true;
      $id('usb-connection-button').dataset.checked = false;
      $id('wifi-connection-code').fucus = true;
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
      if (ip) {
        $id('device-name').innerHTML = wifiCode.value;
        deviceSocketState = connectState.connecting;
        connectToServer(ip);
      }
    };
    $id('usb-connect-button').onclick = function() {
      $expr('input[name="device"]').forEach(function(input) {
        if (input.checked) {
          ADBService.setupDevice(input.value);
          connectToDevice();
        }
      });
    };
    $id('help-button').onclick = function(e) {
      var url = 'chrome://ffosassistant/content/Help/Help-en.html';
      if (navigator.mozL10n.language.code == 'zh-CN') {
        url = 'chrome://ffosassistant/content/Help/Help-cn.html';
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
      if ($id('usb-connection-button').dataset.checked == 'true') {
        showUsbConnection();
      }
    },
    register: function() {
      observerService.addObserver(this, "ffosassistant-init-devices", false);
    },
    unregister: function() {
      observerService.removeObserver(this, "ffosassistant-init-devices");
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
      observerService.notifyObservers(null, 'ffosassistant-start-connection', '');
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
          getVersionandShow();
          break;
        case 'contact-view':
          ContactList.init(e.detail.data);
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
          getStorageInfo(e.detail.data);
          break;
        case 'contact-view':
          ContactList.show(e.detail.data);
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
    observerService.notifyObservers(null, 'ffosassistant-start-connection', '');
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
