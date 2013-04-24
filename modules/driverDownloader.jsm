/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

let DEBUG = 1;
if (DEBUG)
  debug = function (s) { dump("-*- DriverDownloader: " + s + "\n"); };
else
  debug = function (s) { };

var EXPORTED_SYMBOLS = ['DriverDownloader'];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;
const DRIVER_HOME = "USBDrivers";
const DRIVER_LIST_URI = "resource://ffosassistant-driverlist";

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyServiceGetter(this, "ppmm",
                                   "@mozilla.org/parentprocessmessagemanager;1",
                                   "nsIMessageListenerManager");
XPCOMUtils.defineLazyModuleGetter(this, "utils",     "resource://ffosassistant/utils.jsm");
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
  switch(cmd.command) {
    // If install file for the given USB ID has been found, then
    // return the path, or return null value.
    case 'getInstallerPath':
      return getLocalPathForInstanceId(cmd.deviceInstanceId);
  }
}

let messageReceiver = {
  receiveMessage: function ddMsgRev_receiveMessage(aMessage) {
    debug('Receive message: ' + JSON.stringify(aMessage));

    let msg = aMessage.json || {};
    msg.manager = aMessage.target;

    var self = this;
    switch (aMessage.name) {
      // This is a sync message.
      case 'DriverDownloader:syncCommand':
        return handleSyncCommand(msg);
      case 'DriverDownloader:asyncCommand':
        break;
    }
  },

  _sendMessage: function(message, success, data, msg) {
    msg.manager.sendAsyncMessage(message + (success ? ":OK" : ":NO"), {
      data: data,
      rid: msg.rid,
      mid: msg.mid
    });
  }
};

const messages = ['DriverDownloader:syncCommand', 'DriverDownloader:asyncCommand'];
messages.forEach(function(msgName) {
  ppmm.addMessageListener(msgName, messageReceiver);
});

