/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Attributes in the options object:
 *   host: 
 *     Default value is localhost.
 *   port:
 *     Default value is 0, which means no port is specified.
 *   onmessage:
 *     Callback function for initiative messages from server.
 *     It is different from the echo message, if you send a command,
 *     you should pass the callback function as the last argument 
 *     to receive the echo message.
 *   onopen:
 *     Callback function for connection opening.
 *   onclose:
 *     Callback function for connection closing.
 */
function TelnetClient(options) {
  this.initialize(options);
}

TelnetClient.prototype = {
  initialize: function tc_init(options) {
    this.options = extend({
      host: 'localhost',
      port: 0,
      onmessage: emptyFunction,
      onopen: emptyFunction,
      onclose: emptyFunction
    }, options);

    if (!this.options.port) {
      throw Error('No port is specified.');
    }

    this._callback = null;
    this._queue = [];
    this._connected = false;
    this._socket = null;

    var self = this;
    window.addEventListener("unload", function(event) {
      console.log('unload window');
      self.disconnect();
    }, true);
  },

  _onopen: function onopen(event) {
    console.log('Connection is opened.');
    this._connected = true;
    this._socket.onclose = this._onclose.bind(this);
    this._socket.ondata = this._ondata.bind(this);
    this.options.onopen(event);
  },

  _onclose: function onclose(event) {
    console.log('Connection is closed.');
    this._connected = false;
    this._socket = null;
    this._callback = null;
    this._queue = [];
    this.options.onclose(event);
  },

  _ondata: function ondata(event) {
    console.log('Received data: ' + event.data);
    var recvData = this._filterNotification(event.data);

    var data = null;
    
    try {
      data = JSON.parse(recvData);
    } catch (e) {
      console.log('Not a valid JSON string.');
      return;
    }

    // Check if the _callback is null, if yes, it means the message
    // is the echo for last command.
    try {
      if (this._callback) {
        this._callback(data);
      } else {
        this.options.onmessage(data);
      }
    } catch (e) {
      console.log('Error occurs when invoking callback: ' + e); 
    } finally {
      this._callback = null;
      this._sendQueuedCommand();
    }
  },

  _filterNotification: function(str) {
    // Tranverse the event.data, if we received '\b' (charcode: 7), it
    // means we received a notification.
    var filteredStr = '';

    for (var i = 0; i < str.length; i++) {
      var charCode = str.charCodeAt(i);
      if (charCode == 7) {
        // We got a notification.
        this.options.onmessage({
          type: 'notification'
        });
      } else {
        filteredStr += str.charAt(i);
      }
    }

    return filteredStr;
  },

  _sendQueuedCommand: function() {
    if (this._queue.length > 0) {
      this.sendCommand.apply(this, this._queue.shift());
    }
  },

  /* Interfaces */
  isConnected: function() {
    return !!this._connected;
  },

  connect: function() {
    if (this._socket) {
      return this;
    }

    this._socket = navigator.mozTCPSocket.open(this.options.host,
      this.options.port, { binaryType: 'string' });

    this._socket.onopen = this._onopen.bind(this);
    this._socket.onerror = function(event) {
      alert("telnet error: " + event.data);
    };

    return this;
  },

  disconnect: function() {
    console.log("disconnect socket: " + this._connected);
    if (this._connected) {
      this._socket.close();
    }
  },

  /**
   * arguments:
   *   command, arg1, arg2 ... argn, callback
   *
   * The last argument should be the callback function to receive
   * the echo message.
   */
  sendCommand: function tc_sendCommand() {
    if (!this.isConnected()) {
      throw Error('Server is disconnected.');
    }

    // One command at a time.
    if (this._callback) {
      this._queue.push(arguments);
      return;
    }

    // There will be an echo sent back whenever we send a command,
    // so we need cache the callback here.
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] == 'function') {
        this._callback = arguments[i];
        break;
      }
      args.push(arguments[i]);
    }

    // Check if the callback is null, if yes, set it with emptyFunction
    // which means the next message is an echo for this command, not an
    // initiative message from the server.
    this._callback = this._callback || emptyFunction;

    var command = args.join("\t") + "\n";
    this._socket.send(command);
  }
};

