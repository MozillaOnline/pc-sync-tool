/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function TCPConnectionPool(options) {
  this.initialize(options);
}

TCPConnectionPool.prototype = {
  log: function tc_log(msg) {
    var DEBUG = 1;
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
  _onWrapperMessage: function tc_onWrapperMessage(socket, jsonCmd, sendCallback, recvList) {
    try {
      this.log('Receive msg: ' + JSON.stringify(jsonCmd));
      var wrapper = this._getWrapperBySocket(socket);
      if (!wrapper) {
        return;
      }
      var callback = this._fetchRequestCallback(jsonCmd.id);
      // TODO parse the result of the jsonCmd, if failed, to call onerror
      var dataList = wrapper.recvList;
      // reset the recvList of the wrapper which is really important.
      wrapper.recvList = [];
      if (callback.json) {
        // Parse the result as the object
        callback.onresponse({
          result: jsonCmd.result,
          data: JSON.parse(dataList.join(''))
        });
      } else {
        // Pass back the raw result
        callback.onresponse({
          result: jsonCmd.result,
          data: dataList.join('')
        });
      }
    } catch (e) {
      callback.onerror(e);
    }
    // Reset socket state
    this._setSocketWrapperIdle(wrapper);
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
      var tmp = this._callbacks[id];
      delete this._callbacks[id];
      return tmp;
    }
    return null;
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
    wrapper.send(obj.cmd, obj.cmd.firstData, obj.cmd.secondData);
  },

  /*
   * obj = {
   *   cmd: { id: 1, command: 1, type: 1},
   *   firstData: null,
   *   secondData: null,
   *   onresponse: onresponse,
   *   onerror: onerror,
   *   json: true
   * };
   */
  send: function tc_send(obj) {
    obj.cmd = extend({
      cmd: null,
      firstData: null,
      secondData: null,
      firstDatalength: 0,
      secondDatalength: 0,
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

function TCPListenConnectionPool(options) {
  this.initialize(options);
}

TCPListenConnectionPool.prototype = {
  initialize: function tc_initialize(options) {
    this.options = extend({
      host: 'localhost',
      port: 10010,
      onListening: emptyFunction
    }, options);
    this.wrapper = null;
    this._messageQueue = [];
    this._messageRecvingTimer = null;
    var socket = navigator.mozTCPSocket.open(this.options.host, this.options.port, {
      binaryType: 'arraybuffer'
    });
    socket.onopen = this._onSocketOpened.bind(this);
  },

  finalize: function tc_finalize() {
    this.options = null;
    this._messageQueue = null;
    if(this.wrapper) {
      this.wrapper.socket.close();
      this.wrapper = null;
    }
    if(this._messageRecvingTimer){
      window.clearInterval(this._messageRecvingTimer);
      this._messageRecvingTimer = null;
    }
  },

  _onSocketOpened: function tc_onSocketOpened(event) {
    // Init wrapper
    var socketWrapper = new TCPSocketWrapper({
      socket: event.target,
      onmessage: this._onWrapperMessage.bind(this),
      onclose: this._onSocketClosed.bind(this)
    });
    this.wrapper = socketWrapper;
    CMD.Listen.listenMessage(function() {}, function(e) {
      alert(e);
    });
    this._recvQueuedMsg();
    if (!this._messageRecvingTimer) {
      this._messageRecvingTimer = window.setInterval(
      this._recvQueuedMsg.bind(this), 500);
    }
  },

  _onSocketClosed: function tc_onSocketClosed(event) {
    this.wrapper = null;
  },

  _onWrapperMessage: function tc_onWrapperMessage(socket, jsonCmd, sendCallback, recvList) {
    console.log('-*- TCPListenConnectionPool -*-Receive msg: ' + JSON.stringify(jsonCmd));
    if (this.wrapper == null) {
      return;
    }
    // TODO parse the result of the jsonCmd, if failed, to call onerror
    var dataList = this.wrapper.recvList;
    // reset the recvList of the wrapper which is really important.
    this.wrapper.recvList = [];
    this._messageQueue.push(dataList);
  },

  _recvQueuedMsg: function tc_recvQueuedMsg() {
    if (this._messageQueue.length > 0) {
      var message = this._messageQueue.shift();
      this.options.onListening(JSON.parse(message.join('')));
    }
  },

  send: function tc_send(obj) {
    obj.cmd = extend({
      cmd: null,
      firstData: null,
      secondData: null,
      firstDatalength: 0,
      secondDatalength: 0,
      json: false // Indicates if the reulst is an JSON string
    }, obj.cmd);

    obj.cmd.id = 1;
    if (this.wrapper) {
      this.wrapper.send(obj.cmd, obj.cmd.firstData, obj.cmd.secondData);
    }
  }
};
