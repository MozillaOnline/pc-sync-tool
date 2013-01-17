/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  // commands
  var CMD_REGISTER = "register";
  var CMD_GET_ALL_CONTACTS = "getAllContacts";
  var CMD_UPDATE_CONTACTS = 'updateContacts';
  var CMD_ADD_CONTACTS = 'addContacts';
  var CMD_REMOVE_CONTACTS = 'removeContacts';

  var socket = null;
  var wsurl = "ws://" + location.host + "/dws";
  var deviceId = "123abc";
  var currentId = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function log(msg) {
    console.log(msg);
  }

  function getNextId() {
    return ++currentId;
  }

  /**
   * Handle all message coming from server.
   */
  function handleMessage(data) {
    var message = null;

    try {
      message = JSON.parse(data);
    } catch (e) {
      log("Parse error, received msg from mgmt: " + data);
      return;
    }

    if (message.action === "request") {
      log("got request: " + JSON.stringify(message));
    }

    // Request failed
    if (message.action === 'response' && message.status !== 200) {
      log("Error message: " + data);
      return;
    } else if (message.action == "response") {
      switch (message.command) {
        case CMD_REGISTER:
          log("Device register OK!");
          $('device_id').textContent = message.data;
          break;
      }
    } else if (message.action == "request") {
      // Handle requests here
      switch (message.command) {
        case CMD_GET_ALL_CONTACTS:
          sendAllContacts(message);
          break;
        case CMD_UPDATE_CONTACTS:
          sendMultiResponses(message);
          break;
        case CMD_ADD_CONTACTS:
          addContacts(message);
          break;
        case CMD_REMOVE_CONTACTS:
          sendMultiResponses(message);
          break;
      }
    }
  }

  function sendMultiResponses(message) {
    var response = {
      action: 'response',
      status: 200,
      id: message.id,
      command: message.command,
      data: []
    };

    message.data.forEach(function(d) {
      response.data.push({
        status: 200,
        data: d
      });
    });

    socket.send(JSON.stringify(response));
  }

  function addContacts(message) {
    message.data.forEach(function(contact) {
      // Give a random id
      var randomId = Math.round(Math.random() * 10000); contact.id = randomId;
    });

    socket.send(JSON.stringify({
      action: 'response',
      status: 200,
      command: message.command,
      id: message.id,
      data: message.data
    }));
  }

  function sendAllContacts(message) {
    // Fake contacts data
    socket.send(JSON.stringify({
      action: 'response',
      status: 200,
      command: message.command,
      id: message.id,
      data: [{
        id: 'abcdssss',
        name: ['Pin', 'Zhang'],
        honorificPrefix: [],
        givenName: ['Pin'],
        familyName: ['Zhang'],
        additionalName: [],
        honorificSuffix: [],
        nickname: ['pzhang'],
        email: [{
          type: 'personal',
          value: 'info-cn@mozilla.com'
        }],
        photo: [],
        url: [{
          type: 'homepage',
          value: 'http://mozilla.com.cn/'
        }],
        category: ['Super Star'],
        adr: [{
          type: 'home',
          value: 'Beijing'
        }],
        tel: [{
          type: 'mobile',
          value: '10086'
        }],
        org: ['Mozilla Ltd.'],
        jobTitle: [],
        bday: null,
        note: [],
        impp: [],
        anniversary: null,
        sex: 'male',
        genderIdentity: null
      }, {
        id: 'dwaeffff',
        name: ['Dongsheng', 'Xue'],
        honorificPrefix: [],
        givenName: ['Dongsheng'],
        familyName: ['Xue'],
        additionalName: [],
        honorificSuffix: [],
        nickname: ['dxue'],
        email: [{
          type: 'personal',
          value: 'info-cn@mozilla.com'
        }],
        photo: [],
        url: [{
          type: 'homepage',
          value: 'http://mozilla.com.cn/'
        }],
        category: ['Super Star'],
        adr: [{
          type: 'home',
          value: 'Beijing'
        }],
        tel: [{
          type: 'mobile',
          value: '13800138000'
        }],
        org: ['Mozilla Ltd.'],
        jobTitle: [],
        bday: null,
        note: [],
        impp: [],
        anniversary: null,
        sex: 'male',
        genderIdentity: null
      }]
    }));
  }

  function connectToServer() {
    socket = new WebSocket(wsurl);

    socket.onopen = function onopen_ws() {
      var requestId = getNextId();
      // Register client ID
      socket.send(JSON.stringify({
        action: 'request',
        id: requestId,
        target: 'init',
        command: CMD_REGISTER,
        data: deviceId
      }));
    };

    socket.onmessage = function onmessage_ws(event) {
      handleMessage(event.data);
    };

    socket.onerror = function onerror_ws(event) {
      log("Error occurs: " + event);
    };
  }

  function reconnectToServer() {
    if (socket) {
      socket.close();
      socket = null;
    }
    connectToServer();
  }

  function sendMsgToMgmt() {
    var msg = $("msg").value.trim();
    if (!msg) {
      alert("Please input your message!");
      return;
    }

    socket.send(msg);
  }

  function init() {
    connectToServer();
    $("btn_reconnect").addEventListener('click', function rec_onclick(event) {
      reconnectToServer();
    });
    $("btn_sendmsg").addEventListener('click', function btn_sendmsg_onclick(event) {
      sendMsgToMgmt();
    });
  }

  window.addEventListener('load', function window_onload(event) {
    window.removeEventListener('load', window_onload);
    init();
    $('msg').value = '{"action":"request","id":1,"command":"testCMD","target":"init","data":"awefwef"}';
  });
})();

