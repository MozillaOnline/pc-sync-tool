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

var SocketManager = (function() {
  var commandId = 100;
  const REMOTE_PORT = 25679; 
  var mainSocket = null;
  var dataSocket = null;
  var curHost = '';
  var curPort = -1;
  var connectingTimer = undefined;

  var sendMsgQueue = [];
  var sendTimer = undefined;
  var dataSocketWrapper = null;
  var tcpSocket = null;

  function _createTCPSocket() {
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
  }

  function init() {
    tcpSocket = _createTCPSocket();
    stop();
  }

  function start(host, port) {
    sendMsgQueue = [];
    curHost = host || 'localhost';
    curPort = port || REMOTE_PORT;
    _createMainSocket();
  }

  // Main socket closed
  function _onSocketClosed(event) {
    if (connectingTimer) {
      window.clearInterval(connectingTimer);
      connectingTimer = undefined;
    }
    if (sendTimer) {
      window.clearInterval(sendTimer);
      sendTimer = undefined;
    }
    SocketManager.mainSocket = null;
    SocketManager.dataSocket = null;
    SocketManager.dataSocketWrapper = null;
    var customEvent = new CustomEvent(CMD_ID.app_disconnect, {});
    document.dispatchEvent(customEvent);
  }

  // Error occured in main socket.
  function _onSocketError() {
    window.clearInterval(connectingTimer);
    connectingTimer = undefined;
    SocketManager.mainSocket = null;
    SocketManager.dataSocket = null;
    SocketManager.dataSocketWrapper = null;
    var customEvent = new CustomEvent(CMD_ID.app_error, {});
    document.dispatchEvent(customEvent);
  }

  // When user data changed in mobile device, update it.
  function _handleChangedData(cmd, recvData) {
    window.clearInterval(connectingTimer);
    connectingTimer = undefined;
    var customEvent = new CustomEvent(cmd.id, {'detail': recvData});
    document.dispatchEvent(customEvent);
    return;
  }

  function _createMainSocket() {
    SocketManager.mainSocket = tcpSocket.open(curHost, curPort, {
      binaryType: 'arraybuffer'
    });

    SocketManager.mainSocket.onopen = function(event) {
      var socketWrapper = new TCPSocketWrapper({
        socket: event.target,
        onmessage: _handleChangedData,
        onerror: _onSocketError,
        onclose: _onSocketClosed
      });
    };
    connectingTimer =  window.setInterval(_onSocketError, 10000);
  }

  function _createDataSocket() {
    SocketManager.dataSocket = tcpSocket.open(curHost, curPort, {
      binaryType: 'arraybuffer'
    });

    SocketManager.dataSocket.onopen = function(event) {
      SocketManager.dataSocketWrapper = new TCPSocketWrapper({
        socket: event.target,
        onmessage: onWrapperMessage,
        onerror: _onSocketError,
        onclose: _onSocketClosed
      });
      if (!sendTimer) {
        sendTimer = window.setInterval(sendQueuedMsg, 500);
      }
    };
  }

  // Handle received data from data socket
  function onWrapperMessage(cmd, recvData) {
    var customEvent = new CustomEvent(cmd.id, {'detail': recvData});
    document.dispatchEvent(customEvent);
  }

  function send(obj) {
    if (!SocketManager.dataSocketWrapper) {
      _createDataSocket();
    }
    sendMsgQueue.push(obj);
  }

  function sendQueuedMsg() {
    if (sendMsgQueue.length > 0 && SocketManager.dataSocketWrapper) {
      var message = sendMsgQueue.shift();
      SocketManager.dataSocketWrapper.send(message.cmd,
                             message.dataArray);
    }
  }

  function stop() {
    if (SocketManager.dataSocketWrapper) {
      SocketManager.dataSocketWrapper = null;
    }
    if (SocketManager.dataSocket) {
      SocketManager.dataSocket.close();
      SocketManager.dataSocket = null;
    }
    if (SocketManager.mainSocket) {
      SocketManager.mainSocket.close();
      SocketManager.mainSocket = null;
    }
  };

  return {
    init: init,
    start: start,
    send: send,
    stop: stop,
    commandId: commandId,
    mainSocket: mainSocket,
    dataSocket: dataSocket,
    dataSocketWrapper: dataSocketWrapper
  };
})(window);
