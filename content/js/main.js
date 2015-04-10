/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
var chromeWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                         .getInterface(Components.interfaces.nsIWebNavigation)
                         .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                         .rootTreeItem
                         .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                         .getInterface(Components.interfaces.nsIDOMWindow);

var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
var browserEnumerator = wm.getEnumerator("navigator:browser");
var bFound = false;
var bInit = false;

while (browserEnumerator.hasMoreElements()) {
  var browserWin = browserEnumerator.getNext();
  var tabbrowser = browserWin.gBrowser;

  // Check each tab of this browser instance
  var numTabs = tabbrowser.browsers.length;
  for (var index = 0; index < numTabs; index++) {
    var currentBrowser = tabbrowser.getBrowserAtIndex(index);
    if ('about:ffos' == currentBrowser.currentURI.spec) {
      if(!bFound) {
        bFound = true;
      } else {
        browserWin.focus();
        tabbrowser.removeCurrentTab();
      }
    }
  }
}

var Main = (function() {

  function init() {
    $id('lang-settings').onclick = function onclick_langsetting(event) {
      if (!event.target.classList.contains('language-code-button')) {
        return;
      }
      navigator.mozL10n.language.code = event.target.dataset.languageCode;
      $expr('.language-code-button', this).forEach(function(elem) {
        elem.classList.remove('current');
      });
      event.target.classList.add('current');
    };
    console.log(AppManager.init);
    AppManager.init();
  }

  window.addEventListener('unload', function window_onunload(event) {
    window.removeEventListener('unload', window_onunload);
    bInit = false;
  });

  window.addEventListener('localized', function showBody() {
    document.documentElement.lang = navigator.mozL10n.language.code;
    document.documentElement.dir = navigator.mozL10n.language.direction;
    document.body.hidden = false;
    $expr('#lang-settings .language-code-button').forEach(function(label) {
      if (label.dataset.languageCode == navigator.mozL10n.language.code) {
        label.classList.add('current');
      } else {
        label.classList.remove('current');
      }
    });
    if (!bInit) {
      bInit = true;
      init();
    }
  });
})();
