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
Cu.import("resource://gre/modules/DOMRequestHelper.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "cpmm",
                                   "@mozilla.org/childprocessmessagemanager;1",
                                   "nsISyncMessageSender");
XPCOMUtils.defineLazyModuleGetter(this, 'ctypes', 'resource://gre/modules/ctypes.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'SocketConn', 'resource://ffosassistant/conn.jsm');

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
let _conn = null;
// Registered callbacks
let _registeredCallbacks = null;

/***** Component definition *****/
function ADBService() { }

ADBService.prototype = {
  __proto__: DOMRequestIpcHelper.prototype,

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
    // TODO check if the page is privileged, if yes, the __exposedProps__ should not be set

    const messages = ['ADBService:connect:Return:OK', 'ADBService:connect:Return:NO',
                      'ADBService:disconnect:Return:OK', 'ADBService:disconnect:Return:NO',
                      'ADBService:statechange'];
    this.initHelper(aWindow, messages);
  },

  // Called from DOMRequestIpcHelper
  uninit: function() {
    this._onADBStateChange = null;
  },

  _call: function(name, arg) {
    var request = this.createRequest();
    this._sendMessageForRequest("ADBService:" + name, arg, request);
    return request;
  },

  _sendMessageForRequest: function(name, data, request) {
    let id = this.getRequestId(request);
    cpmm.sendAsyncMessage(name, {
      data: data,
      rid: id,
      mid: this._id
    });
  },

  _sendError: function(error) {
    if (_registeredCallbacks && _registeredCallbacks.onerror) {
      // _registeredCallbacks.onerror(exposeReadOnly(error));
      _registeredCallbacks.onerror(error);
    }
  },

  _fireEvent: function(name, args) {
    var callbackName = 'on' + name;

    if (_registeredCallbacks && _registeredCallbacks[callbackName]) {
      _registeredCallbacks[callbackName](args);
    }
  },

  _createEvent: function(name) {
    return new this._window.Event(name);
  },

  receiveMessage: function(aMessage) {
    let msg = aMessage.json;
    debug('Receive message: ' + JSON.stringify(msg));
    if (msg.mid && msg.mid != this._id) {
      return;
    }

    let request = null;
    switch (aMessage.name) {
      case 'ADBService:connect:Return:OK':
        request = this.takeRequest(msg.rid);
        if (!request) {
          return;
        }
        Services.DOMRequest.fireSuccess(request, null);
        break;
      case 'ADBService:connect:Return:NO':
        request = this.takeRequest(msg.rid);
        if (!request) {
          return;
        }
        Services.DOMRequest.fireError(request, "Failed to call ADB forward");
        break;
      case 'ADBService:disconnect:Return:OK':
        request = this.takeRequest(msg.rid);
        if (!request) {
          return;
        }
        Services.DOMRequest.fireSuccess(request, null);
        break;
      case 'ADBService:disconnect:Return:NO':
        request = this.takeRequest(msg.rid);
        if (!request) {
          return;
        }
        Services.DOMRequest.fireError(request, "Failed to disconnect");
        break;
      case 'ADBService:statechange':
        this._onStateChange();
        break;
      default:
        break;
    }
  },

  _onStateChange: function() {
    let e = this._createEvent('adbstatechange');
    if (this._onADBStateChange) {
      this._onADBStateChange.handleEvent(e);
    }
    this.dispatchEvent(e);
  },

  /* implementation */
  register: function(options) {
    _registeredCallbacks = options;

    if (_conn != null) {
      debug('Connection is already opened.');
      // Already connected, fire onopen event
      this._fireEvent('open');
      return;
    }

    debug('Create connection');

    let self = this;
    let request = this._call('connect');
    request.onsuccess = function onsuccess_connect(event) {
      if (_conn) {
        debug('Connection is already opened.');
        // Already connected, fire onopen event
        self._fireEvent('open');
        return;
      }

      _conn = new SocketConn({
        host: '127.0.0.1',

        port: LOCAL_PORT,

        onopen: function conn_onstart() {
          self._fireEvent('open');
        },

        onclose: function conn_onstop() {
          _conn = null;
          self._fireEvent('close');
        },

        onMessage: function conn_onmessage(message) {
          // Don't need to expose read only property for privileged pages.
          // self._fireEvent('message', exposeReadOnly(message));
          self._fireEvent('message', message);
        }
      });

      try {
        _conn.connect();
      } catch (e) {
        debug('Error occurs when connecting: ' + e);
        _conn = null;
        self._sendError(e);
      }
    };

    request.onerror = function onerror_connect(event) {
      debug('Failed to connect');

      self._sendError({
        data: 'No Device'
      });
    };
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
  },

  get adbConnected() {
    return cpmm.sendSyncMessage('ADBService:connected')[0];
  },

  set onadbstatechange(callback) {
    this._onADBStateChange = callback;
  },

  // These are fake implementations, will be replaced by using
  // nsJSDOMEventTargetHelper, see bug 731746
  addEventListener: function(type, listener, useCapture) {
    if (!this._eventListenersByType) {
      this._eventListenersByType = {};
    }

    if (!listener) {
      return;
    }

    var listeners = this._eventListenersByType[type];
    if (!listeners) {
      listeners = this._eventListenersByType[type] = [];
    }

    useCapture = !!useCapture;
    for (let i = 0, len = listeners.length; i < len; i++) {
      let l = listeners[i];
      if (l && l.listener === listener && l.useCapture === useCapture) {
        return;
      }
    }

    listeners.push({
      listener: listener,
      useCapture: useCapture
    });
  },

  removeEventListener: function(type, listener, useCapture) {
    if (!this._eventListenersByType) {
      return;
    }

    useCapture = !!useCapture;

    var listeners = this._eventListenersByType[type];
    if (listeners) {
      for (let i = 0, len = listeners.length; i < len; i++) {
        let l = listeners[i];
        if (l && l.listener === listener && l.useCapture === useCapture) {
          listeners.splice(i, 1);
        }
      }
    }
  },

  dispatchEvent: function(evt) {
    if (!this._eventListenersByType) {
      return;
    }

    let type = evt.type;
    var listeners = this._eventListenersByType[type];
    if (listeners) {
      for (let i = 0, len = listeners.length; i < len; i++) {
        let listener = listeners[i].listener;

        try {
          if (typeof listener == "function") {
            listener.call(this, evt);
          } else if (listener && listener.handleEvent &&
                     typeof listener.handleEvent == "function") {
            listener.handleEvent(evt);
          }
        } catch (e) {
          debug("Exception is caught: " + e);
        }
      }
    }
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([ADBService]);

