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
      port: 10010,
      onenable: emptyFunction,
      ondisable: emptyFunction,
      onListening: emptyFunction
    }, options);

    this._connPool = [];
    this._currentId = 0;
    this._callbacks = {};
    this._messageQueue = [];
    this._messageSendingTimer = null;
    this._initPool();
  },

  finalize: function tc_finalize() {
    this.options = null;
    this._connPool.forEach(function(wrapper) {
      wrapper.socket.close();
    });
    this._connPool = null;
    this._currentId = null;
    this._callbacks = null;
    this._messageQueue = null;
    if(this._messageSendingTimer){
      window.clearInterval(this._messageSendingTimer);
      this._messageSendingTimer = null;
    }
  },

  _initPool: function tc_initPool() {
    for (var i = 0; i < this.options.size; i++) {
      var socket = navigator.mozTCPSocket.open(this.options.host, this.options.port, {
        binaryType: 'arraybuffer'
      });

      socket.onopen = this._onSocketOpened.bind(this);
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

  _getWrapperBySocket: function tc_getWrapperBySocket(socket) {
    for (var i = 0; i < this._connPool.length; i++) {
      var wrapper = this._connPool[i];
      if (wrapper.socket == socket) {
        return wrapper;
      }
    }
    return null;
  },

  _onSocketOpened: function tc_onSocketOpened(event) {
    // Init wrapper
    var socketWrapper = new TCPSocketWrapper({
      socket: event.target,
      onmessage: this._onWrapperMessage.bind(this),
      onclose: this._onSocketClosed.bind(this)
    });
    // If a new socket is available, then call onenable to notify
    if (this._connPool.length === 0) {
      this.options.onenable();
    }

    this._setSocketWrapperIdle(socketWrapper);
    this._connPool.push(socketWrapper);
    this._sendQueuedMsg();
    if (!this._messageSendingTimer) {
      this._messageSendingTimer = window.setInterval(
      this._sendQueuedMsg.bind(this), 500);
    }
  },

  _onSocketClosed: function tc_onSocketClosed(event) {
    // Remove the socket from pool
    var socket = event.target;
    var newPool = [];
    this._connPool.forEach(function(wrapper) {
      if (wrapper.socket !== socket) {
        newPool.push(wrapper);
      }
    });

    this._connPool = newPool;

    // If all the socket are closed, then call the ondisable to notify
    if (this._connPool.length === 0) {
      this.options.ondisable();
    }
  },

  /*
   * The callback function to be called in the wrapper
   * @see TCPSocketWrapper
   */
  _onWrapperMessage: function tc_onWrapperMessage(socket, jsonCmd, sendCallback, recvData) {
    try {
      var wrapper = this._getWrapperBySocket(socket);
      if (!wrapper) {
        return;
      }
      var callback = this._fetchRequestCallback(jsonCmd.id);
      if(jsonCmd.result != RS_MIDDLE) {
        this._deleteRequestCallback(jsonCmd.id);
        if (callback.json) {
          // Parse the result as the object
          callback.onresponse({
            result: jsonCmd.result,
            data: JSON.parse(recvData)
          });
        } else {
          // Pass back the raw result
          callback.onresponse({
            result: jsonCmd.result,
            data: recvData
          });
        }
        // Reset socket state
        this._setSocketWrapperIdle(wrapper);
      } else {
        jsonCmd.result = RS_OK;
        if (callback.json) {
          // Parse the result as the object
          callback.onresponse({
            result: jsonCmd.result,
            data: JSON.parse(recvData)
          });
        } else {
          // Pass back the raw result
          callback.onresponse({
            result: jsonCmd.result,
            data: recvData
          });
        }
      }
    } catch (e) {
      callback.onerror(e);
    }
    // Reset socket state
    //this._setSocketWrapperIdle(wrapper);
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

  _cacheCallback: function(id, json, onresponse, onerror) {
    this._callbacks[id] = {
      onresponse: onresponse ? onresponse : emptyFunction,
      onerror: onerror ? onerror : emptyFunction,
      json: json
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
    wrapper.send(obj.cmd, obj.cmd.data);
  },

  /*
   * obj = {
   *   cmd: { id: 1, command: 1, type: 1},
   *   data: null,
   *   onresponse: onresponse,
   *   onerror: onerror,
   *   json: true
   * };
   */
  send: function tc_send(obj) {
    obj.cmd = extend({
      cmd: null,
      data: null,
      datalength: 0,
      json: false // Indicates if the reulst is an JSON string
    }, obj.cmd);

    var wrapper = this._getAvailableSocketWrapper();
    obj.cmd.id = this._getNextId();
    this._cacheCallback(obj.cmd.id, obj.cmd.json, obj.onresponse, obj.onerror);
    if (!wrapper) {
      // queue the message
      this._messageQueue.push(obj);
    } else {
      this._doSend(wrapper, obj);
    }
  }
};
