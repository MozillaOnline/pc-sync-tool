'use strict'

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/osfile.jsm");

function TCPConnectionPool(options) {
  this.initialize(options);
}

TCPConnectionPool.prototype = {
  log: function tc_log(msg) {
    var DEBUG = 0;
    if (DEBUG) {
      console.log('-*- TCPConnectionPool -*-' + msg);
    }
  },

  SOCKET_STATE: {
    IDLE: 'IDLE',
    // BUSY means an request has been sent, waiting for response
    BUSY: 'BUSY'
  },

  initialize: function tc_initialize(options) {
    this.options = extend({
      size: 1,
      host: 'localhost',
      port: 25679,
      onconnected: emptyFunction,
      ondisconnected: emptyFunction,
      onerror: emptyFunction
    }, options);
    this.TCPSocket = this.createTCPSocket();

    this._connPool = [];
    this._currentId = 0;
    this._callbacks = {};
    this._messageQueue = [];
    this._messageSendingTimer = null;
    this._connectedTimer = null;
    this._initPool();
  },

  finalize: function tc_finalize() {
    this._connPool.forEach(function(wrapper) {
      wrapper.socket.close();
    });
    if (this._messageSendingTimer) {
      window.clearInterval(this._messageSendingTimer);
    }
    if (this._connectedTimer) {
      window.clearInterval(this._connectedTimer);
    }
  },

  createTCPSocket: function tc_createTCPSocket() {
    var scope = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal());
    scope.DOMError = Cu.import('resource://gre/modules/Services.jsm').DOMError;
    var ioService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    var scriptableStream = Cc['@mozilla.org/scriptableinputstream;1'].getService(Ci.nsIScriptableInputStream);
    var channel = ioService.newChannel("resource://gre/components/TCPSocket.js", null, null);
    var input = channel.open();
    scriptableStream.init(input);
    var script = scriptableStream.read(input.available());
    scriptableStream.close();
    input.close();
    Cu.evalInSandbox(script, scope, "1.8");
    scope.TCPSocket.prototype.initWindowless = function () true;
    return new scope.TCPSocket();
  },

  _initPool: function tc_initPool() {
    for (var i = 0; i < this.options.size; i++) {
      var socket = this.TCPSocket.open(this.options.host, this.options.port, {
        binaryType: 'arraybuffer'
      });

      socket.onopen = this._onSocketOpened.bind(this);
      socket.onerror = this._onSocketError.bind(this);
      socket.onclose = this._onSocketClosed.bind(this);
    }
  },

  _setSocketWrapperIdle: function tc_setSocketWrapperIdle(wrapper) {
    wrapper.__state__ = this.SOCKET_STATE.IDLE;
  },

  _setSocketWrapperBusy: function tc_setSocketWrapperBusy(wrapper) {
    wrapper.__state__ = this.SOCKET_STATE.BUSY;
  },

  _wrapperIsIdle: function tc_wrapperIsIdle(wrapper) {
    return wrapper.__state__ === this.SOCKET_STATE.IDLE;
  },

  _getWrapper: function tc_getWrapper() {
    if (this._connPool && this._connPool.length > 0) {
      return this._connPool[0];
    }
    return null;
  },

  _onSocketError: function tc_onSocketError(event) {
    if (this._connectedTimer) {
      window.clearInterval(this._connectedTimer);
    }
    if (this.options.onerror) {
      this.options.onerror(event);
    }
  },

  _onSocketOpened: function tc_onSocketOpened(event) {
    // Init wrapper
    var socketWrapper = new TCPSocketWrapper({
      socket: event.target,
      onconnected: this._onSocketConnected.bind(this),
      onmessage: this._onWrapperMessage.bind(this),
      onerror: this._onSocketError.bind(this),
      onclose: this._onSocketClosed.bind(this)
    });

    this._setSocketWrapperIdle(socketWrapper);
    this._connPool.push(socketWrapper);
    this._sendQueuedMsg();
    if (!this._messageSendingTimer) {
      this._messageSendingTimer = window.setInterval(
      this._sendQueuedMsg.bind(this), 500);
    }
    this._connectedTimer = window.setInterval(
      this._onSocketError.bind(this), 10000);
  },

  _onSocketConnected: function tc_onSocketConnected() {
    if (this._connectedTimer) {
      window.clearInterval(this._connectedTimer);
    }
    if (this.options.onconnected) {
      this.options.onconnected();
    }
  },

  _onSocketClosed: function tc_onSocketClosed(event) {
    // Remove the socket from pool
    if (this._connectedTimer) {
      window.clearInterval(this._connectedTimer);
    }
    var socket = event.target;
    var newPool = [];
    this._connPool.forEach(function(wrapper) {
      if (wrapper.socket !== socket) {
        newPool.push(wrapper);
      }
    });

    this._connPool = newPool;

    // If all the socket are closed, then call the ondisconnected to notify
    if (this._connPool.length === 0) {
      if (this.options.ondisconnected) {
        this.options.ondisconnected();
      }
    }
  },

  /**
   * The callback function to be called in the wrapper
   * @see TCPSocketWrapper
   */
  _onWrapperMessage: function tc_onWrapperMessage(jsonCmd, recvData) {
    try {
      var wrapper = this._getWrapper();
      if (!wrapper) {
        return;
      }
      var callback = this._fetchRequestCallback(jsonCmd.id);
      if (!callback) {
        if (jsonCmd.result != RS_MIDDLE) {
          this._setSocketWrapperIdle(wrapper);
        }
        return;
      }
      var result = jsonCmd.result;
      if (result != RS_MIDDLE) {
        this._deleteRequestCallback(jsonCmd.id);
      } else {
        result = RS_OK;
      }
      if (result == RS_OK) {
        callback.onresponse({
          result: result,
          data: recvData
        });
      } else {
        callback.onerror({
          result: result,
          data: recvData
        });
      }
      if (jsonCmd.result != RS_MIDDLE) {
        // Reset socket state
        this._setSocketWrapperIdle(wrapper);
      }
    } catch (e) {
      if (jsonCmd.result != RS_MIDDLE) {
        this._setSocketWrapperIdle(wrapper);
      }
      callback.onerror(e);
    }
    // Reset socket state
    // this._setSocketWrapperIdle(wrapper);
  },

  _getAvailableSocketWrapper: function tc_getAvailableSocketWrapper() {
    for (var i = 0; i < this._connPool.length; i++) {
      var wrapper = this._connPool[i];
      if (this._wrapperIsIdle(wrapper)) {
        return wrapper;
      }
    }
    return null;
  },

  _cacheCallback: function(id, onresponse, onerror) {
    this._callbacks[id] = {
      onresponse: onresponse ? onresponse : emptyFunction,
      onerror: onerror ? onerror : emptyFunction
    };
  },

  _fetchRequestCallback: function tc_getRequestCallback(id) {
    if (this._callbacks[id]) {
      return this._callbacks[id];
    }
    return null;
  },

  _deleteRequestCallback: function tc_deleteRequestCallback(id) {
    if (this._callbacks[id]) {
      delete this._callbacks[id];
    }
  },

  _getNextId: function tc_getNextId() {
    return ++this._currentId;
  },

  _sendQueuedMsg: function tc_sendQueuedMsg() {
    var idleWrapper = this._getAvailableSocketWrapper();
    if (!idleWrapper) {
      return;
    }
    if (this._messageQueue.length > 0) {
      var message = this._messageQueue.shift();
      this._doSend(idleWrapper, message);
    }
  },

  _doSend: function tc_doSend(wrapper, obj) {
    this._setSocketWrapperBusy(wrapper);
    wrapper.send(obj.cmd.title, obj.cmd.dataString, obj.cmd.dataArray);
  },

  /**
   * obj = {
   *   cmd: { id: 1, command: 1, type: 1},
   *   data: null,
   *   onresponse: onresponse,
   *   onerror: onerror,
   *   json: true
   * };
   */
  send: function tc_send(obj) {
    var wrapper = this._getAvailableSocketWrapper();
    obj.cmd.title.id = this._getNextId();
    this._cacheCallback(obj.cmd.title.id, obj.onresponse, obj.onerror);
    if (!wrapper) {
      // queue the message
      this._messageQueue.push(obj);
    } else {
      this._doSend(wrapper, obj);
    }
  }
};