/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var module = {};
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(module, 'utils', 'resource://ffosassistant/utils.jsm');
XPCOMUtils.defineLazyModuleGetter(module, 'ADBService', 'resource://ffosassistant/ADBService.jsm');

function $id(id) {
  return document.getElementById(id);
}

function $expr(expr, elem) {
  elem = elem ? elem : document;
  var nodeList = elem.querySelectorAll(expr);
  var size = nodeList.length;
  var list = [];

  for (var i = 0; i < size; i++) {
    list.push(nodeList[i]);
  }

  return list;
}

/**
 * Get l10n
 */

function _(key, args, fallback) {
  return navigator.mozL10n.get(key, args, fallback);
}

(function() {
  function extend(destination, source) {
    for (var property in source)
    destination[property] = source[property];
    return destination;
  }

  extend(window, {
    extend: extend
  });
})();

function emptyFunction() {

}

function log(msg) {
  console.log(msg);
}

/**
 * Execute the async functions
 * The functions must call the given callback functions when executed.
 */

function syncExecuteAsyncFuncs(asyncFuncs, onFinished) {
  if (asyncFuncs.length == 0) {
    onFinished();
  }

  function execAsyncFunc(func) {
    func(function async_callback() {
      if (asyncFuncs.length > 0) {
        execAsyncFunc(asyncFuncs.shift());
      } else {
        onFinished();
      }
    });
  }

  execAsyncFuncs(asyncFuncs.shift());
}

function removeFromArray(objOrFunc, array) {
  var newArray = [];

  array.forEach(function(i) {
    if (typeof objOrFunc === 'function' && objOrFunc(i)) {
      return;
    } else if (i === objOrFunc) {
      return;
    }
    newArray.push(i);
  });

  return newArray;
}

function convertToOutputFileName(path) {
  var arrayPath = path.split('/');
  var length = arrayPath.length;

  if (length <= 1) {
    return path;
  } else {
    return arrayPath[length - 2] + '_' + arrayPath[length - 1];
  }
}

function getFileName(path) {
  var splitChar = '/';
  if (isWindows()) {
    splitChar = '\\';
  }
  var arrayPath = path.split(splitChar);
  return arrayPath[arrayPath.length - 1];
}

function toSizeInMB(sizeInByte) {
  if (isNaN(sizeInByte)) {
    return 0.00;
  } else {
    return parseInt(sizeInByte / 1024 / 10.24) / 100;
  }
}

function formatDate(timestamp) {
  var dt = new Date(timestamp);
  var year = dt.getFullYear();
  var month = dt.getMonth() + 1;
  var date = dt.getDate();

  var strDate = year + '-';
  if (month <= 9) {
    strDate += '0';
  }
  strDate += month + '-';
  if (date <= 9) {
    strDate += '0';
  }
  strDate += date;
  return strDate;
}

function formatTime(timestamp) {
  var dt = new Date(timestamp);
  var hour = dt.getHours();
  var minutes = dt.getMinutes();
  var time = '';
  if (hour < 10) {
    time += '0';
  }
  time += hour + ':';
  if (minutes < 10) {
    time += '0';
  }
  time += minutes;
  return time;
}

function isToday(date) {
  var today = new Date();
  var curYear = today.getFullYear();
  var curMonth = today.getMonth();
  var curDate = today.getDate();

  if (curYear == date.getFullYear() && curMonth == date.getMonth() && curDate == date.getDate()) {
    return true;
  } else {
    return false;
  }
}

function getCachedDir(pathArray) {
  return module.utils.getCachedDir(pathArray);
}

function runCmd(cmd, callback) {
  return module.ADBService.runCmd(cmd, callback);
}

function isWindows() {
  return module.utils.isWindows();
}


function selectDirectory(callback, options) {
  module.utils.selectDirectory(callback, options);
}

function saveToDisk(content, callback, options) {
  module.utils.saveToDisk(content, callback, options);
}

function readFromDisk(callback) {
  module.utils.readFromDisk(callback);
}

function selectMultiFilesFromDisk(callback, options) {
  module.utils.selectMultiFilesFromDisk(callback, options);
}

function getFileSize(path) {
  return module.utils.getFileSize(path);
}

function getAdbHelperInfo(callback) {
  return module.utils.getAdbHelperInfo(callback);
}

function checkAdbHelperVersion(ver, minVer) {
  return module.utils.checkAdbHelperVersion(ver, minVer);
}
