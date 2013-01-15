/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict"

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- adbService: " + s + "\n"); };
else
  debug = function (s) { };

const LOCAL_PORT = 10010;

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const ADBSERVICE_CONTRACT_ID = '@mozilla.org/adbservice;1';
const ADBSERVICE_CID = Components.ID('{ed7c329e-5b45-4e99-bdae-f4d159a8edc8}');

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, 'ctypes', 'resource://gre/modules/ctypes.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'SocketConn', 'resource://adbservice/conn.jsm');

XPCOMUtils.defineLazyGetter(this, 'libadb', function() {
  // TODO open platform related library.
  let fileUri = Services.io.newURI('resource://adbservice-components/libadbservice.so', null, null);

  if (fileUri instanceof Ci.nsIFileURL) {
    let library = ctypes.open(fileUri.file.path);
    return {
      findDevice: library.declare('findDevice', ctypes.default_abi, ctypes.int),
      setupDevice: library.declare('setupDevice', ctypes.default_abi, ctypes.int)
    };
  } else {
    return {
      findDevice: function libadb_fake_findDevice() {
        return 0;
      },

      setupDevice: function libadb_fake_setupDevice() {
        return 0;
      }
    };
  }
});

function exposeReadOnly(obj) {
  if (null == obj) {
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (obj["__exposedProps__"]) {
    return obj;
  }

  // If the obj is a navite wrapper, can not modify the attribute.
  try {
    obj.__exposedProps__ = {};
  } catch (e) {
    return;
  }

  var exposedProps = obj.__exposedProps__;
  for (let i in obj) {
    if (i === "__exposedProps__") {
      continue;
    }

    if (i[0] === "_") {
      continue;
    }

    exposedProps[i] = "r";

    exposeReadOnly(obj[i]);
  }

  return obj;
};

// Local connection to adb forward port
var _conn = null;
// Registered callbacks
var _registeredCallbacks = null;

function ADBService() { }

ADBService.prototype = {
  classID: ADBSERVICE_CID,

  classInfo: XPCOMUtils.generateCI({
               classID: ADBSERVICE_CID,
               contractID: ADBSERVICE_CONTRACT_ID,
               classDescription: "adbService",
               interfaces: [Ci.nsIADBService],
               flags: Ci.nsIClassInfo.DOM_OBJECT
             }),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIADBService, Ci.nsIDOMGlobalPropertyInitializer]),

  // nsIDOMGlobalPropertyInitializer implementation
  init: function(aWindow) {
    // TODO add privileges checking
  },

  _sendError: function(error) {
    if (_registeredCallbacks && _registeredCallbacks.onerror) {
      _registeredCallbacks.onerror(exposeReadOnly(error));
    }
  },

  /* implementation */
  register: function(options) {
    _registeredCallbacks = options;

    if (_conn == null) {
      if (!libadb.findDevice()) {
        this._sendError({
          data: 'No Device'
        });
        return;
      }

      let success = libadb.setupDevice();
      if (!success) {
        this._sendError({
          data: 'Can not establish the adb forward'
        });
        return;
      }

      _conn = new SocketConn({
        host: '127.0.0.1',

        port: LOCAL_PORT,

        onopen: function conn_onstart() {
          if (_registeredCallbacks && _registeredCallbacks.onopen) {
            _registeredCallbacks.onopen();
          }
        },

        onclose: function conn_onstop() {
          _conn = null;
          if (_registeredCallbacks && _registeredCallbacks.onclose) {
            _registeredCallbacks.onclose();
          }
        },

        onMessage: function conn_onmessage(message) {
          if (_registeredCallbacks && _registeredCallbacks.onmessage) {
            _registeredCallbacks.onmessage(exposeReadOnly(message));
          }
        }
      });

      try {
        _conn.connect();
      } catch (e) {
        debug('Error occurs when connecting: ' + e);
        this._sendError(e);
      }
    }
  },

  uregister: function(options) {
    debug('Uregister');
    _registeredCallbacks = null;
    _conn.stop();
    _conn = null;
  },

  sendMessage: function(obj) {
    if (_conn) {
      try {
        _conn.sendData(obj);
      } catch (e) {
        this._sendError(e);
      }
    } else {
      this._sendError({
        data: 'No connection'
      });
    }
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([ADBService]);

