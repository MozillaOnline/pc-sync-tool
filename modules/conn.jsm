/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ['SocketConn'];

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');

var nsISocketTransportService =
Cc["@mozilla.org/network/socket-transport-service;1"].
getService(Ci.nsISocketTransportService);

function _error(str) {
  dump('-*- conn.jsm error -*- ' + str + '\n');
}

function _logMessage(str) {
  dump('-*- conn.jsm -*- ' + str + '\n');
}

/**
 * Options:
 *  host: 127.0.0.1
 *  port: 23
 *  onopen:
 *  onclose:
 *  onMessage:
 */

function SocketConn(options) {
  this.initialize(options);
}

SocketConn.prototype = {
  outputStream: null,
  inputStream: null,

  initialize: function(options) {
    this.options = options;
  },

  stop: function() {
    if (this.outputStream) {
      this.outputStream.close();
      this.outputStream = null;
    }

    if (this.inputStream) {
      this.inputStream.close();
      this.inputStream = null;
    }

    if (this.nsIConverterOutputStream) {
      this.nsIConverterOutputStream.close();
      this.nsIConverterOutputStream = null;
    }

    if (this.nsIConverterInputStream) {
      this.nsIConverterInputStream.close();
      this.nsIConverterInputStream = null;
    }
  },

  sendData: function(str) {
    this.nsIConverterOutputStream.writeString(str);
  },

  // nsITransportEventSink (Triggered by transport.setEventSink)
  onTransportStatus: function socket_onTransportStatus(transport, status, progress, max) {
    if (status == Ci.nsISocketTransport.STATUS_CONNECTED_TO) {
      // Call event listeners
      if (this.options.onopen) {
        this.options.onopen();
      }

      this.nsIInputStreamPump =
      Cc["@mozilla.org/network/input-stream-pump;1"].
      createInstance(Ci.nsIInputStreamPump);

      this.nsIInputStreamPump.init(this.inputStream, -1, -1, 0, 0, false);
      var self = this;
      this.nsIInputStreamPump.asyncRead({
        data: {},
        restStr: "",

        onStartRequest: function(request, context) {},

        onStopRequest: function(request, context, status) {
          try {
            self.stop();
          } catch (e) {
            _error(e);
          }
          if (self.options.onclose) {
            self.options.onclose(request, context, status);
          }
        },

        onDataAvailable: function(request, context, inputStream, offset, count) {
          self.nsIConverterInputStream.readString(65536, this.data);
          var str = this.restStr + this.data.value;
          // May receive string composed by serveral JSON, should be split.
          str = str.trim();
          var lbCount = 0; // left brace count
          var rbCount = 0; // right brace count
          var start = 0; // start index of json string
          var isLastEscape = false;
          for (var i = 0; i < str.length; i++) {
            var c = str.charAt(i);
            var isEscape = c == "\\";
            if (!isEscape && !isLastEscape) {
              if (c == "{") {
                lbCount += 1;
              } else if (c == "}") {
                rbCount += 1;
                if (rbCount === lbCount) {
                  var jsonStr = str.substring(start, i + 1);
                  _logMessage(jsonStr);
                  if (self.options.onMessage) {
                    try {
                      self.options.onMessage(JSON.parse(jsonStr));
                    } catch (e) {
                      _error(e);
                    }
                  }
                  start = i + 1;
                }
              }
            }
            isLastEscape = isEscape;
          }
        }
      }, null);
    }
  },

  connect: function() {
    this.nsIConverterInputStream =
    Cc["@mozilla.org/intl/converter-input-stream;1"].
    createInstance(Ci.nsIConverterInputStream);

    this.nsIConverterOutputStream =
    Cc["@mozilla.org/intl/converter-output-stream;1"].
    createInstance(Ci.nsIConverterOutputStream);

    var transport = nsISocketTransportService.
    createTransport(null, 0, this.options.host, this.options.port, null);

    transport.setEventSink(this, Services.tm.currentThread);

    this.outputStream = transport.openOutputStream(0, 0, 0);
    this.inputStream = transport.openInputStream(0, 0, 0);

    var REPLACEMENT_CHARACTER = Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
    this.nsIConverterInputStream.init(this.inputStream, "utf8", 65535, REPLACEMENT_CHARACTER);
    this.nsIConverterOutputStream.init(this.outputStream, "utf8", 65535, REPLACEMENT_CHARACTER);
  }
};