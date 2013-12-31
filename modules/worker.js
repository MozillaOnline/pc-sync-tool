/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let DEBUG = 0;

function debug(s) {
  if (DEBUG) {
    dump("-*- adb service worker: " + s + "\n");
  }
}

var device = '';
var ADB_PATH = '';
var LOCAL_PORT = 25679;
var REMOTE_PORT = 25679;
let detectingInterval = null;
let connected = false;
let isWin = false;
importScripts("dic.jsm");

var libadb = (function() {
  let library = null;
  let runCmd = null;

  return {
    loadLib: function(path) {
      debug('Lib path: ' + path);
      if (library) {
        return;
      }
      library = ctypes.open(path);
      runCmd = library.declare('runCmd', ctypes.default_abi, ctypes.char.ptr, ctypes.char.ptr);
    },

    copyAdb: function(oldPath, newPath) {
      if (runCmd) {
        runCmd('cmd.exe /c copy/Y ' + oldPath + '/B ' + newPath + '/B');
      }
      return;
    },

    findDevice: function() {
      var ret = null;
      if (runCmd && ADB_PATH != '') {
        ret = runCmd(ADB_PATH + ' devices');
        if (ret) {
          return ret.readString().trim();
        }
      }
      return ret;
    },

    setupDevice: function(data) {
      var ret = null;
      if (runCmd && ADB_PATH != '') {
        device = data;
        if (device != '') {
          ret = runCmd(ADB_PATH + ' -s ' + device + ' forward tcp:' + LOCAL_PORT + ' tcp:' + REMOTE_PORT);
        } else {
          ret = runCmd(ADB_PATH + ' forward tcp:' + LOCAL_PORT + ' tcp:' + REMOTE_PORT);
        }
        if (ret) {
          return ret.readString().trim();
        }
      }
      return ret;
    },

    startAdbServer: function() {
      var ret = null;
      if (runCmd && ADB_PATH != '') {
        ret = runCmd(ADB_PATH + ' start-server');
        if (ret) {
          return ret.readString().trim();
        }
      }
      return ret;
    },

    killAdbServer: function() {
      var ret = null;
      if (runCmd && ADB_PATH != '') {
        ret = runCmd(ADB_PATH + ' kill-server');
        if (ret) {
          return ret.readString().trim();
        }
      }
      return ret;
    },

    listAdbService: function() {
      var ret = null;
      if (!runCmd) {
        return null;
      }
      var pinfo = runCmd('cmd.exe /c netstat -ano | findstr 5037');
      if (pinfo) {
        pinfo = pinfo.readString().trim();
        var listenString = 'LISTENING';
        var plisten = pinfo.indexOf(listenString);
        if (plisten > 0) {
          var pid = pinfo.substring(plisten + listenString.length, pinfo.length);
          if (pid) {
            pid = pid.split('\r\n');
            ret = runCmd('cmd.exe /c Tasklist | findstr ' + pid[0]);
            if (ret) {
              return ret.readString().trim();
            }
          }
        }
      }
      return ret;
    },

    runLocalCmd: function(cmd) {
      if (!cmd) {
        return null;
      }

      var commands = cmd.split(' ');
      switch (commands[0]) {
      case 'adb':
        if (ADB_PATH) {
          if (device) {
            commands[0] = ADB_PATH + ' -s ' + device;
          }
          let command = commands.join(' ');
          if (isWin) {
            command = UrlEncode(command);
          }
          debug(command);
          let result = runCmd(command);
          if (result) {
            result = result.readString().trim();
          }
          return result;
        }
        return null;
      // |listAdbService| only works on Windows.
      case 'listAdbService':
        return this.listAdbService();
      default:
        let result = runCmd(cmd);
        if (result) {
          result = result.readString().trim();
        }
        return result;
      }
    }
  };
})();

