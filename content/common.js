var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("chrome://pelicanclient/content/log4moz.js");

var nsISocketTransportService =
  Cc["@mozilla.org/network/socket-transport-service;1"].
    getService(Ci.nsISocketTransportService);

// setup logging
function setuplogging() {
  var formatter = new Log4Moz.BasicFormatter();
  var root = Log4Moz.repository.rootLogger;
  root.level = Log4Moz.Level["All"];

  var _appender = new Log4Moz.RotatingFileAppender(FileUtils.getFile("Desk", ["addon.log"]), formatter, 1024 * 1024 * 100);

  root.addAppender(_appender);

  // var _consoleAppender = new Log4Moz.ConsoleAppender(formatter);
  // root.addAppender(_consoleAppender);

  window.addEventListener("unload", function() {
    root.removeAppender(_appender);
  // root.removeAppender(_consoleAppender);
  }, false);
}

setuplogging();

var _logger = Log4Moz.repository.getLogger("console");
var _socketLogger = Log4Moz.repository.getLogger("socket");

function _logInConsole(str, console, level) {
  if (console == "#socket-console" && typeof SOCKET_DEBUG != 'undefined' && false == SOCKET_DEBUG) {
    return;
  }

  var now = new Date();
  $(console).append($('<div class="' + level + '"><span class="timeline">' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds() + '</span>' + str + "</div>"));
  $(console)[0].scrollTop = 1000000;
  if ($(console)[0].childNodes.length > 50) {
    var idx = 0;
  while (idx > 0) {
    idx--;
    $(console)[0].removeChild($(console)[0].childNodes[0]);
  }
  }
}

var _logSocketWithLogger = false;

function clearConsole() {
  $("#console").html("");
  $("#socket-console").html("");
}

function _log(str) {
  _logInConsole(str, "#console", "debug");
  _logger.trace(str);
}

function _info(str) {
  _logInConsole(str, "#console", "info");
  _logger.info(str);
}

function _error(str) {
  _logInConsole(str, "#console", "error");
  _logger.error(str);
}

function _logMessage(str) {
  _logInConsole(str, "#socket-console", "debug");
  if (_logSocketWithLogger) {
    _socketLogger.trace(str);
  }
}

/**
 Options:
   host: 127.0.0.1
   port: 23
   onStartRequest:
   onStopRequest:
   onMessage:
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

  sendData: function(obj) {
    this.nsIConverterOutputStream.writeString(JSON.stringify(obj));
  },

  connect: function() {
    this.nsIConverterInputStream =
      Cc["@mozilla.org/intl/converter-input-stream;1"].
      createInstance(Ci.nsIConverterInputStream);

    this.nsIConverterOutputStream =
      Cc["@mozilla.org/intl/converter-output-stream;1"].
        createInstance(Ci.nsIConverterOutputStream);

    this.nsIInputStreamPump =
      Cc["@mozilla.org/network/input-stream-pump;1"].
        createInstance(Ci.nsIInputStreamPump);

    var transport = nsISocketTransportService.
          createTransport(null, 0, this.options.host, this.options.port, null);

    this.outputStream = transport.openOutputStream(0, 0, 0);
    this.inputStream = transport.openInputStream(0, 0, 0);

    var REPLACEMENT_CHARACTER = Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
    this.nsIConverterInputStream.init(this.inputStream, "utf8", 65535, REPLACEMENT_CHARACTER);
    this.nsIConverterOutputStream.init(this.outputStream, "utf8", 65535, REPLACEMENT_CHARACTER);

    this.nsIInputStreamPump.init(this.inputStream, -1, -1, 0, 0, false);
    var self = this;
    this.nsIInputStreamPump.asyncRead({
      data: { },
      restStr: "",

      onStartRequest: function(request, context) {
        if (self.options.onStartRequest) {
          self.options.onStartRequest(request, context);
        }
      },

      onStopRequest: function(request, context, status) {
        try {
          self.stop();
        } catch (e) {
          _error(e);
        }
        if (self.options.onStopRequest) {
          self.options.onStopRequest(request, context, status);
        }
      },

      onDataAvailable: function(request, context, inputStream, offset, count) {
        self.nsIConverterInputStream.readString(65536, this.data);
        var str = this.restStr + this.data.value;
        // May receive string composed by serveral JSON, should be split.
        str = str.trim();
        var lbCount = 0;  // left brace count
        var rbCount = 0;  // right brace count
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
};

