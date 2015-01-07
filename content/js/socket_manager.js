/* There are two sockets, mainSocket and dataSocket.
 * mainSocket:
 *   Represent connection state, connected or disconnected, notify UI and
 *   receive data from mobile device when user data has been changed(editing
 *   contacts, new sms etc.).
 * dataSocket:
 *   Send and receive data according to data transfer protocol.
 */

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/osfile.jsm");

const REMOTE_PORT = 25679; 
var mainSocket = null;
var dataSocket = null;

var socketsManager = (function() {
  var host = '';
  var port = -1;
  var callbacks = null;
  var handlers = {};
  var connectingTimer = undefined;
  var currentId = 0;

  // 0 : socket is idle
  // 1 : socket is in use
  var dataSocketState = 0;

  var sendMsgQueue = [];
  var sendTimer = undefined;
  var dataSocketWrapper = null;
  var tcpSocket = null;

  var initialize = function sm_initialize(options) {
    sendMsgQueue = [];
    host = options.host || 'localhost';
    port = options.port || REMOTE_PORT;
    callbacks = options.callbacks;
    tcpSocket = createTCPSocket();
  };

  var createTCPSocket = function sm_createTCPSocket() {
    var scope = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal());
    scope.DOMError = Cu.import('resource://gre/modules/Services.jsm').DOMError;
    var ioService =
      Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    var scriptableStream =
      Cc['@mozilla.org/scriptableinputstream;1'].
      getService(Ci.nsIScriptableInputStream);
    var channel = ioService.newChannel("resource://gre/components/TCPSocket.js",
                                        null, null);
    var input = channel.open();
    scriptableStream.init(input);
    var script = scriptableStream.read(input.available());
    scriptableStream.close();
    input.close();
    Cu.evalInSandbox(script, scope, "1.8");
    scope.TCPSocket.prototype.initWindowless = function () true;
    return new scope.TCPSocket();
  };

  var createMainSocket = function sm_createMainSocket() {
    mainSocket = tcpSocket.open(host, port, {
      binaryType: 'arraybuffer'
    });

    mainSocket.onopen = function(event) {
      var socketWrapper = new TCPSocketWrapper({
        socket: event.target,
        onconnected: onMainSocketConnected,
        onmessage: handleChangedData,
        onerror: onSocketError,
        onclose: onSocketClosed,
        onrejected: onRejected,
        onaccepted: onAccepted
      });

      connectingTimer =  window.setInterval(onSocketError, 10000);
    };
  };

  var createDataSocket = function sm_createDataSocket() {
    dataSocket = tcpSocket.open(host, port, {
      binaryType: 'arraybuffer'
    });

    dataSocket.onopen = function(event) {
      dataSocketWrapper = new TCPSocketWrapper({
        socket: event.target,
        onconnected: onDataSocketConnected,
        onmessage: onWrapperMessage,
        onerror: function() {
          console.log('error occured in data socket');
          dataSocket.close();
        },
        onclose: function() {
          dataSocket = null;
          window.clearInterval(sendTimer);
          sendTimer = undefined;
        }
      });
      if (!sendTimer) {
        sendTimer = window.setInterval(sendQueuedMsg, 500);
      }
    };
  };

  var onMainSocketConnected = function sm_onMainSocketConnected() {
    window.clearInterval(connectingTimer);
    connectingTimer = undefined;
  };

  // TODO: Customize rejected page.
  var onRejected = function sm_rejected() {
    onSocketError();
  };

  var onAccepted = function sm_accepted() {
    if (callbacks.mainSocketOnConnected) {
      callbacks.mainSocketOnConnected();
    }
  };

  var onDataSocketConnected = function sm_onDataSocketConnected() {
    if (callbacks.dataSocketOnConnected) {
      callbacks.dataSocketOnConnected();
    }
  };

  // When user data changed in mobile device, update it.
  var handleChangedData = function(jsonCmd, recvData) {
    var message = JSON.parse(array2String(recvData));
    if (message == null) {
      return;
    }
    var evt = new CustomEvent('dataChange', {
      'detail': {
        'type': message.type,
        'data': message
      }
    });
    document.dispatchEvent(evt);
  };

  // Main socket closed
  var onSocketClosed = function sm_onSocketClosed(event) {
    window.clearInterval(connectingTimer);
    connectingTimer = undefined;

    if (dataSocket) {
      dataSocket.close();
    }

    if (callbacks.ondisconnected) {
      callbacks.ondisconnected();
    }
  };

  // Error occured in main socket.
  var onSocketError = function sm_onSocketError(event) {
    console.log('error occured in main socket.');
    window.clearInterval(connectingTimer);
    connectingTimer = undefined;

    if (mainSocket) {
      mainSocket.close();
    }

    if (callbacks.onerror) {
      callbacks.onerror(event);
    }
  };

  // Handle received data from data socket
  var onWrapperMessage = function sm_onWrapperMessage(jsonCmd, recvData) {
    try {
      var handler = handlers[jsonCmd.id];
      if (!handler) {
        if (jsonCmd.result != RS_MIDDLE) {
          dataSocketState = 0;
        }
        return;
      }

      var result = jsonCmd.result;
      switch(result) {
        case RS_MIDDLE:
          handler.onresponse({
            result: result,
            data: recvData
          });
          break;
        case RS_OK:
          dataSocketState = 0;
          deleteHandler(jsonCmd.id);
          handler.onresponse({
            result: result,
            data: recvData
          });
          break;
        case RS_ERROR:
          dataSocketState = 0;
          deleteHandler(jsonCmd.id);
          handler.onerror({
            result: result,
            data: recvData
          });
          break;
      }
    } catch (e) {
      if (jsonCmd.result != RS_MIDDLE) {
        dataSocketState = 0;
      }
      handler.onerror(e);
    }
  };

  var deleteHandler = function sm_deleteHandler(id) {
    if (handlers[id]) {
      delete handlers[id];
    }
  };

  var send = function sm_send(obj) {
    obj.cmd.title.id = currentId++;
    handlers[obj.cmd.title.id] = {
      onresponse: obj.onresponse || function() {},
      onerror: obj.onerror || function() {}
    };

    sendMsgQueue.push(obj);
    return obj.cmd.title.id;
  };

  var doSend = function sm_doSend(obj) {
    if (!dataSocketWrapper) {
      console.log('dataSocketWrapper is empty.');
      return;
    }

    dataSocketWrapper.send(obj.cmd.title,
                           obj.cmd.dataString,
                           obj.cmd.dataArray);
  };

  var sendQueuedMsg = function sm_sendQueuedMsg() {
    if (dataSocketState) {
      return;
    }
    if (sendMsgQueue.length > 0) {
      var message = sendMsgQueue.shift();
      doSend(message);
    }
  };

  var reset = function sm_reset() {
    if (!mainSocket) {
      return;
    }

    mainSocket.close();
    mainSocket = null;
  };

  var cancel = function sm_cancel(tasks) {
    /*
    window.clearInterval(sendTimer);

    // current running task needs to be canceld.
    if (tasks.indexOf(currentTaskId) != -1) {
      dataSocket.close();
      dataSocketState = 0;
      dataSocket = null;
    }
    */

    tasks.forEach(function(task) {
      deleteHandler(task);
      sendMsgQueue.forEach(function(message, index) {
        if (message.cmd.title.id == task) {
          sendMsgQueue.splice(index, 1);
        }
      });
    });

    /*
    if (!dataSocket) {
      createDataSocket();
    } else {
      sendTimer = window.setInterval(sendQueuedMsg, 500);
    }
    */
  };

  return {
    initialize: initialize,
    createMainSocket: createMainSocket,
    createDataSocket: createDataSocket,
    createTCPSocket: createTCPSocket,
    send: send,
    reset: reset,
    cancel: cancel
  };
})(window);
