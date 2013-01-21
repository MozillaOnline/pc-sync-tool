/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

(function() {
  let DEBUG = 1;
  if (DEBUG)
    debug = function (s) { dump("-*- ADBService FF Overlay: " + s + "\n"); };
  else
    debug = function (s) { };

  function init() {
    // Import ADB Service module
    debug('Import adbService module');
    try {
      Components.utils.import('resource://ffosassistant/adbServiceParent.jsm');
    } catch (e) {
      debug('Error occurs when load module: ' + e);
    }
  }

  window.addEventListener('load', function wnd_onload(e) {
    window.removeEventListener('load', wnd_onload);
    window.setTimeout(init, 1000);
  });
})();

