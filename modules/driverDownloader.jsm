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

const {
  classes: Cc,
  interfaces: Ci,
  utils: Cu,
  results: Cr
} = Components;

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
        let drivers = this.driverList.devices[i].drivers;
        // Check 32 or 64 bit or win8
        var oscpu = Cc["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).oscpu;
        debug('oscpu: ' + oscpu + '\n');
        if (oscpu.contains('6.2')) {
          oscpu = oscpu.contains('64') ? 'amd64.6.2' : 'x86.6.2';
        } else {
          oscpu = oscpu.contains('64') ? 'amd64' : 'x86';
        }
        for (var i = 0; i < drivers.length; i++) {
          var driver = drivers[i];
          if (driver.OS == 'all' || driver.OS == oscpu) {
            downloadURL = driver.download_url;
            break;
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
