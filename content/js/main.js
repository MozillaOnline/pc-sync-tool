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
var customEventElement = document;
var FFOSAssistant = (function() {
  var connPool = null;
  var connListenSocket = null;

  function showConnectView() {
    animationLoading.reset();
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

    $id('help_btn').onclick = function(e) {
      var url = '';
      if (navigator.language == 'zh-CN') {
        url = 'http://os.firefox.com.cn/zh-CN/about/help.html';
      } else {
        url = 'http://os.firefox.com.cn/en-US/about/help.html';
      }
      window.open(url);
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
    $id('device-disconnect').addEventListener('click', function onclick_disconnect(event) {
      if (connPool) {
        connPool.finalize();
        connPool = null;
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
    customEventElement.addEventListener('firstshow', function(e) {
      switch(e.detail.type) {
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
      switch(e.detail.type) {
      case 'summary-view':
        getAndShowStorageInfo(e.detail.data);
        break;
      case 'contact-view':
        ContactList.init(e.detail.data);
        break;
      case 'sms-view':
        SmsList.init(e.detail.data);
        break;
      default:
        break;
      }
    });
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
