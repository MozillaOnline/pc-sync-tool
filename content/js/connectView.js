Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, 'ADBService', 'resource://ffosassistant/ADBService.jsm');

var ConnectView = (function() {
  var connectState = {
    disconnected: 1,
    connected: 2,
    connecting: 3,
    error: 4
  };
  var connectViewId = "connect-view";
  var isWifiConnected = false;
  var observer = null;
  var devicesList = null;
  var needUpdateAdbHelper = false;
  var adbHelperInstalled = false;
  var minAdbHelperVersion = '0.6.0';
  var deviceSocketState = connectState.disconnected;
  var alertDialog = null;
  var connectLoadingId = -1;
  function init() {
    this.isWifiConnected = false;
    this.connectLoadingId = -1;
    document.addEventListener(CMD_ID.app_connected, function(e) {
      ConnectView.deviceSocketState = connectState.connected;
      ConnectView.alertDialog = new AlertDialog({
        message: _('connection-info-wait-accept'),
        showOkButton: false,
        cancelCallback: ConnectView.reset
      });
    });
    document.addEventListener(CMD_ID.app_disconnect, function(e) {
      ConnectView.reset();
      var event = new CustomEvent(CHANGE_SELECTED_VIEW,
                                  {'detail': "side-view"});
      document.dispatchEvent(event);
    });
    document.addEventListener(CMD_ID.app_accepted, function(e) {
      $id('device-connected').classList.remove('hiddenElement');
      $id('device-unconnected').classList.add('hiddenElement');
      if (ConnectView.alertDialog) {
        ConnectView.alertDialog.close();
        ConnectView.alertDialog = null;
      }
      var event = new CustomEvent(CHANGE_SELECTED_VIEW,
                                  {'detail': "storage-tab"});
      document.dispatchEvent(event);
    });
    document.addEventListener(CMD_ID.app_rejected, function(e) {
      ConnectView.reset();
    });
    document.addEventListener(CMD_ID.app_error, function(e) {
      ConnectView.reset();
      var event = new CustomEvent(CHANGE_SELECTED_VIEW,
                                  {'detail': "side-view"});
      document.dispatchEvent(event);
      //display error
      var contentInfo = [_('connection-alert-dialog-message-check-version')];
      if (ConnectView.isWifiConnected) {
        contentInfo.push(_('connection-alert-dialog-message-check-wificode'));
      }
      var url = 'http://os.firefox.com.cn/pcsync.html';
      if (navigator.mozL10n.language.code == 'zh-CN') {
        url = 'http://os.firefox.com.cn/pcsync-cn.html';
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
        okCallback: null,
        cancelCallback: null
      });
    });
    document.addEventListener(DISCONNECT_CURRENT_DEVICE, function(e) {
      ConnectView.reset();
    });
    $id('usb-connection-button').onclick = function() {
      if ($id('usb-connection-button').dataset.checked == 'true') {
        return;
      }
      _showUsbConnection();
    };
    $id('wifi-connection-button').onclick = function() {
      if ($id('wifi-connection-button').dataset.checked == 'true') {
        return;
      }
      $id('wifi-connection-button').dataset.checked = true;
      $id('usb-connection-button').dataset.checked = false;
      $id('wifi-connection-code').focus();
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
        ConnectView.deviceSocketState = connectState.connecting;
        ConnectView.connectLoadingId = AppManager.animationLoadingDialog.startAnimation();
        _connectToServer(ip);
      }
    };
    $id('usb-connect-button').onclick = function() {
      $expr('input[name="device"]').forEach(function(input) {
        if (input.checked) {
          ADBService.setupDevice(input.value);
          _connectToDevice();
        }
      });
    };
    $id('help').onclick = function(e) {
      var url = 'http://os.firefox.com.cn/pcsync.html';
      if (navigator.mozL10n.language.code == 'zh-CN') {
        url = 'http://os.firefox.com.cn/pcsync-cn.html';
      }
      window.open(url);
    };
    $id('help-button').onclick = function(e) {
      var url = 'http://os.firefox.com.cn/pcsync.html';
      if (navigator.mozL10n.language.code == 'zh-CN') {
        url = 'http://os.firefox.com.cn/pcsync-cn.html';
      }
      window.open(url);
    };
    SocketManager.init();
    ConnectView.observer = new Observer();
    observerService.notifyObservers(null, 'ffosassistant-start-connection', '');
  }

  function show() {
    $id(connectViewId).hidden = false;
    $id('wifi-connection-code').focus();
  }

  function hide() {
    $id(connectViewId).hidden = true;
  }

  function reset() {
    $id('device-connected').classList.add('hiddenElement');
    $id('device-unconnected').classList.remove('hiddenElement');
    ConnectView.deviceSocketState = connectState.disconnected;
    SocketManager.stop();
    if (ConnectView.alertDialog) {
      ConnectView.alertDialog.close();
      ConnectView.alertDialog = null;
    }
    if (ConnectView.connectLoadingId >= 0) {
      AppManager.animationLoadingDialog.stopAnimation(ConnectView.connectLoadingId);
      ConnectView.connectLoadingId = -1;
    }
  }

  function _showUsbConnection() {
    $id('wifi-connection-button').dataset.checked = false;
    $id('devices').innerHTML = '';
    var html = '';
    getAdbHelperInfo(function(addon) {
      if (!addon) {
        ConnectView.adbHelperInstalled = false;
        return;
      }
      ConnectView.adbHelperInstalled = true;
      if (checkAdbHelperVersion(addon.version, ConnectView.minAdbHelperVersion) < 0) {
        ConnectView.needUpdateAdbHelper = true;
      } else {
        ConnectView.needUpdateAdbHelper = false;
      }
    });
    ConnectView.devicesList = ADBService.getAvailable();
    if (ConnectView.devicesList.length == 0) {
      $id('device-list').style.display = 'none';
      $id('device-list-empty').style.display = 'block';
    } else {
      var templateData = {
        devicesList: ConnectView.devicesList
      };
      $id('devices').innerHTML = tmpl('tmpl_adb_devices', templateData);
      $id('device-list-empty').style.display = 'none';
      $id('device-list').style.display = 'block';
    }
    $id('usb-connection-button').dataset.checked = true;
  }

  function _connectToDevice() {
    if (ConnectView.deviceSocketState == connectState.connecting) {
      return;
    }
    ConnectView.deviceSocketState = connectState.connecting;
    if (ConnectView.devicesList.length == 0 ) {
      return;
    }
    ConnectView.connectLoadingId = AppManager.animationLoadingDialog.startAnimation();
    ADBService.setupDevice(ConnectView.devicesList[0]);
    setTimeout(function() {
      _connectToServer('localhost');
    }, 1000);
    return;
  }

  function _connectToServer(serverIP) {
    if (serverIP != 'localhost') {
      ConnectView.isWifiConnected = true;
    } else {
      ConnectView.isWifiConnected = false;
    }
    SocketManager.start(serverIP);
  }

  var observerService = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);

  function Observer()
  {
    this.register();
  }

  Observer.prototype = {
    observe: function(subject, topic, data) {
      ConnectView.devicesList = JSON.parse(data);
      if ($id('usb-connection-button').dataset.checked == 'true') {
        _showUsbConnection();
      }
    },
    register: function() {
      observerService.addObserver(this, "ffosassistant-init-devices", false);
    },
    unregister: function() {
      observerService.removeObserver(this, "ffosassistant-init-devices");
    }
  };

  window.addEventListener('unload', function window_onunload(event) {
    window.removeEventListener('unload', window_onunload);
    if (ConnectView.observer) {
      ConnectView.observer.unregister();
    }
    ConnectView.reset();
  });

  return {
    isWifiConnected: isWifiConnected,
    connectLoadingId: connectLoadingId,
    init: init,
    show: show,
    hide: hide
  };
})();