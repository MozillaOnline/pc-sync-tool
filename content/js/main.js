/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var FFOSAssistant = (function() {
  var CMD_MANAGE_DEVICE = "manageDevice";
  var CMD_GET_ALL_CONTACTS = "getAllContacts";

  var wsurl = "ws://" + location.host + "/ws";
  // var wsurl = "ws://localhost:8888/ws";

  function manageDevice() {
    var deviceId = $id('device_id').value.trim();
    if (!deviceId) {
      alert("Please input the device id!");
    } else {
      socket = ConnectManager.connectTo({
        usb: false,
        url: wsurl,
        onopen: function onopen_ws() {
          log("Websocket is opened!");
          submitDeviceId();
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

  /**
   * Handle all message coming from server.
   */
  function handleRequest(message) {
    // Handle request message
    log("Got request: " + JSON.stringify(message));
  }

  function submitDeviceId() {
    // Send client ID to the server
    socket.sendRequest({
      target: "init",
      command: CMD_MANAGE_DEVICE,
      data: $id("device_id").value.trim()
    }, function onresponse(message) {
      showContactView();
    }, function onerror(message) {
      log('There is an error when mamage device');
    });
  }

  function showConnectView() {
    ViewManager.showView('connect-view');
  }

  /**
   * Show the contact view, and start fetching the contacts data from device.
   */
  function showContactView() {
    // Switch view to manage view
    ViewManager.showView('contact-view');
    getAndShowAllContacts();
  }

  function getAndShowAllContacts() {
    // Get contact lists
    socket.sendRequest({
      target: 'contact',
      command: CMD_GET_ALL_CONTACTS,
      data: null
    }, function onresponse_getAllContacts(message) {
      // Make sure the 'select-all' box is not checked.
      ContactList.selectAllContacts(false);

      ContactList.init(message.data);
      if (message.data.length > 0) {
        ContactList.showContactInfo(message.data[0]);
      }
    }, function onerror_getAllContacts(message) {
      log('Error occurs when fetching all contacts.');
    });
  }

  function connectToUSB(event) {
    var timeout = null;
    socket = ConnectManager.connectTo({
      usb: true,
      url: wsurl,
      onopen: function onopen() {
        log("USB Socket is opened!");
        // FIXME 此时server端还未完成data监听事件注册，延迟显示
        timeout = window.setTimeout(showContactView, 1000);
      },
      onclose: function onclose() {
        log('USB Socket is closed');
        window.clearTimeout(timeout);
        showConnectView();
        socket = null;
      },
      onerror: function onerror(message) {
        log("Error occurs!");
      },
      onrequest: function onmessage(message) {
        handleRequest(message);
      }
    });
  }

  function init() {
    $id("btn_submit").addEventListener('click', function btn_onclick(event) {
      manageDevice();
    });

    $id('btn_usb_connect').addEventListener('click', connectToUSB);

    $id('add-new-contact').addEventListener('click', function onclick_addNewContact(event) {
      ContactForm.editContact();
    });

    if (navigator.mozADBService) {
      navigator.mozADBService.onadbstatechange = function onADBStateChange(event) {
        if (navigator.mozADBService.adbConnected === true) {
          connectToUSB();
        }
      };

      if (navigator.mozADBService.adbConnected === true) {
        connectToUSB();
      }
    }

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
    sendRequest: function(request, onresponse, onerror) {
      if (socket) {
        socket.sendRequest(request, onresponse, onerror);
      }
    },

    getAndShowAllContacts: getAndShowAllContacts
  };
})();

