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
XPCOMUtils.defineLazyModuleGetter(this, 'FileUtils', 'resource://gre/modules/FileUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'NetUtil', 'resource://gre/modules/NetUtil.jsm');
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

/***** Component definition *****/
function FFOSAssistant() { }

FFOSAssistant.prototype = {
  __proto__: DOMRequestIpcHelper.prototype,

  classID: ADBSERVICE_CID,

  classInfo: XPCOMUtils.generateCI({
               classID: ADBSERVICE_CID,
               contractID: ADBSERVICE_CONTRACT_ID,
               classDescription: "FFOS Assistant",
               interfaces: [Ci.nsIFFOSAssistant],
               flags: Ci.nsIClassInfo.DOM_OBJECT
             }),

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFFOSAssistant, Ci.nsIDOMGlobalPropertyInitializer]),

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

  /* Implementations */
  get adbConnected() {
    return cpmm.sendSyncMessage('ADBService:connected')[0];
  },

  set onadbstatechange(callback) {
    this._onADBStateChange = callback;
  },

  saveToDisk: function(content, callback, options) {
    var filePicker = Cc["@mozilla.org/filepicker;1"]
                       .createInstance(Ci.nsIFilePicker);
    filePicker.init(this._window, null, Ci.nsIFilePicker.modeSave);

    let self = this;
    callback = (typeof callback === 'function') ? callback : function() {};

    filePicker.open(function onPickComplete(returnCode) {
      switch (returnCode) {
        case Ci.nsIFilePicker.returnOK:
        case Ci.nsIFilePicker.returnReplace:
          let file = filePicker.file;
          var ostream = FileUtils.openSafeFileOutputStream(file);

          var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter'].
                            createInstance(Ci.nsIScriptableUnicodeConverter);
          converter.charset = 'UTF-8';
          var istream = converter.convertToInputStream(content);

          NetUtil.asyncCopy(istream, ostream, function(status) {
            if (!Components.isSuccessCode(status)) {
              // TODO report error
              callback(false);
            } else {
              // Content has been written to the file.
              callback(true);
            }
          });
          break;
        case Ci.nsIFilePicker.returnCancel:
        default:
          callback(returnCode);
          break;
      }
    });
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

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([FFOSAssistant]);

