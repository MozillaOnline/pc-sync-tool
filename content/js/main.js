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

var animationLoading = null;

var FFOSAssistant = (function() {
  var connPool = null;
  var connListenSocket = null;
  var heartBeatSocket = null;

  function showConnectView() {
    animationLoading.reset();
    $id('device-connected').classList.add('hiddenElement');
    $id('device-unconnected').classList.remove('hiddenElement');
    $id('views').classList.add('hidden-views');

    $id('usb-connection-button').onclick = function() {
      $id('wifi-connection-button').dataset.checked = false;
      $id('usb-connection-button').dataset.checked = true;
      $id('wifi-arrow').classList.add('hiddenElement');
      $id('usb-arrow').classList.remove('hiddenElement');
      $id('wifi-connection-code-input').classList.add('hiddenElement');
      $id('wifi-connect-button').classList.add('hiddenElement');
      $id('wifi-connection-button').classList.remove('wifi-connection-button-select');
      $id('usb-connection-button').classList.add('usb-connection-button-select');
      $id('step-one').classList.remove('step-one-wifi');
      $id('step-two').classList.remove('step-two-wifi');
      $id('step-two').classList.add('step-two-usb');
      $id('step-three').classList.remove('step-three-wifi');
      $id('step-one-span').textContent = _('usb-step-one');
      $id('step-three-span').textContent = _('usb-step-three');
      $id('step-one-span').dataset.l10nId = 'usb-step-one';
      $id('step-three-span').dataset.l10nId = 'usb-step-three';
      navigator.mozFFOSAssistant.switchConnectionMode('USB', 'localhost');
    };

    $id('wifi-connection-button').onclick = function() {
      $id('wifi-connection-button').dataset.checked = true;
      $id('usb-connection-button').dataset.checked = false;
      $id('usb-arrow').classList.add('hiddenElement');
      $id('wifi-arrow').classList.remove('hiddenElement');
      $id('wifi-connection-code-input').classList.remove('hiddenElement');
      $id('wifi-connect-button').classList.remove('hiddenElement');
      $id('wifi-connection-button').classList.add('wifi-connection-button-select');
      $id('usb-connection-button').classList.remove('usb-connection-button-select');
      $id('step-one').classList.add('step-one-wifi');
      $id('step-two').classList.remove('step-two-usb');
      $id('step-two').classList.add('step-two-wifi');
      $id('step-three').classList.add('step-three-wifi');
      $id('step-one-span').textContent = _('wifi-step-one');
      $id('step-three-span').textContent = _('wifi-step-three');
      $id('step-one-span').dataset.l10nId = 'wifi-step-one';
      $id('step-three-span').dataset.l10nId = 'wifi-step-three';
    };

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
      var elem = $id('mgmt-list');
      $expr('.header', elem)[0].textContent = wifiCode.value;

      navigator.mozFFOSAssistant.switchConnectionMode('WIFI', ip);
      connectToDevice(ip);
    };

    ViewManager.showContent('connect-view');
  }

  function showSummaryView(serverIP) {
    if (connListenSocket) {
      connListenSocket.socket.close();
      connListenSocket = null;
    }

    var socket = navigator.mozTCPSocket.open(serverIP, 10010, {
      binaryType: 'arraybuffer'
    });
    socket.onopen = function tc_onSocketOpened(event) {
      var socketWrapper = new TCPSocketWrapper({
        socket: event.target,
        onmessage: function(socket, jsonCmd, sendCallback, recvData) {
          if (connListenSocket == null) {
            return;
          }
          var message = JSON.parse(recvData);
          if (message.type == 'sms') {
            ViewManager.callEvent('onMessage', 'sms', message);
          } else if (message.type == 'contact') {
            ViewManager.callEvent('onMessage', 'contact', message);
            ViewManager.callEvent('onMessage', 'sms', 'updateAvatar');
          }
        },
        onclose: function() {
          connListenSocket = null;
        }
      });
      connListenSocket = socketWrapper;
      CMD.Listen.listenMessage(null, null);
    };
    $id('device-disconnect').addEventListener('click', function onclick_disconnect(event) {
      if (connPool) {
        connPool.finalize();
        connPool = null;
      }
      if (heartBeatSocket) {
        heartBeatSocket.close();
      }
      showConnectView();
      ViewManager.reset();
    });
    if (navigator.mozFFOSAssistant.isWifiConnected) {
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

  function fillDeviceStorageSummaryInfo(info) {
    var elem = $id('device-storage-summary');
    var total = info.usedInBytes + info.freeInBytes;
    if (total > 0) {
      var usedInP = Math.floor(info.usedInBytes / total * 100) + '%';
      $expr('.storage-number', elem)[0].textContent =
        formatStorage(info.usedInBytes) + '/' + formatStorage(total) + ' ' + usedInP;
      $expr('.storage-graph .used', elem)[0].style.width = usedInP;
    } else {
      $expr('.storage-number', elem)[0].textContent = '0.00M/0.00M';
      $expr('.storage-graph .used', elem)[0].style.width = '0%';
    }
  }

  function fillSdcardStorageSummaryInfo(info) {
    var elem = $id('sdcard-storage-summary');
    var total = info.usedInBytes + info.freeInBytes;
    if (total > 0) {
      var usedInP = Math.floor(info.usedInBytes / total * 100) + '%';
      $expr('.storage-number', elem)[0].textContent =
        formatStorage(info.usedInBytes) + '/' + formatStorage(total) + ' ' + usedInP;
      $expr('.storage-graph .used', elem)[0].style.width = usedInP;
      var subInP = Math.floor(info.picture / info.usedInBytes * 100);
      $expr('.storage-used', elem)[0].style.width = subInP + '%';
      subInP = Math.floor(info.music / info.usedInBytes * 100);
      $expr('.storage-used', elem)[1].style.width = subInP + '%';
      subInP = Math.floor(info.video / info.usedInBytes * 100);
      $expr('.storage-used', elem)[2].style.width = subInP + '%';
      subInP = Math.floor((info.usedInBytes - info.music - info.picture - info.video) / info.usedInBytes * 100);
      $expr('.storage-used', elem)[3].style.width = subInP + '%';
    } else {
      $expr('.storage-number', elem)[0].textContent = '0.00M/0.00M';
      $expr('.storage-graph .used', elem)[0].style.width = '0%';
      var storageIndicators = $expr('.storage-used', elem);
      for (var i = 0; i < 4; i++) {
        storageIndicators[i].style.width = '0%';
      }
    }
  }

  function getAndShowStorageInfo() {
    var loadingGroupId = animationLoading.start();
    CMD.Device.getStorage(function onresponse_getDeviceInfo(message) {
      var deviceInfo = {
        usedInBytes: 0,
        freeInBytes: 0
      };
      var sdcardInfo = {
        usedInBytes: 0,
        freeInBytes: 0,
        picture: 0,
        music: 0,
        video: 0
      };

      var dataJSON = JSON.parse(message.data);
      for (var i = 0; i < dataJSON.length; i++) {
        if (dataJSON[i].storageName == 'apps') {
          deviceInfo.usedInBytes = dataJSON[i].usedSpace;
          deviceInfo.freeInBytes = dataJSON[i].freeSpace;
        } else if (dataJSON[i].storageName == 'sdcard') {
          sdcardInfo.usedInBytes = dataJSON[i].usedSpace;
          sdcardInfo.freeInBytes = dataJSON[i].freeSpace;
        } else if (dataJSON[i].storageName == 'pictures') {
          sdcardInfo.picture = dataJSON[i].usedSpace;
        } else if (dataJSON[i].storageName == 'music') {
          sdcardInfo.music = dataJSON[i].usedSpace;
        } else if (dataJSON[i].storageName == 'videos') {
          sdcardInfo.video = dataJSON[i].usedSpace;
        }
      }
      fillDeviceStorageSummaryInfo(deviceInfo);
      fillSdcardStorageSummaryInfo(sdcardInfo);
      animationLoading.stop(loadingGroupId);
    }, function onerror_getStorage(message) {
      animationLoading.stop(loadingGroupId);
      console.log('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });
  }

  function getAndShowSummaryInfo() {
    var loadingGroupId = animationLoading.start();
    getAndShowStorageInfo();
    CMD.Device.getSettings(function onresponse_getDeviceInfo(message) {
      var dataJSON = JSON.parse(message.data);
      var elem = $id('device-storage-summary');
      $expr('.device-os-version-number', elem)[0].textContent = dataJSON["deviceinfo.os"];
      $expr('.device-hardware-revision-number', elem)[0].textContent = dataJSON["deviceinfo.hardware"];
      $expr('.device-platform-version-number', elem)[0].textContent = dataJSON["deviceinfo.platform_version"];
      $expr('.device-build-identifier-number', elem)[0].textContent = dataJSON["deviceinfo.platform_build_id"];
      animationLoading.stop(loadingGroupId);
    }, function onerror_getSettings(message) {
      animationLoading.stop(loadingGroupId);
      console.log('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });
  }

  function connectToDevice(serverIP) {
    var timeout = null;

    if (connPool) {
      connPool.finalize();
      connPool = null;
    }

    connPool = new TCPConnectionPool({
      host: serverIP,
      size: 2,
      onenable: function onenable() {
        timeout = window.setTimeout(function imedb_cacheTimeout() {
          showSummaryView(serverIP);
        }, 1000);
      },
      ondisable: function ondisable() {
        log('USB Socket is closed');
        window.clearTimeout(timeout);
        showConnectView();
        socket = null;
        ViewManager.reset();
      }
    });
  }

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
    if (!animationLoading) {
      animationLoading = new animationLoadingDialog();
    }
    showConnectView();
    if (navigator.mozFFOSAssistant) {
      navigator.mozFFOSAssistant.onadbstatechange = function onADBStateChange(event) {
        if (navigator.mozFFOSAssistant.adbConnected === true) {
          var devicename = navigator.mozFFOSAssistant.adbffosDeviceName;
          var elem = $id('mgmt-list');
          $expr('.header', elem)[0].textContent = devicename;
          connectToDevice('localhost');
        }
      };

      if (navigator.mozFFOSAssistant.adbConnected === true) {
        var devicename = navigator.mozFFOSAssistant.adbffosDeviceName;
        var elem = $id('mgmt-list');
        $expr('.header', elem)[0].textContent = devicename;
        connectToDevice('localhost');
      }
    }

    // Register view event callbacks
    ViewManager.addViewEventListener('summary-view', 'firstshow', getAndShowSummaryInfo);
    ViewManager.addViewEventListener('summary-view', 'othershow', getAndShowStorageInfo);
    ViewManager.addViewEventListener('contact-view', 'firstshow', ContactList.init);
    ViewManager.addViewEventListener('contact-view', 'othershow', ContactList.init);
    ViewManager.addViewEventListener('sms-view', 'firstshow', SmsList.init);
    ViewManager.addViewEventListener('sms-view', 'othershow', SmsList.init);
    ViewManager.addViewEventListener('music-view', 'firstshow', MusicList.init);
    ViewManager.addViewEventListener('gallery-view', 'firstshow', Gallery.init);
    ViewManager.addViewEventListener('video-view', 'firstshow', Video.init);
  }

  window.addEventListener('load', function window_onload(event) {
    window.removeEventListener('load', window_onload);
    init();
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
