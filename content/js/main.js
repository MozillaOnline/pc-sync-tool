/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var FFOSAssistant = (function() {
  var connPool = null;

  var wsurl = "ws://" + location.host + "/ws";
  // var wsurl = "ws://localhost:8888/ws";

  function manageDevice() {
    var deviceId = $id('device_id').value.trim();
    if (!deviceId) {
      alert("Please input the device id!");
    } else {
      socket = ConnectManager.connectTo({
        webTCPSocket: false,
        url: wsurl,
        onopen: function onopen_ws() {
          log("Websocket is opened!");
          CMD.Contacts.manageDevice($id("device_id").value.trim(), function onresponse(message) {
            showContactView();
          }, function onerror(message) {
            log('There is an error when mamage device');
          } );
        },
        onerror: function onerror_ws(message) {
          log("Error occurs!");
        },
        onrequest: function onmessage_ws(message) {
          handleRequest(message);
        }
      });
    }
  }

  function showConnectView() {
    ViewManager.showView('connect-view');
  }

  function showSummaryView() {
    ViewManager.showView('summary-view');
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
    var usedInP = Math.floor(info.usedInBytes / total * 100) + '%';
    $expr('.storage-number', elem)[0].textContent =
      formatStorage(info.usedInBytes) + '/' + formatStorage(total) + ' ' + usedInP;
    $expr('.storage-graph .used', elem)[0].style.width = usedInP;
  }

  function getAndShowSummaryInfo() {
    CMD.Device.getDeviceInfo(function onresponse_getDeviceInfo(message) {
      var deviceInfo = {};
      var sdcardInfo = {
        usedInBytes: 0,
        freeInBytes: 0
      };

      message.data.forEach(function(item) {
        var usedInBytes = item.data[0];
        var freeInBytes = item.data[1];
        if (item.type === 'apps') {
          deviceInfo.usedInBytes = usedInBytes;
          deviceInfo.freeInBytes = freeInBytes;
        } else {
          sdcardInfo.usedInBytes += usedInBytes;
          sdcardInfo.freeInBytes = freeInBytes;
        }
      });

      fillStorageSummaryInfo('device-storage-summary', deviceInfo);
      fillStorageSummaryInfo('sdcard-storage-summary', sdcardInfo);
    }, function onerror_getDeviceInfo(message) {
      alert('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });
  }

  /**
   * Show the contact view, and start fetching the contacts data from device.
   */
  function showContactView() {
    // Switch view to manage view
    ViewManager.showView('contact-view');
  }

  function getAndShowAllContacts() {
    CMD.Contacts.getAllContacts(function onresponse_getAllContacts(message) {
      // Make sure the 'select-all' box is not checked.  
      ContactList.selectAllContacts(false); 
      var dataJSON = JSON.parse(message.data);
      ContactList.init(dataJSON);
      if (dataJSON.length > 0) {
        ContactList.showContactInfo(dataJSON[0]);
      }
    }, function onerror_getAllContacts(message) {
      log('Error occurs when fetching all contacts.');
    });
  }

  function connectToUSB(event) {
    var timeout = null;

    if (connPool) {
      connPool.finalize();
      connPool = null;
    }

    connPool = new TCPConnectionPool({
      size: 2,
      onenable: function onenable() {
        // FIXME 此时server端还未完成data监听事件注册，延迟显示
        timeout = window.setTimeout(showSummaryView, 1000);
      },
      ondisable: function ondisable() {
        log('USB Socket is closed');
        window.clearTimeout(timeout);
        showConnectView();
        socket = null;
      }
    });
  }

  function init() {
    $id("btn_submit").addEventListener('click', function btn_onclick(event) {
      manageDevice();
    });

    $id('btn_usb_connect').addEventListener('click', connectToUSB);

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

    if (navigator.mozFFOSAssistant) {
      navigator.mozFFOSAssistant.onadbstatechange = function onADBStateChange(event) {
        if (navigator.mozFFOSAssistant.adbConnected === true) {
          connectToUSB();
        }
      };

      if (navigator.mozFFOSAssistant.adbConnected === true) {
        connectToUSB();
      }
    }

    // Register view event callbacks
    ViewManager.addViewEventListener('summary-view', 'firstshow', getAndShowSummaryInfo);
    ViewManager.addViewEventListener('contact-view', 'firstshow', getAndShowAllContacts);

    window.setTimeout(function() {
//      manageDevice();
//      ViewManager.showView('contact-view');
    }, 100);
  }

  window.addEventListener('load', function window_onload(event) {
    window.removeEventListener('load', window_onload);
    init();
  });

  window.addEventListener('localized', function showBody() {
    document.documentElement.lang = navigator.mozL10n.language.code;
    document.documentElement.dir = navigator.mozL10n.language.direction;
    document.body.hidden = false;
  });

  return {
    sendRequest: function(obj) {
      connPool.send(obj);
    },

    getAndShowAllContacts: getAndShowAllContacts
  };
})();

