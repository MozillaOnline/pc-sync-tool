/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    this.options.onclose(event);
  },

  _ondata: function ondata(event) {
    console.log('Received data: ' + event.data);
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
      alert(event);
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
   */
  sendCommand: function tc_sendCommand() {
    if (!this.isConnected()) {
      return;
    }

    var args = [];
    var callback = null;
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] == 'function') {
        callback = arguments[i];
        break;
      }
      args.push(arguments[i]);
    }

    var command = args.join(" ") + "\n";
    this._socket.send(command);
  }
};

