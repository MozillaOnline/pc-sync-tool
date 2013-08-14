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
const MANAGER_BINHOME = 'resource://ffosassistant-binhome';
const MANAGER_DMHOME  = 'resource://ffosassistant-dmhome';
const MANAGER_INI_FILE_NAME = 'driver_manager.ini';

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/DOMRequestHelper.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "cpmm",
                                   "@mozilla.org/childprocessmessagemanager;1",
                                   "nsISyncMessageSender");
XPCOMUtils.defineLazyModuleGetter(this, 'FileUtils',        'resource://gre/modules/FileUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'NetUtil',          'resource://gre/modules/NetUtil.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'ctypes',           'resource://gre/modules/ctypes.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services',         'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'SocketConn',       'resource://ffosassistant/conn.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'DriverDownloader', 'resource://ffosassistant/driverDownloader.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'utils',            'resource://ffosassistant/utils.jsm');

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

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFFOSAssistant,
                                         Ci.nsIDOMGlobalPropertyInitializer]),

  // nsIDOMGlobalPropertyInitializer implementation
  init: function(aWindow) {
    // TODO add privileges checking
    // TODO check if the page is privileged, if yes, the __exposedProps__ should not be set

    const messages = ['ADBService:disconnect:Return:OK', 'ADBService:disconnect:Return:NO',
                      'ADBService:statechange',
                      'DriverDownloader:asyncCommand:Return:OK', 'DriverDownloader:asyncCommand:Return:NO',
                      'DriverDownloader:message','ADBService:RunCmd:Return:OK'];
    this.initDOMRequestHelper(aWindow, messages);
  },

  // Called from DOMRequestIpcHelper
  uninit: function() {
    this._onADBStateChange = null;
  },

  _callADBService: function(name, arg) {
    return this._callMessage("ADBService", name, arg);
  },

  _callDriverDownloader: function(name, arg) {
    return this._callMessage("DriverDownloader", name, arg);
  },

  _callDriverManager: function(name, arg) {
    return this._callMessage("DriverManager", name, arg);
  },

  _callMessage: function(moduleName, msgName, arg) {
    var request = this.createRequest();
    this._sendMessageForRequest(moduleName + ":" + msgName, arg, request);
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
      case 'DriverDownloader:asyncCommand:Return:OK':
        request = this.takeRequest(msg.rid);
        if (!request) {
          return;
        }
        Services.DOMRequest.fireSuccess(request, msg.data);
        break;
      case 'DriverDownloader:asyncCommand:Return:NO':
        request = this.takeRequest(msg.rid);
        if (!request) {
          return;
        }
        Services.DOMRequest.fireError(request, "Failed to excute async command");
        break;
      case 'DriverDownloader:message':
        this._onRevDriverDownloaderMessage(msg.data);
        break;
      case 'ADBService:RunCmd:Return:OK':
        request = this.takeRequest(msg.rid);
        if (!request) {
          return;
        }
        Services.DOMRequest.fireSuccess(request, msg.data);
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

  _onRevDriverDownloaderMessage: function(message) {
    let e = this._createEvent('driverdownloadermessage');
    if (this._onDriverDownloaderMessage) {
      this._onDriverDownloaderMessage.handleEvent(e);
    }
    this.dispatchEvent(e);
  },

  /* Implementations */
  get adbConnected() {
    return cpmm.sendSyncMessage('ADBService:connected')[0];
  },

  get adbffosDeviceName() {
    return cpmm.sendSyncMessage('ADBService:ffosDeviceName')[0];
  },

  get driverManagerPort() {
    // Read port number from driver_manager.ini
    try {
      let file = utils.getChromeFileURI(MANAGER_DMHOME).file;
      file.append(MANAGER_INI_FILE_NAME);
      if (!file.exists()) {
        debug('No ini file is found');
        return 0;
      }

      return parseInt(utils.getIniValue(file, 'socket', 'port'));
    } catch (e) {
      debug(e);
      return 0;
    }

    return 0;
  },

  set onadbstatechange(callback) {
    this._onADBStateChange = callback;
  },

  set ondriverdownloadermessage(callback) {
    this._onDriverDownloaderMessage = callback;
  },

  get isDriverManagerRunning() {
    return cpmm.sendSyncMessage('DriverManager:isRunning')[0];
  },

  startDriverManager: function() {
    if (this.isDriverManagerRunning) {
      return;
    }
    this._callDriverManager('start', null);
  },

  setAddonInfo: function(isRun) {
    // Write firefox path to the ini file
    try {
      let file = utils.getChromeFileURI(MANAGER_DMHOME).file;
      file.append(MANAGER_INI_FILE_NAME);
      if (!file.exists()) {
        file.create(Ci.nsIFile.NORMAL_FILE_TYPE, '0644');
      }
      utils.saveIniValue(file, 'firefox', 'path', getFirefoxPath());
      utils.saveIniValue(file, 'status', 'isRun', isRun);
    } catch (e) {
      debug(e);
    }
  },

  wifiConnected: function(isConnected) {
    // Write firefox path to the ini file
    try {
      if (isConnected) {
        this._isWifiConnect = true;
        cpmm.sendSyncMessage('ADBService:wifiConnected')[0];
      } else {
        this._isWifiConnect = false;
        cpmm.sendSyncMessage('ADBService:wifiUnconnected')[0];
      }
    } catch (e) {
      debug(e);
    }
  },

  get isWifiConnect() {
    return this._isWifiConnect;
  },
  /**
   * If it's an async command, a request object will be returned.
   */
  sendCmdToDriverDownloader: function(cmd, async) {
    if (async) {
      return this._callDriverDownloader('asyncCommand', cmd);
    } else {
      return cpmm.sendSyncMessage('DriverDownloader:syncCommand', cmd)[0];
    }
  },

  selectDirectory: function (callback, options) {
    var filePicker = Cc["@mozilla.org/filepicker;1"]
                       .createInstance(Ci.nsIFilePicker);
    let title = options && options.title ? options.title : null;
    filePicker.init(this._window, title, Ci.nsIFilePicker.modeGetFolder);
    callback = (typeof callback === 'function') ? callback : function() {};
    filePicker.open(function onPickComplete(returnCode) {
      switch (returnCode) {
        case Ci.nsIFilePicker.returnOK:
          callback(true,filePicker.fileURL.path);
          break;
      case Ci.nsIFilePicker.returnCancel:
        default:
          callback(false);
          break;
      }
    });
  },

  saveToDisk: function(content, callback, options) {
    var filePicker = Cc["@mozilla.org/filepicker;1"]
                       .createInstance(Ci.nsIFilePicker);
    let title = options && options.title ? options.title : null;
    filePicker.init(this._window, title, Ci.nsIFilePicker.modeSave);
    if (options) {
      if (options.name) {
        filePicker.defaultString = options.name;
      }
      if (options.extension) {
        filePicker.defaultExtension = options.extension;
        // Create filter from extension
        filePicker.appendFilter('*.' + options.extension, '*.' + options.extension);
        filePicker.appendFilters(Ci.nsIFilePicker.filterAll);
      }
    }

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
          callback(false);
          break;
      }
    });
  },

  readFromDisk: function(callback) {
    var filePicker = Cc["@mozilla.org/filepicker;1"]
                       .createInstance(Ci.nsIFilePicker);
    filePicker.init(this._window, null, Ci.nsIFilePicker.modeOpen);
    filePicker.appendFilter('*.vcf', '*.vcf');
    filePicker.appendFilters(Ci.nsIFilePicker.filterAll);
    filePicker.open(function onPickComplete(returnCode) {
      switch (returnCode) {
        case Ci.nsIFilePicker.returnOK:
        case Ci.nsIFilePicker.returnReplace:
          let file = filePicker.file;
          NetUtil.asyncFetch(file, function(inputStream, status) {
            if (!Components.isSuccessCode(status)) {
              //TODO report error
              callback(false,null);
            } else {
              var data = NetUtil.readInputStreamToString(inputStream, inputStream.available(),{charset:'UTF-8'});
              callback(true, data);
            }
          });
          break;
        case Ci.nsIFilePicker.returnCancel:
        default:
          callback(false, null);
      }
    });
  },

  selectMultiFilesFromDisk: function(callback) {
    var filePicker = Cc["@mozilla.org/filepicker;1"]
                       .createInstance(Ci.nsIFilePicker);
    filePicker.init(this._window, null, Ci.nsIFilePicker.modeOpenMultiple);
    filePicker.appendFilters(Ci.nsIFilePicker.filterAll);
    filePicker.open(function onPickComplete(returnCode) {
      switch (returnCode) {
        case Ci.nsIFilePicker.returnOK:
        case Ci.nsIFilePicker.returnReplace:
          var files = filePicker.files;
          var filePath = '';
          while (files.hasMoreElements()) {
            var file = files.getNext().QueryInterface(Components.interfaces.nsIFile);
            filePath += file.path + ';';
          }
          callback(true, filePath);
          break;
        case Ci.nsIFilePicker.returnCancel:
        default:
          callback(false, null);
      }
    });
  },

  runCmd: function(cmd) {
    return this._callMessage('ADBService', 'RunCmd', cmd);
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

function getFirefoxPath() {
  var firefoxPath = Services.dirsvc.get('XREExeF', Ci.nsIFile);
  return firefoxPath.path;
}

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([FFOSAssistant]);

