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

  function pullFile(fileInfo, destName, successCallback, errorCallback) {
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.file_pull,
        datalength: 0
      },
      dataArray: string2Array(fileInfo)
    };
    SocketManager.send(sendData);

    document.addEventListener(sendData.cmd.id, function _onData(evt) {
      document.removeEventListener(sendData.cmd.id, _onData);
      if (!evt.detail) {
        errorCallback();
        return;
      }
      var recvLength = evt.detail.byteLength !== undefined ? evt.detail.byteLength : evt.detail.length;
      if (recvLength == 4) {
        errorCallback();
        return;
      }
      OS.File.writeAtomic(destName, evt.detail, {}).then(
        function onSuccess(number) {
          successCallback();
        },
        function onFailure(reason) {
          errorCallback();
        }
      );
    });
  }

  function pushFile(fileInfo, array, successCallback, errorCallback) {
    var fileInfoArray = string2Array(fileInfo);
    var fileInfoArrayLen = fileInfoArray.byteLength !== undefined ? fileInfoArray.byteLength : fileInfoArray.length;
    var arrayLen = array.byteLength !== undefined ? array.byteLength : array.length;
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.file_push,
        datalength: 0
      },
      dataArray: arraycat(arraycat(int2Array(fileInfoArrayLen), fileInfoArray), 
        arraycat(int2Array(arrayLen), array))
    };
    SocketManager.send(sendData);

    document.addEventListener(sendData.cmd.id, function _onData(evt) {
      document.removeEventListener(sendData.cmd.id, _onData);
      if (!evt.detail || array2Int(evt.detail) != RS_OK) {
        errorCallback();
        return;
      }
      successCallback();
    });
  }

  function getStorageFree(onCallback) {
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.device_getstorageFree,
        datalength: 0
      },
      dataArray: null
    };
    SocketManager.send(sendData);

    document.addEventListener(sendData.cmd.id, function _onData(evt) {
      document.removeEventListener(sendData.cmd.id, _onData);
      onCallback(evt);
    });
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
    SocketManager.send(sendData);

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
      StorageView.storageInfoList = {};
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
        StorageView.storageInfoList[uname] = storageInfo;
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
          for (var name in StorageView.storageInfoList) {
            StorageView.storageInfoList[name].path = '/sdcard/';
          }
          templateData.displayName = 'sdcard';
        } else if (templateDataList.length > 1) {
          if (i == 0) {
            templateData.displayName = 'internal';
          } else {
            templateData.displayName = 'sdcard';
          }
          if (templateDataList.length == 2 && StorageView.storageInfoList['sdcard'] && StorageView.storageInfoList['sdcard0']) { //Dolphin is special
            StorageView.storageInfoList['sdcard'].path = '/storage/emulated/';
            StorageView.storageInfoList['sdcard'].freeSpace = 0;
            StorageView.storageInfoList['sdcard0'].path = '/storage/sdcard0/';
          } else if (templateDataList.length == 2 && StorageView.storageInfoList['sdcard'] && StorageView.storageInfoList['sdcard1']) { //flame v1.4 is special
            StorageView.storageInfoList['sdcard'].path = '/storage/sdcard/';
            StorageView.storageInfoList['sdcard1'].path = '/storage/sdcard1/';
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
    connectLoadingId: connectLoadingId,
    init: init,
    show: show,
    hide: hide,
    pullFile: pullFile,
    pushFile: pushFile,
    getStorageFree: getStorageFree
  };
})();