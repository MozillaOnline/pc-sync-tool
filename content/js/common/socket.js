function TCPSocketWrapper(options) {
  this.initialize(options);
}

TCPSocketWrapper.prototype = {
  initialize: function(options) {
    console.log('TCPSocketWrapper.js initialize');
    if (typeof options.socket !== 'object') {
      console.log('Socket object is required.');
      return;
    }
    this.options = options;
    this.socket = options.socket;
    this.lastRecvLength = 0;
    this.socket.ondata = this.onData.bind(this);
    this.socket.ondrain = this.onDrain.bind(this);
    this.socket.onerror = this.onError.bind(this);
    this.socket.onclose = this.onClose.bind(this);
    this._messageQueue = [];
    this._messageRecvingTimer = null;
    this.cmdData = null;
    this.funcData = null;
    this.funcDataLen = 0;
    this.jsonCmd = null;
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
    receivedData = new Uint8Array(receivedData);
    var recvLength = receivedData.byteLength !== undefined ? receivedData.byteLength : receivedData.length;
    while (recvLength > 0) {
      if (this.cmdData == null) {
        if (recvLength < TITLE_SIZE) {
          this.cmdData = receivedData.subarray(0, recvLength);
          return;
        } else {
          this.cmdData = receivedData.subarray(0, TITLE_SIZE);
          this.jsonCmd = titleArray2Json(this.cmdData);
          if (this.jsonCmd.datalength > 0) {
            this.funcData = new Uint8Array(this.jsonCmd.datalength);
            if (this.jsonCmd.datalength > recvLength - TITLE_SIZE) {
              this.funcData.set(receivedData.subarray(TITLE_SIZE, recvLength), 0);
              this.funcDataLen = recvLength - TITLE_SIZE;
              return;
            } else {
              this.funcData.set(receivedData.subarray(TITLE_SIZE, this.jsonCmd.datalength + TITLE_SIZE), 0);
              this.handleMessage(this.jsonCmd, this.funcData);
              this.funcData = null;
              this.cmdData = null;
              receivedData = receivedData.subarray(TITLE_SIZE + this.jsonCmd.datalength, recvLength);
              recvLength = recvLength - TITLE_SIZE - this.jsonCmd.datalength;
              this.funcDataLen = 0;
              continue;
            }
          } else {
            this.handleMessage(this.jsonCmd, null);
            this.funcData = null;
            this.cmdData = null;
            receivedData = receivedData.subarray(TITLE_SIZE, recvLength);
            recvLength = recvLength - TITLE_SIZE;
            this.funcDataLen = 0;
            continue;
          }
        }
      } else {
        var cmdDataLength = this.cmdData.byteLength !== undefined ?
          this.cmdData.byteLength : this.cmdData.length;
        if (cmdDataLength < TITLE_SIZE) {
          if (recvLength + cmdDataLength < TITLE_SIZE) {
            this.cmdData = receivedData.subarray(cmdDataLength, recvLength);
            return;
          } else {
            this.cmdData = receivedData.subarray(cmdDataLength, TITLE_SIZE - cmdDataLength);
            this.jsonCmd = titleArray2Json(this.cmdData);
            if (this.jsonCmd.datalength > 0) {
              this.funcData = new Uint8Array(this.jsonCmd.datalength);
              if (this.jsonCmd.datalength > recvLength - TITLE_SIZE + cmdDataLength) {
                this.funcData.set(receivedData.subarray(TITLE_SIZE - cmdDataLength, recvLength), 0);
                this.funcDataLen = recvLength - TITLE_SIZE + cmdDataLength;
                return;
              } else {
                this.funcData.set(receivedData.subarray(TITLE_SIZE - cmdDataLength, this.jsonCmd.datalength + TITLE_SIZE - cmdDataLength), 0);
                this.handleMessage(this.jsonCmd, this.funcData);
                this.funcData = null;
                this.cmdData = null;
                receivedData = receivedData.subarray(TITLE_SIZE - cmdDataLength + this.jsonCmd.datalength, recvLength);
                recvLength = recvLength - TITLE_SIZE + cmdDataLength - this.jsonCmd.datalength;
                this.funcDataLen = 0;
                continue;
              }
            } else {
              this.handleMessage(this.jsonCmd, null);
              this.funcData = null;
              this.cmdData = null;
              receivedData = receivedData.subarray(TITLE_SIZE - cmdDataLength, recvLength);
              recvLength = recvLength - TITLE_SIZE + cmdDataLength;
              this.funcDataLen = 0;
              continue;
            }
          }
        } else {
          if (this.jsonCmd.datalength > recvLength + this.funcDataLen) {
            this.funcData.set(receivedData.subarray(0, recvLength), this.funcDataLen);
            this.funcDataLen = recvLength + this.funcDataLen;
            return;
          } else {
            this.funcData.set(receivedData.subarray(0, this.jsonCmd.datalength - this.funcDataLen), this.funcDataLen);
            console.log("buffer ok: " + this.jsonCmd.datalength);
            this.handleMessage(this.jsonCmd, this.funcData);
            this.funcData = null;
            this.cmdData = null;
            receivedData = receivedData.subarray(this.jsonCmd.datalength - this.funcDataLen, recvLength);
            recvLength = recvLength + this.funcDataLen - this.jsonCmd.datalength;
            this.funcDataLen = 0;
            continue;
          }
        }
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
    this.socket = null;
    this._messageQueue = [];
    this._messageRecvingTimer = null;
    this.funcData = null;
    this.cmdData = null;
    this.funcDataLen = 0;
  },

  onClose: function(event) {
    console.log('TCPSocketWrapper.js onClose');
    if (this.options.onclose) {
      this.options.onclose(event);
    }
    this.socket = null;
    this._messageQueue = [];
    this._messageRecvingTimer = null;
    this.funcData = null;
    this.cmdData = null;
    this.funcDataLen = 0;
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