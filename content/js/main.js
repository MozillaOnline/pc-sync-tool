/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */


var FFOSAssistant = (function() {
  var connPool = null;
  var connListenPool = null;
  var handlerUsbConnection = null;
  var handlerWifiConnection = null;
  var handlerWifiConnect = null;
  var wsurl = "ws://" + location.host + "/ws";
  var heartBeatSocket = null;

  function showConnectView() {
    $id('device-connected').classList.add('hiddenElement');
    $id('device-unconnected').classList.remove('hiddenElement');
    $id('views').classList.add('hidden-views');

    if (handlerUsbConnection) {
      $id('usb-connection-button').removeEventListener('click', handlerUsbConnection,false);
    }
    handlerUsbConnection = function () {
      $id('wifi-arrow').classList.add('hiddenElement');
      $id('usb-arrow').classList.remove('hiddenElement');
      $id('wifi-connection-code-input').classList.add('hiddenElement');
      $id('wifi-connect-button').classList.add('hiddenElement');
      $id('step-one').textContent = _('usb-step-one');
      $id('step-two').textContent = _('usb-step-two');
      $id('step-three').textContent = _('usb-step-three');
    };
    $id('usb-connection-button').addEventListener ('click', handlerUsbConnection,false);

    if (handlerWifiConnection) {
      $id('wifi-connection-button').removeEventListener('click', handlerWifiConnection,false);
    }
    handlerWifiConnection = function () {
      $id('usb-arrow').classList.add('hiddenElement');
      $id('wifi-arrow').classList.remove('hiddenElement');
      $id('wifi-connection-code-input').classList.remove('hiddenElement');
      $id('wifi-connect-button').classList.remove('hiddenElement');
      $id('step-one').textContent = _('wifi-step-one');
      $id('step-two').textContent = _('wifi-step-two');
      $id('step-three').textContent = _('wifi-step-three');
    };
    $id('wifi-connection-button').addEventListener ('click', handlerWifiConnection,false);

    if (handlerWifiConnect) {
      $id('wifi-connect-button').removeEventListener('click', handlerWifiConnect,false);
    }
    handlerWifiConnect = function () {
      var wifiCode = $id('wifi-connection-code-input');
      if(wifiCode && wifiCode.value && wifiCode.value.length > 0){
	var ip = '';
	var dataArray = new ArrayBuffer(4);
	var int8Array = new Uint8Array(dataArray);
	var int32Array = new Uint32Array(dataArray);
	int32Array[0] = parseInt(wifiCode.value);
	ip = int8Array[0].toString() + '.' + int8Array[1].toString() + '.' + int8Array[2].toString() + '.' + int8Array[3].toString();
        var elem = $id('mgmt-list');
        $expr('.header', elem)[0].textContent = wifiCode.value;
	if (navigator.mozFFOSAssistant) {
	  heartBeatSocket = navigator.mozTCPSocket.open(ip, 10010);
	  heartBeatSocket.onclose = function onclose_socket() {
	    navigator.mozFFOSAssistant.wifiConnected(false);
	  };
	  heartBeatSocket.onopen = function onclose_socket() {
	    navigator.mozFFOSAssistant.wifiConnected(true);
	  };
	}
	connectToDevice(ip);
      }
    };
    $id('wifi-connect-button').addEventListener ('click', handlerWifiConnect,false);

    ViewManager.showContent('connect-view');
  }

  function showSummaryView(serverIP) {
    if (connListenPool) {
      connListenPool.finalize();
      connListenPool = null;
    }

    connListenPool = new TCPListenConnectionPool({
      host: serverIP,
      onListening: function onListening(message) {
        if (message.type == 'sms') {
          SmsList.onMessage(message);
        } else if (message.type == 'contact') {
          ContactList.onMessage(message);
          SmsList.onMessage('updateAvatar');
        }
      }
    });

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
      return (sizeInGiga.toFixed ? sizeInGiga.toFixed(2) : sizeInGiga) + 'G';
    }

    return (sizeInMega.toFixed ? sizeInMega.toFixed(2) : sizeInMega) + 'M';
  }

  function fillStorageSummaryInfo(elemId, info) {
    var elem = $id(elemId);
    var total = info.usedInBytes + info.freeInBytes;
    if (total > 0 ) {
      var usedInP = Math.floor(info.usedInBytes / total * 100) + '%';
      $expr('.storage-number', elem)[0].textContent =
        formatStorage(info.usedInBytes) + '/' + formatStorage(total) + ' ' + usedInP;
      $expr('.storage-graph .used', elem)[0].style.width = usedInP;

      if (elemId =='sdcard-storage-summary' ) {
        var subInP = Math.floor(info.picture / info.usedInBytes * 100);

        if (subInP == 0) {
          subInP = 1;
        }

        $expr('.storage-used', elem)[0].style.width = subInP + '%';
        subInP = Math.floor(info.music / info.usedInBytes * 100);

        if (subInP == 0) {
          subInP = 1;
        }

        $expr('.storage-used', elem)[1].style.width = subInP + '%';
        subInP = Math.floor(info.video / info.usedInBytes * 100);

        if (subInP == 0) {
          subInP = 1;
        }

        $expr('.storage-used', elem)[2].style.width = subInP + '%';
        subInP = Math.floor((info.usedInBytes - info.music - info.picture - info.video) / info.usedInBytes * 100);

        if (subInP == 0) {
          subInP = 1;
        }

        $expr('.storage-used', elem)[3].style.width =  subInP + '%';
      }
    } else {
        $expr('.storage-number', elem)[0].textContent = formatStorage(info.usedInBytes) + '/' + formatStorage(total);
    }
  }

  function getAndShowSummaryInfo() {
    CMD.Device.getStorage(function onresponse_getDeviceInfo(message) {
      var deviceInfo = {};
      var sdcardInfo = {
        usedInBytes: 0,
        freeInBytes: 0,
        picture: 0,
        music: 0,
        video:0
      };

      var dataJSON = JSON.parse(message.data);
      deviceInfo.usedInBytes = dataJSON[4].usedSpace;
      deviceInfo.freeInBytes = dataJSON[4].freeSpace;
      sdcardInfo.usedInBytes = dataJSON[3].usedSpace;
      sdcardInfo.freeInBytes = dataJSON[3].freeSpace;
      sdcardInfo.picture = dataJSON[0].usedSpace;
      sdcardInfo.music = dataJSON[1].usedSpace;
      sdcardInfo.video = dataJSON[2].usedSpace;

      fillStorageSummaryInfo('device-storage-summary', deviceInfo);
      fillStorageSummaryInfo('sdcard-storage-summary', sdcardInfo);
    }, function onerror_getStorage(message) {
      console.log('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });

    CMD.Device.getSettings(function onresponse_getDeviceInfo(message) {
      var dataJSON = JSON.parse(message.data);
      var elem = $id('device-storage-summary');
      $expr('.device-os-version-number', elem)[0].textContent = dataJSON["deviceinfo.os"];
      $expr('.device-hardware-revision-number', elem)[0].textContent = dataJSON["deviceinfo.hardware"];
      $expr('.device-platform-version-number', elem)[0].textContent = dataJSON["deviceinfo.platform_version"];
      $expr('.device-build-identifier-number', elem)[0].textContent = dataJSON["deviceinfo.platform_build_id"];
    }, function onerror_getSettings(message) {
      console.log('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });
  }

  /**
   * Show the contact view, and start fetching the contacts data from device.
   */
  function showContactView() {
    ViewManager.showContent('contact-view');
  }

  function getAndShowAllContacts(viewData) {
    CMD.Contacts.getAllContacts(function onresponse_getAllContacts(message) {
      // Make sure the 'select-all' box is not checked.
      ContactList.selectAllContacts(false);
      var dataJSON = JSON.parse(message.data);
      ContactList.init(dataJSON,viewData);
    }, function onerror_getAllContacts(message) {
      log('getAndShowAllContacts Error occurs when fetching all contacts.');
    });
  }

  function getAndShowAllSMSThreads() {
    updateSMSThreads();
  }

  function updateSMSThreads() {
    CMD.SMS.getThreads(function onresponse_getThreads(messages) {
      // Make sure the 'select-all' box is not checked.  
      SmsList.selectAllSms(false); 
      var dataJSON = JSON.parse(messages.data);
      SmsList.init(dataJSON);
    }, function onerror_getThreads(messages) {
      log('Error occurs when fetching all messages' + messages.message);  
    });
  }

  function getAndShowAllMusics() {
    CMD.Musics.getAllMusicsInfo(function onresponse_getAllMusicsInfo(message) {
      // Make sure the 'select-all' box is not checked.
      MusicList.selectAllMusics(false);
      var dataJSON = JSON.parse(message.data);
      MusicList.init(dataJSON);
    }, function onerror_getAllMusicsInfo(message) {
      log('Error occurs when fetching all musics.');
    });
  }

  function getAndShowGallery () {
    CMD.Pictures.getAllPicsInfo(function onresponse_getAllPicturesInfo(message) {
      var dataJSON = JSON.parse(message.data);
      Gallery.init(dataJSON);
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
        // FIXME, still not finish binding data listening event in server socket, displaying info. delay 
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
    ViewManager.addViewEventListener('contact-view', 'firstshow', getAndShowAllContacts);
    ViewManager.addViewEventListener('contact-view', 'othershow', getAndShowAllContacts);
    ViewManager.addViewEventListener('sms-view', 'firstshow', getAndShowAllSMSThreads);
    ViewManager.addViewEventListener('sms-view', 'othershow', updateSMSThreads);
    ViewManager.addViewEventListener('music-view', 'firstshow', getAndShowAllMusics);
    ViewManager.addViewEventListener('gallery-view', 'firstshow', getAndShowGallery);
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
      if (connListenPool) {
        connListenPool.send(obj);
      }
    },

    getAndShowAllContacts: getAndShowAllContacts,
    getAndShowAllSMSThreads: getAndShowAllSMSThreads,
    getAndShowAllMusics : getAndShowAllMusics,
    getAndShowGallery: getAndShowGallery,
    updateSMSThreads: updateSMSThreads
  };
})();

