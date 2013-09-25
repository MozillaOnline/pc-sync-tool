/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict"

let DEBUG = 1;

function debug(s) {
  if (DEBUG) {
    dump("-*- utils: " + s + "\n");
  }
}

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu
} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyServiceGetter(this, 'iniFactory', '@mozilla.org/xpcom/ini-processor-factory;1', 'nsIINIParserFactory');

var EXPORTED_SYMBOLS = ['utils'];

var utils = {
  getContentFromURL: function getContentFromURL(url) {
    var ioService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
    var scriptableStream = Cc['@mozilla.org/scriptableinputstream;1'].getService(Ci.nsIScriptableInputStream);

    var channel = ioService.newChannel(url, null, null);
    var input = channel.open();
    scriptableStream.init(input);
    var str = scriptableStream.read(input.available());
    scriptableStream.close()
    input.close();

    var utf8Converter = Components.classes["@mozilla.org/intl/utf8converterservice;1"].
    getService(Components.interfaces.nsIUTF8ConverterService);
    return utf8Converter.convertURISpecToUTF8(str, "UTF-8");
  },

  readStrFromFile: function(file) {
    if (!file) {
      return '';
    }

    var data = '';
    var fstream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
    var cstream = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);

    try {
      fstream.init(file, -1, 0, 0);
      cstream.init(fstream, 'UTF-8', 0, 0);

      var str = {};
      var read = 0;
      do {
        read = cstream.readString(0xffffffff, str); // read as much as we can and  put it in str.value
        data += str.value;
      } while (read != 0);
    } catch (err) {
      dump('Error occured when reading file: ' + err);
    } finally {
      if (cstream) {
        try {
          cstream.close();
        } catch (err) {
          dump('Error occured when closing file : ' + err);
        }
      }
    }

    return data;
  },

  exposeReadOnly: function exposeReadOnly(obj) {
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
  },

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

  writeToFile: function(file, json) {
    var foStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);

    foStream.init(file, 0x02 | 0x08 | 0x20, parseInt('0666', 8), 0);

    var converter = Cc['@mozilla.org/intl/converter-output-stream;1'].createInstance(Ci.nsIConverterOutputStream);

    try {
      converter.init(foStream, 'UTF-8', 0, 0);
      converter.writeString(json);
    } catch (err) {
      debug('Error occured when writing file: ' + err);
    } finally {
      if (converter) {
        try {
          converter.close();
        } catch (err) {
          debug('Error occured when closing writing addon-notification/rules.json : ' + err);
        }
      }
    }
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
