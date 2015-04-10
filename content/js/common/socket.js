function TCPSocketWrapper(options) {
  this.initialize(options);
}

TCPSocketWrapper.prototype = {
  initialize: function(options) {
    if (typeof options.socket !== 'object') {
      console.log('Socket object is required.');
      return;
    }
    this.options = options;
    this.socket = options.socket;
    this.jsonCmd = null;
    this.lastRecvLength = 0;
    this.socket.ondata = this.onData.bind(this);
    this.socket.ondrain = this.onDrain.bind(this);
    this.socket.onerror = this.onError.bind(this);
    this.socket.onclose = this.onClose.bind(this);
    this._messageQueue = [];
    this._messageRecvingTimer = null;
    this.remaindData = [];
    console.log('TCPSocketWrapper.js initialize !!!!!!!!!!!!!!');
    this._recvQueuedMsg();
    if (!this._messageRecvingTimer) {
      this._messageRecvingTimer = window.setInterval(
      this._recvQueuedMsg.bind(this), 50);
    }
  },

  handleMessage: function() {
    var onmessage = typeof this.options.onmessage == 'function' ? this.options.onmessage : function emptyFunction() {};
    onmessage.apply(this, arguments);
  },

  _recvQueuedMsg: function tc_recvQueuedMsg() {
    if (this._messageQueue.length == 0) {
      return;
    }
    var receivedData = this._messageQueue.shift();
    var recvLength = receivedData.byteLength !== undefined ? receivedData.byteLength : receivedData.length;
    var remaindDataLength = this.remaindData.byteLength !== undefined ? this.remaindData.byteLength : this.remaindData.length;
    if (receivedData.byteLength !== undefined) {
      var dataBufferView = new Uint8Array(recvLength + remaindDataLength);
      var recvBufferView = new Uint8Array(receivedData);
      dataBufferView.set(this.remaindData, 0);
      dataBufferView.set(recvBufferView, remaindDataLength);
      receivedData = dataBufferView;
    } else {
      receivedData = this.remaindData + event.data;
    }
    recvLength = receivedData.length;
    var datalen = recvLength;
    while (datalen > 0) {
      if (datalen < TITLE_SIZE) {
        this.remaindData = receivedData.subarray(0, recvLength);
        break;
      }
      this.jsonCmd = titleArray2Json(receivedData);
      datalen -= TITLE_SIZE;
      if (!this.jsonCmd) {
        continue;
      }
      if (this.jsonCmd.datalength > 0) {
        this.lastRecvLength = this.jsonCmd.datalength - datalen;
        if (this.lastRecvLength > 0) {
          this.remaindData = receivedData.subarray(0, recvLength);
          break;
        } else if (this.lastRecvLength < 0) {
          this.handleMessage(this.jsonCmd, receivedData.subarray(TITLE_SIZE, TITLE_SIZE + this.jsonCmd.datalength));
          datalen -= this.jsonCmd.datalength;
          receivedData = receivedData.subarray(TITLE_SIZE + this.jsonCmd.datalength, recvLength);
          recvLength = receivedData.length;
        } else {
          this.handleMessage(this.jsonCmd, receivedData.subarray(TITLE_SIZE, recvLength));
          this.remaindData = [];
          break;
        }
      } else {
        this.handleMessage(this.jsonCmd, null);
        receivedData = receivedData.subarray(TITLE_SIZE, recvLength);
        recvLength = receivedData.length;
      }
    }
  },

  onData: function(event) {
    //event.data = [];
    try {
      var receivedData = event.data;
      this._messageQueue.push(receivedData);
    } catch (e) {
      console.log('TCPSocketWrapper.js onData failed: ' + e);
    }
  },

  onDrain: function(event) {
    console.log('TCPSocketWrapper.js onDrain');
    if (this.options.ondrain) {
      this.options.ondrain(event);
    }
  },

  onError: function(event) {
    console.log('TCPSocketWrapper.js onError');
    if (this.options.onerror) {
      this.options.onerror(event);
    }
  },

  onClose: function(event) {
    if (this.options.onclose) {
      this.options.onclose(event);
    }
    this.socket = null;
    this._messageQueue = [];
    this._messageRecvingTimer = null;
    this.remaindData = [];
  },

  send: function(jsonCmd, arrayData) {
    if (!this.socket)
      return;
    sendCmdAndData(this.socket, jsonCmd, arrayData);
  }
};

function sendCmdAndData(socket, jsonCmd, arrayData) {
  try {
    if (!socket || !jsonCmd) {
      return;
    }
    var sendData = null;
    if (!arrayData) {
      jsonCmd.datalength = 0;
      sendData = json2TitleArray(jsonCmd);
    } else {
      jsonCmd.datalength = arrayData.byteLength !== undefined ? arrayData.byteLength : arrayData.length;
      sendData = arraycat(json2TitleArray(jsonCmd), arrayData);
    }
    if ( !! sendData) {
      var sendLength = sendData.byteLength !== undefined ? sendData.byteLength : sendData.length;
      var sendBuffer = new ArrayBuffer(sendLength);
      var sendBufferView = new Uint8Array(sendBuffer);
      sendBufferView.set(sendData, 0);
      socket.send(sendBuffer, 0, sendBuffer.byteLength);
    }
  } catch (e) {
    console.log('TCPSocketWrapper.js sendCmdData failed: ' + e);
  }
}