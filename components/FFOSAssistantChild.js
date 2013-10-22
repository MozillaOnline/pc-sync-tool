/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict"

let DEBUG = 0;

function debug(s) {
  if (DEBUG) {
    dump("-*- adbService: " + s + "\n");
  }
}

const LOCAL_PORT = 10010;

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

const ADBSERVICE_CONTRACT_ID = '@mozilla.org/adbservice;1';
const ADBSERVICE_CID = Components.ID('{ed7c329e-5b45-4e99-bdae-f4d159a8edc8}');
const MANAGER_BINHOME = 'resource://ffosassistant-binhome';

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyServiceGetter(this, "cpmm", "@mozilla.org/childprocessmessagemanager;1", "nsISyncMessageSender");
XPCOMUtils.defineLazyServiceGetter(this, "xulRuntime", '@mozilla.org/xre/app-info;1', "nsIXULRuntime");
XPCOMUtils.defineLazyModuleGetter(this, 'FileUtils', 'resource://gre/modules/FileUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'NetUtil', 'resource://gre/modules/NetUtil.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'DriverDownloader', 'resource://ffosassistant/driverDownloader.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://ffosassistant/utils.jsm');

/***** Component definition *****/

function FFOSAssistant() {}

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
    const messages = [{
      name: 'ADBService:disconnect:Return:OK',
      strongRef: true
    }, {
      name: 'ADBService:disconnect:Return:NO',
      strongRef: true
    }, {
      name: 'ADBService:statechange',
      strongRef: true
    }, {
      name: 'DriverDownloader:asyncCommand:Return:OK',
      strongRef: true
    }, {
      name: 'DriverDownloader:asyncCommand:Return:NO',
      strongRef: true
    }, {
      name: 'DriverDownloader:message',
      strongRef: true
    }, {
      name: 'ADBService:RunCmd:Return:OK',
      strongRef: true
    }];
    this.initDOMRequestHelper(aWindow, messages);
  },

  // Called from DOMRequestIpcHelper
  uninit: function() {
    this._onADBStateChange = null;
  },

  _callADBService: function(name, arg) {
    return this._callMessage("ADBService", name, arg);
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
  },

  /* Implementations */
  get adbConnected() {
    return cpmm.sendSyncMessage('ADBService:connected')[0];
  },

  get isWindows() {
    return xulRuntime.OS == 'WINNT';
  },

  get adbffosDeviceName() {
    return cpmm.sendSyncMessage('ADBService:ffosDeviceName')[0];
  },

  set onadbstatechange(callback) {
    this._onADBStateChange = callback;
  },

  set isWifiConnected(isConnected) {
    // Write firefox path to the ini file
    try {
      if (isConnected) {
        this._isWifiConnected = true;
        cpmm.sendSyncMessage('ADBService:wifiConnected')[0];
      } else {
        this._isWifiConnected = false;
        cpmm.sendSyncMessage('ADBService:wifiUnconnected')[0];
      }
    } catch (e) {
      debug(e);
    }
  },

  get isWifiConnected() {
    return this._isWifiConnected;
  },

  selectDirectory: function(callback, options) {
    var nsIFilePicker = Ci.nsIFilePicker;
    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    let title = options && options.title ? options.title : null;
    filePicker.init(this._window, title, Ci.nsIFilePicker.modeGetFolder);
    if (options && options.fileType) {
      if (options.fileType == 'Image') {
        filePicker.appendFilters(nsIFilePicker.filterImages);
      } else if (options.fileType == 'Audio') {
        filePicker.appendFilters(nsIFilePicker.filterAudio);
      } else if (options.fileType == 'Video') {
        filePicker.appendFilters(nsIFilePicker.filterVideo);
      } else {
        filePicker.appendFilters(nsIFilePicker.filterAll);
      }
    } else {
      filePicker.appendFilters(nsIFilePicker.filterAll);
    }
    callback = (typeof callback === 'function') ? callback : function() {};
    filePicker.open(function onPickComplete(returnCode) {
      switch (returnCode) {
      case Ci.nsIFilePicker.returnOK:
        callback(filePicker.fileURL.path);
        break;
      case Ci.nsIFilePicker.returnCancel:
      default:
        break;
      }
    });
  },

  saveToDisk: function(content, callback, options) {
    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
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
    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
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
            callback(false, null);
          } else {
            var data = NetUtil.readInputStreamToString(inputStream, inputStream.available(), {
              charset: 'UTF-8'
            });
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

  selectMultiFilesFromDisk: function(callback, options) {
    var nsIFilePicker = Ci.nsIFilePicker;
    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    let title = options && options.title ? options.title : null;
    filePicker.init(this._window, title, Ci.nsIFilePicker.modeOpenMultiple);
    if (options && options.fileType) {
      if (options.fileType == 'Image') {
        filePicker.appendFilters(nsIFilePicker.filterImages);
      } else if (options.fileType == 'Audio') {
        filePicker.appendFilters(nsIFilePicker.filterAudio);
      } else if (options.fileType == 'Video') {
        filePicker.appendFilters(nsIFilePicker.filterVideo);
      } else if (options.fileType == 'VideoTypes') {
        filePicker.appendFilter('Video Files', '*.webm;*.ogv;*.ogg;*.mp4;*.3gp');
      } else {
        filePicker.appendFilters(nsIFilePicker.filterAll);
      }
    } else {
      filePicker.appendFilters(nsIFilePicker.filterAll);
    }
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
        callback(filePath);
        break;
      case Ci.nsIFilePicker.returnCancel:
      default:
        break;
      }
    });
  },

  getGalleryCachedDir: function(pathArray) {
    return FileUtils.getDir("ProfD", pathArray, false).path;
  },

  runCmd: function(cmd) {
    return this._callMessage('ADBService', 'RunCmd', cmd);
  }
};

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([FFOSAssistant]);