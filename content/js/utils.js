/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

var os = (function() {
  var oscpu = navigator.oscpu.toLowerCase();
  return {
    isWindows: /windows/.test(oscpu),
    isLinux: /linux/.test(oscpu),
    isMac: /mac/.test(oscpu)
  };
})();