/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var ConnectManager = (function() {
  var TIMEOUT = 30000;

  // Record request id and callback functions
  var requests = {};

  var currentId = 0;

  function getNextId() {
    return ++currentId;
  }

  function SocketWrapper(options) {
    this.initialize(options);
  }

  SocketWrapper.prototype = {
    socket: null,

    initialize: function(options) {
      this.options = extend({
        webTCPSocket: true,
        url:       null,
        host: 'localhost',
        port: 10010,
        onclose:   emptyFunction,
        onopen:    emptyFunction,
        onrequest: emptyFunction,
        onerror:   emptyFunction
      }, options);

      if (!this.options.webTCPSocket && !this.options.url) {
        throw new Error('No url is defined');
      } else if (!this.options.host || !this.options.port) {
        throw new Error('Host and port should be defined.');
      }
    },

    get useWebTCPSocket() {
      return this.options.webTCPSocket && navigator.mozTCPSocket;
    },

    connect: function wrapper_connect() {
      if (this.useWebTCPSocket) {
        this.socket = navigator.mozTCPSocket.open(this.options.host, this.options.port);
        this.socket.onopen    = this._onopen.bind(this);
        this.socket.onclose   = this._onclose.bind(this);
        this.socket.ondata    = this._onmessage.bind(this);
        this.socket.onerror   = this._onerror.bind(this);
      } else {
        this.socket = new WebSocket(this.options.url);
        this.socket.onopen    = this._onopen.bind(this);
        this.socket.onclose   = this._onclose.bind(this);
        this.socket.onmessage = this._onmessage.bind(this);
        this.socket.onerror   = this._onerror.bind(this);
      }
    },

    sendRequest: function wrapper_sendRequest(msg, onresponse, onerror) {
      if (typeof msg !== 'object') {
        throw new Error('Message should be an object');
      }

      // Assign an id to identify this request
      msg.id = getNextId();
      // Mark the message as a request
      msg.action = 'request';

      if (this.usb) {
        navigator.mozFFOSAssistant.sendMessage(JSON.stringify(msg));
      } else {
        this.socket.send(JSON.stringify(msg));
      }

      var self = this;
      var timeoutId = window.setTimeout(function onResponseTimeout() {
        self._onResponseTimeout(this);
      }.bind(msg.id), TIMEOUT);

      // Record request id and callback functions
      requests[msg.id] = {
        onresponse: onresponse || emptyFunction,
        onerror: onerror || emptyFunction,
        timeout: timeoutId
      };
    },

    sendResponse: function wrapper_sendResponse(msg) {
       throw new Error('Not implemnted.');
    },

    _onResponseTimeout: function wrapper_onResopnseTimeout(requestId) {
      var callbacks = requests[requestId];
      delete requests[requestId];
      if (callbacks) {
        // Fire timeout error message
        callbacks.onerror({
          status: 408,   // request timeout
          erroMessage: 'Request timeout'
        });
      }
    },

    _onopen: function wrapper_onopen(event) {
      this.options.onopen();
    },

    _onclose: function wrapper_onclose(event) {
      this.options.onclose();
    },

    _onmessage: function wrapper_onmessage(event) {
      var message = null;

      try {
        if (this.usb) {
          message = event;
        } else {
          message = JSON.parse(event.data);
        }
      } catch (e) {
        log("Parse error, received msg from mgmt: " + event.data);
        return;
      }

      // Check if it is a response to some recorded request.
      if (message.action == 'response') {
        var requestId = message.id;
        var callbacks = requests[requestId];
        if (callbacks) {
          if (message.status === 200) {
            try {
              callbacks.onresponse(message);
            } catch (e) {
              callbacks.onerror({
                data: e.toString()
              });
            }
          } else {
            callbacks.onerror(message);
          }
          // Clear timeout
          window.clearTimeout(callbacks.timeout);
          delete requests[requestId];
        }
      } else if (message.action == 'request') {
        this.options.onrequest(message);
      }
    },

    _onerror: function wrapper_onerror(event) {
      this.options.onerror({
        status: 400,
        data: event.data
      });
    }
  };

  /**
   * options:
   *    url: websocket url,
   *    onmessage: on receiving message,
   *    onerror
   */
  function connectTo(options) {
    var wrapper = new SocketWrapper(options);
    wrapper.connect();
    return wrapper;
  }

  return {
    connectTo: connectTo
  }
})();