function UrlEncode(str) { /*********改自<a href="http://blog.csdn.net/qiushuiwuhen/article/details/14112">qiushuiwuhen(2002-9-16)</a>********/
  var ch, pos, val, ret = "",
      strSpecial = "!\"#$%&'()*+,/:;<=>?@[\]^`{|}~%";
  for (var i = 0; i < str.length; i++) {
    ch = str.charAt(i);
    val = str.charCodeAt(i);
    if (val >= 0x4e00 && val < 0x9FA5) {
      if ((pos = GBhz.indexOf(ch)) != -1) ret += ("%" + (0xB0 + parseInt(pos / 94)).toString(16) + "%" + (0xA1 + pos % 94).toString(16)).toUpperCase();
    } else if ((pos = GBfh.indexOf(ch)) != -1) {
      ret += ("%" + (0xA1 + parseInt(pos / 94)).toString(16) + "%" + (0xA1 + pos % 94).toString(16)).toUpperCase();
    } else if (strSpecial.indexOf(ch) != -1) {
      ret += "%" + val.toString(16);
    } else if (ch == " ") {
      ret += " ";
    } else {
      ret += ch;
    }
  }
  return ret;
}

onmessage = function(e) {
  debug('Receive message: ' + e.data.cmd);
  let id = e.data.id;
  let cmd = e.data.cmd;
  switch (cmd) {
  case 'findDevice':
    postMessage({
      id: id,
      result: libadb.findDevice()
    });
    break;
  case 'setupDevice':
    let ret = libadb.setupDevice(e.data.device);
    let result = !/error|failed/ig.test(ret);
    postMessage({
      id: id,
      result: result
    });
    break;
  case 'startAdbServer':
    libadb.startAdbServer();
    break;
  case 'killAdbServer':
    libadb.killAdbServer();
    break;
  case 'initAdbService':
    initAdbService(e.data.isWindows, e.data.libPath, e.data.adbPath, e.data.profilePath);
    break;
  case 'checkDevice':
    checkDevice(id, e.data.enable, e.data.isMac, e.data.devices);
    break;
  case 'RunCmd':
    postMessage({
      id: id,
      result: libadb.runLocalCmd(e.data.data)
    });
    break;
  default:
    postMessage({
      id: id,
      message: 'No handle for "' + cmd + '"'
    });
    break;
  }
};

function initAdbService(isWindows, libPath, adbPath, profilePath) {
  // Load adb service library
  adbPath = '"' + adbPath + '"';
  ADB_PATH = adbPath;
  libadb.loadLib(libPath);
  // Set the path of adb executive file
  isWin = isWindows;
  if (isWin) {
    ADB_PATH = '"' + profilePath + '\\ffosadb.exe"';
    // Move adb to profiles, so the addon can be removed when adb is running.
    libadb.copyAdb(adbPath, ADB_PATH);
    libadb.copyAdb(adbPath.replace('adb.exe', 'AdbWinApi.dll'), ADB_PATH.replace('ffosadb.exe', 'AdbWinApi.dll'));
    libadb.copyAdb(adbPath.replace('adb.exe', 'AdbWinUsbApi.dll'), ADB_PATH.replace('ffosadb.exe', 'AdbWinUsbApi.dll'));
  }
}

var m_deviceList = [];

function checkDevice(id, enable, isMac, devices) {
  debug('checkDevice = ' + enable);
  if (detectingInterval) {
    clearInterval(detectingInterval);
    detectingInterval = null;
  }
  if (!enable || !devices || devices.length == 0) {
    postMessage({
      id: id,
      noCallback: 'true'
    });
    return;
  }
  detectingInterval = setInterval(function checkDeviceState() {
    var cmd = 'lsusb';
    if (isMac) {
      cmd = 'system_profiler SPUSBDataType';
    }
    let devicesList = libadb.runLocalCmd(cmd);
    let curDevices = [];
    for (var i = 0; i < devices.length; i++) {
      if (isMac) {
        var vid = devices[i].vendor_id.split(':');
        if (devicesList.indexOf(vid[0]) > 0 && devicesList.indexOf(vid[0]) > devicesList.indexOf(vid[1])) {
          curDevices.push(devices[i]);
        }
      } else {
        if (devicesList.indexOf(devices[i].vendor_id) > 0) {
          curDevices.push(devices[i]);
        }
      }
    }
    var isChanged = false;
    if (m_deviceList.length != curDevices.length) {
      isChanged = true;
    } else {
      for (var i = 0; i < curDevices.length; i++) {
        if (m_deviceList.indexOf(curDevices[i]) < 0) {
          isChanged = true;
          break;
        }
      }
    }
    if (!isChanged) {
      return;
    }
    m_deviceList = curDevices;
    postMessage({
      id: id,
      noDelete: 'true',
      devices: m_deviceList
    });
  }, 500);
}

debug('ADB Service worker is inited.');
