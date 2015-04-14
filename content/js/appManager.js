/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var CHANGE_SELECTED_VIEW = "change-selected-view";
var DISCONNECT_CURRENT_DEVICE = "disconnect-current-device";
var AppManager = (function() {

  const PRE_PATH = 'chrome://ffosassistant/content/';
  const CACHE_FOLDER = 'media_tmp';
  var viewList = [{tabId: "side-view", viewHandler: ConnectView},
                  {tabId: "storage-tab", viewHandler: StorageView},
                  {tabId: "contact-tab", viewHandler: ContactView},
                  {tabId: "picture-tab", viewHandler: PictureView},
                  {tabId: "music-tab", viewHandler: MusicView},
                  {tabId: "video-tab", viewHandler: VideoView}];
  var animationLoadingDialog;

  function init() {
    AppManager.animationLoadingDialog = new AnimationLoadingDialog();
    document.addEventListener(CHANGE_SELECTED_VIEW, function(e) {
      _setSectedView(e.detail);
    });

    for (var i=0; i<viewList.length; i++) {
      viewList[i].viewHandler.init();
      if (viewList[i].tabId == "side-view")
        continue;
      $id(viewList[i].tabId).onclick = function(event) {
        _setSectedView(this.id);
      };
    }

    $id('disconnect-button').onclick = function onclick_disconnect(event) {
      var evt = new CustomEvent(DISCONNECT_CURRENT_DEVICE, {});
      document.dispatchEvent(evt);
    };
    _setSectedView("side-view");
  }

  function _setSectedView(tabId) {
    for (var i=0; i<viewList.length; i++) {
      if (viewList[i].tabId == tabId) {
        if (tabId == "side-view") {
          $id(viewList[i].tabId).hidden = true;
        } else {
          $id(viewList[0].tabId).hidden = false;
          $id(viewList[i].tabId).classList.add('selected');
        }
        viewList[i].viewHandler.show();
      } else {
        $id(viewList[i].tabId).classList.remove('selected');
        viewList[i].viewHandler.hide();
      }
    }
  }

  return {
    init: init,
    animationLoadingDialog: animationLoadingDialog,
    CACHE_FOLDER: CACHE_FOLDER,
    PRE_PATH: PRE_PATH
  };
})();

