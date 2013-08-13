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
XPCOMUtils.defineLazyModuleGetter(this, "ParentModule", "resource://ffosassistant/parentModule.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FileUtils", "resource://gre/modules/FileUtils.jsm");

let driverList = null;

/**
 * Get download url from the driver_list.json
 */

function getDownloadURLForInstanceId(id) {
  // TODO update cached driver list
  if (null == driverList) {
    driverList = JSON.parse(utils.getContentFromURL(DRIVER_LIST_URI));
  }

  let downloadURL = null;
  for (var i = 0; i < driverList.devices.length; i++) {
    if (id == driverList.devices[i].device_instance_id) {
      downloadURL = driverList.devices[i].driver_download_url;
      // Check 32 or 64 bit
      if (typeof downloadURL == 'object' && !! downloadURL['32'] && !! downloadURL['64']) {
        var oscpu = Cc["@mozilla.org/network/protocol;1?name=http"].getService(Ci.nsIHttpProtocolHandler).oscpu;
        dump('oscpu: ' + oscpu + '\n');
        if (oscpu.indexOf('64') > 0) {
          return downloadURL['64'];
        } else {
          return downloadURL['32'];
        }
      }
      break;
    }
  }

  return downloadURL;
}

/**
 * Get local path of the driver.
 *
 * First, we will check if the download url is a remote url, if no,
 * then return the download url as the local path; if yes, then check
 * if it's been downloaded, and then return the downloaded path if yes.
 */

function getLocalPathForInstanceId(id) {
  let downloadURL = getDownloadURLForInstanceId(id);
  if (!downloadURL) {
    return null;
  }

  let isRemoteURL = /^http(s?):\/\//ig.test(downloadURL);
  if (!isRemoteURL) {
    return downloadURL;
  }

  let driverName = getDriverName(downloadURL);
  let file = FileUtils.getFile("ProfD", [DRIVER_HOME, driverName]);

  return file.exists() ? file.path : null;
}

function getDriverName(downloadUrl) {
  // FIXME keep file extension?
  return "USBDriver-" + utils.md5(downloadUrl);
}

function handleSyncCommand(cmd) {
  switch (cmd.command) {
    // If install file for the given USB ID has been found, then
    // return the path, or return null value.
  case 'getInstallerPath':
    return getLocalPathForInstanceId(cmd.deviceInstanceId);
  }
}

var driverDownloaderModule = new ParentModule({
  messages: ['DriverDownloader:syncCommand', 'DriverDownloader:asyncCommand'],

  onmessage: function dm_onmessage(name, msg) {
    debug('Receive message: ' + name);
    var self = this;
    switch (name) {
      // This is a sync message.
    case 'DriverDownloader:syncCommand':
      return handleSyncCommand(msg);
    case 'DriverDownloader:asyncCommand':
      break;
    }
  }
});
