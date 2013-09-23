/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 1;

debug = function(s) {
  if (DEBUG) {
    dump("-*- DriverDownloader: " + s + "\n");
  }
};

var EXPORTED_SYMBOLS = ['DriverDownloader'];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

const DRIVER_HOME = "USBDrivers";
const DRIVER_LIST_URI = "resource://ffosassistant-driverlist";

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "utils", "resource://ffosassistant/utils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FileUtils", "resource://gre/modules/FileUtils.jsm");

var DriverDownloader = {
  driverList: null,
  getInstallerPath: function getInstallerPath(deviceInstanceId) {
    // TODO update cached driver list
    if (null == this.driverList) {
      this.driverList = JSON.parse(utils.getContentFromURL(DRIVER_LIST_URI));
    }

    let downloadURL = null;
    for (var i = 0; i < this.driverList.devices.length; i++) {
      if (deviceInstanceId == this.driverList.devices[i].device_instance_id) {
        downloadURL = this.driverList.devices[i].driver_download_url;
        // Check 32 or 64 bit
        if (typeof downloadURL == 'object' && !! downloadURL['32'] && !! downloadURL['64']) {
          var oscpu = Cc["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).oscpu;
          dump('oscpu: ' + oscpu + '\n');
          if (oscpu.indexOf('64') > 0) {
            downloadURL = downloadURL['64'];
          } else {
            downloadURL = downloadURL['32'];
          }
        }
        break;
      }
    }

    if (!downloadURL) {
      return null;
    }

    let isRemoteURL = /^http(s?):\/\//ig.test(downloadURL);
    if (!isRemoteURL) {
      return downloadURL;
    }

    let driverName = 'USBDriver-' + utils.md5(downloadURL);
    let file = FileUtils.getFile("ProfD", [DRIVER_HOME, driverName]);

    return file.exists() ? file.path : null;
  }
};
