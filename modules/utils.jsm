/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict"

let DEBUG = 0;

function debug(s) {
  if (DEBUG) {
    dump("-*- utils: " + s + "\n");
  }
}

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'FileUtils', 'resource://gre/modules/FileUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'AddonManager', 'resource://gre/modules/AddonManager.jsm');
XPCOMUtils.defineLazyServiceGetter(this, "xulRuntime", '@mozilla.org/xre/app-info;1', "nsIXULRuntime");
XPCOMUtils.defineLazyServiceGetter(this, 'iniFactory', '@mozilla.org/xpcom/ini-processor-factory;1', 'nsIINIParserFactory');

var EXPORTED_SYMBOLS = ['utils'];

var utils = {
  md5: function md5(str) {
    var data = str.split('');
    var ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    ch.init(ch.MD5);
    ch.update(data, data.length);
    var hash = ch.finish(true);

    // return the two-digit hexadecimal code for a byte
    function toHexString(charCode) {
      return ("0" + charCode.toString(16)).slice(-2);
    }

    // convert the binary hash data to a hex string.
    return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
  },

  getChromeFileURI: function getChromeFileURI(uri) {
    let fileURI = Services.io.newURI(uri, null, null);
    if (!(fileURI instanceof Ci.nsIFileURL)) {
      return null;
    }
    return fileURI;
  },

  emptyFunction: function emptyFunction() {},

  /**
   * Returns the value for a given property in an INI file
   * @param {nsIFile} iniFile
   *   The ini file to get the value from
   * @param {String} section
   *   The name of the section in the ini file.
   * @param {String} prop
   *   The name of the property to get
   */
  getIniValue: function getIniValue(iniFile, section, prop) {
    try {
      let iniParser = iniFactory.createINIParser(iniFile);
      return iniParser.getString(section, prop);
    } catch (e) {
      return undefined;
    }
  },

  /**
   * Save value for a given property in an INI file
   * @param {nsIFile} iniFile
   *   The ini file to save the value to
   * @param {String} section
   *   The name of the section in the ini file
   * @param {String} prop
   *   The name of the property to get
   */
  saveIniValue: function saveIniValue(iniFile, section, prop, value) {
    try {
      let iniWriter = iniFactory.createINIParser(iniFile).QueryInterface(Ci.nsIINIParserWriter);
      iniWriter.setString(section, prop, value);
      iniWriter.writeFile();
      return true;
    } catch (e) {
      debug(e);
      return false;
    }
  },

  selectDirectory: function(callback, options) {
    var nsIFilePicker = Ci.nsIFilePicker;
    var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    let title = options && options.title;
    let win = Services.wm.getMostRecentWindow('navigator:browser');
    filePicker.init(win, title, Ci.nsIFilePicker.modeGetFolder);
    if (options && options.fileType) {
      if (options.fileType == 'Image') {
        filePicker.appendFilters(nsIFilePicker.filterImages);
      } else if (options.fileType == 'Audio') {
        filePicker.appendFilters(nsIFilePicker.filterAudio);
      } else if (options.fileType == 'Video') {
        filePicker.appendFilters(nsIFilePicker.filterVideo);
      } else if (options.fileType == 'AudioTypes') {
        filePicker.appendFilter('Audio Files', '*.mp3;*.m4a;*.m4b;*.m4p;*.m4r;*.mp4;*.amr;*.oga;*.ogg;*.opus;*.wav;*.3gp');
      } else if (options.fileType == 'VideoTypes') {
        filePicker.appendFilter('Video Files', '*.webm;*.ogv;*.ogg;*.ogx;*.mp4;*.m4v;*.mpeg;*.mpg;*.3gp');
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
        var path = filePicker.fileURL.path;
        if (xulRuntime.OS == 'WINNT') {
          path = path.substr(1);
        }
        callback(path);
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
    let win = Services.wm.getMostRecentWindow('navigator:browser');
    filePicker.init(win, title, Ci.nsIFilePicker.modeSave);
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
    let win = Services.wm.getMostRecentWindow("navigator:browser");
    filePicker.init(win, null, Ci.nsIFilePicker.modeOpen);
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
    let win = Services.wm.getMostRecentWindow('navigator:browser');
    filePicker.init(win, title, Ci.nsIFilePicker.modeOpenMultiple);
    if (options && options.fileType) {
      if (options.fileType == 'Image') {
        filePicker.appendFilters(nsIFilePicker.filterImages);
      } else if (options.fileType == 'Audio') {
        filePicker.appendFilters(nsIFilePicker.filterAudio);
      } else if (options.fileType == 'Video') {
        filePicker.appendFilters(nsIFilePicker.filterVideo);
      } else if (options.fileType == 'AudioTypes') {
        filePicker.appendFilter('Audio Files', '*.mp3;*.m4a;*.m4b;*.m4p;*.m4r;*.mp4;*.amr;*.oga;*.ogg;*.opus;*.wav;*.3gp');
      } else if (options.fileType == 'VideoTypes') {
        filePicker.appendFilter('Video Files', '*.webm;*.ogv;*.ogg;*.ogx;*.mp4;*.m4v;*.mpeg;*.mpg;*.3gp');
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

  getCachedDir: function(pathArray) {
    return FileUtils.getDir("ProfD", pathArray, false).path;
  },

  getFileSize: function(path) {
    var f = new FileUtils.File(path);
    return f.isFile() ? f.fileSize : 0;
  },

  isWindows: function() {
    return xulRuntime.OS == 'WINNT';
  },

  isMac: function() {
    return xulRuntime.OS == 'Darwin';
  },

  getAdbHelperInfo: function(callback) {
    var id = 'adbhelper@mozilla.org';
    AddonManager.getAddonByID(id, callback);
  },

  checkAdbHelperVersion: function(ver, minVer) {
    return Services.vc.compare(ver, minVer);
  }
};

(function() {
  function extend(destination, source) {
    for (var property in source)
    destination[property] = source[property];
    return destination;
  }

  extend(utils, {
    extend: extend
  });
})();
