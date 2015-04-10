var StorageView = (function() {
  var storageViewId = "storage-view";
  var storageInfoList = {};
  var connectLoadingId = -1;
  function init() {
  }
  function show() {
    $id(storageViewId).hidden = false;
    if (ConnectView.isWifiConnected) {
      $id('device-image-connection').classList.add('wifiConnection');
    } else {
      $id('device-image-connection').classList.remove('wifiConnection');
    }
    _getStorageInfo();
  }

  function hide() {
    $id(storageViewId).hidden = true;
  }

  /**
   * Format storage size.
   */
  function _formatStorage(sizeInBytes) {
    var sizeInMega = sizeInBytes / 1024 / 1024;

    if (sizeInMega > 900) {
      var sizeInGiga = sizeInMega / 1024;
      return sizeInGiga.toFixed(2) + 'G';
    }

    return sizeInMega.toFixed(2) + 'M';
  }

  function _getStorageInfo() {
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.device_getstorageInfo,
        datalength: 0
      },
      dataArray: null
    };
    StorageView.connectLoadingId = AppManager.animationLoadingDialog.startAnimation();
    SocketManager.send(sendData, null);

    document.addEventListener(sendData.cmd.id, function _onData(evt) {
      document.removeEventListener(sendData.cmd.id, _onData);
      if (StorageView.connectLoadingId >= 0) {
        AppManager.animationLoadingDialog.stopAnimation(StorageView.connectLoadingId);
        StorageView.connectLoadingId = -1;
      }
      if (!evt.detail) {
        return;
      }

      var dataJSON = JSON.parse(array2String(evt.detail));
      var container = $id('summary-infos');
      container.innerHTML = '';
      storageInfoList = {};
      var templateDataList = [];
      for (var uname in dataJSON) {
        var templateData = {
          headerId: uname + '-header',
          bodyId: uname + '-body',
          storageName: uname,
          displayName: uname,
          storageNumber: '',
          storageUsed: '',
          pictureUsed: '',
          musicUsed: '',
          videoUsed: ''
        };
        var total = 0;
        if (dataJSON[uname].info && dataJSON[uname].info.usedSpace != null && dataJSON[uname].info.freeSpace != null)
          total = dataJSON[uname].info.usedSpace + dataJSON[uname].info.freeSpace;
        var storageInfo = {
          path: '/storage/sdcard' + dataJSON[uname].id + '/',
          totalSpace: total,
          freeSpace: dataJSON[uname].info.freeSpace ? dataJSON[uname].info.freeSpace : 0
        };
        storageInfoList[uname] = storageInfo;
        if (total > 0) {
          templateData.storageUsed = Math.floor(dataJSON[uname].info.usedSpace / total * 100) + '%';
          templateData.storageNumber = _formatStorage(dataJSON[uname].info.usedSpace) + '/' +
                                       _formatStorage(total) + ' ' + templateData.storageUsed;
          templateData.pictureUsed = Math.floor(dataJSON[uname].info.pictures / total * 100) + '%';
          templateData.musicUsed = Math.floor(dataJSON[uname].info.music / total * 100) + '%';
          templateData.videoUsed = Math.floor(dataJSON[uname].info.videos / total * 100) + '%';
        } else {
          templateData.storageNumber = '0.00M/0.00M';
          templateData.storageUsed = '0%';
          templateData.pictureUsed = '0%';
          templateData.musicUsed = '0%';
          templateData.videoUsed = '0%';
        }
        templateDataList.push(templateData);
      }

      for (var i=0; i<templateDataList.length ;i++) {
        var templateData = templateDataList[i];
        if (templateDataList.length == 1) {
          for (var name in storageInfoList) {
            storageInfoList[name].path = '/sdcard/';
          }
          templateData.displayName = 'sdcard';
        } else if (templateDataList.length > 1) {
          if (i == 0) {
            templateData.displayName = 'internal';
          } else {
            templateData.displayName = 'sdcard';
          }
          if (templateDataList.length == 2 && storageInfoList['sdcard'] && storageInfoList['sdcard0']) { //Dolphin is special
            storageInfoList['sdcard'].path = '/storage/emulated/';
            storageInfoList['sdcard'].freeSpace = 0;
            storageInfoList['sdcard0'].path = '/storage/sdcard0/';
          } else if (templateDataList.length == 2 && storageInfoList['sdcard'] && storageInfoList['sdcard1']) { //flame v1.4 is special
            storageInfoList['sdcard'].path = '/storage/sdcard/';
            storageInfoList['sdcard1'].path = '/storage/sdcard1/';
          }
        }
        var elem = document.createElement('div');
        elem.innerHTML = tmpl('tmpl_storage_summary', templateData);
        container.appendChild(elem);
        navigator.mozL10n.translate(elem);
        $id(templateData.headerId).dataset.body = templateData.bodyId;
        $id(templateData.headerId).onmouseover = function() {
          var body = $id(this.dataset.body);
          _summaryHeadMouseOver(this, body);
        };
        $id(templateData.headerId).onmouseout = _summaryHeadMouseout;
        $id(templateData.headerId).onclick = function() {
          var body = $id(this.dataset.body);
          _summaryHeadClick(this, body);
        };
      }
    });
  }

  function _summaryHeadMouseOver(self, body) {
    if (body.classList.contains('hiddenElement')) {
      self.classList.add('expanded');
      self.classList.remove('collapsed');
    } else {
      self.classList.add('collapsed');
      self.classList.remove('expanded');
    }
  }

  function _summaryHeadMouseout() {
    this.classList.remove('collapsed');
    this.classList.remove('expanded');
  }

  function _summaryHeadClick(self, body) {
    body.classList.toggle('hiddenElement');
    if (body.classList.contains('hiddenElement')) {
      self.classList.remove('collapsed');
      self.classList.add('expanded');
    } else {
      self.classList.remove('expanded');
      self.classList.add('collapsed');
    }
  }

  return {
    storageInfoList: storageInfoList,
    init: init,
    show: show,
    hide: hide
  };
})();