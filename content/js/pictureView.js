var PictureView = (function() {
  var pictureViewId = "picture-view";
  var isFirstShow = true;
  var imageViewer;
  function init() {
    PictureView.isFirstShow = true;
    document.addEventListener(AppManager.CHANGE_SELECTED_VIEW, function(e) {
      if (e.detail != "side-view") {
        return;
      }
      PictureView.isFirstShow = true;
      if (PictureView.imageViewer) {
        PictureView.imageViewer.close();
        PictureView.imageViewer = null;
      }
    });
    document.addEventListener(CMD_ID.listen_picture_create, function(e) {
      var picture = JSON.parse(array2String(e.detail));
      _addPicture(picture);
      _updateUI();
    });
    document.addEventListener(CMD_ID.listen_picture_delete, function(e) {
      if (!e.detail) {
        return;
      }
      var picture = JSON.parse(array2String(e.detail));
      _updateRemovedPictures(picture);
      _updateUI();
    });
    $id('selectAll-pictures').onclick = function(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      _selectAllPictures(this.dataset.checked == "false");
    };

    $id('remove-pictures').onclick = function onclick_removePictures(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      var files = [];
      $expr('#picture-list-container li[data-checked="true"]').forEach(function(item) {
        files.push(item.dataset.picUrl);
      });

      new AlertDialog({
        message: _('delete-pictures-confirm', {
          n: files.length
        }),
        showCancelButton: true,
        okCallback: function() {
          _removePictures(files);
        }
      });
    };

    $id('refresh-pictures').onclick = function onclick_refreshPictures(event) {
      _updateChangedPictures();
    };

    $id('import-pictures-btn').onclick = $id('import-pictures').onclick = _importPictures;

    $id('export-pictures').onclick = function onclick_exportPictures(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      var pictures = $expr('#picture-list-container li[data-checked="true"]');

      if (pictures.length == 0) {
        return;
      }

      selectDirectory(function(dir) {
        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-pictures-dialog-header',
          processbar_l10n_id: 'processbar-export-pictures-prompt',
          dir: dir,
          type: 5,
          files: pictures,
          alert_prompt: 'files-cannot-be-exported',
          maxSteps: 50
        });

        dialog.start();
      }, {
        title: _('export-picture-title'),
        fileType: 'Image'
      });
    };
  }

  function show() {
    $id(pictureViewId).hidden = false;
    if (PictureView.isFirstShow) {
      _getListContainer().innerHTML = '';
      for (var uname in StorageView.storageInfoList) {
        if(StorageView.storageInfoList[uname].totalSpace && StorageView.storageInfoList[uname].totalSpace > 0) {
          $id('empty-picture-container').hidden = true;
          _getAllPictures();
          _updateChangedPictures();
          PictureView.isFirstShow = false;
          return;
        }
      }
    }
    _updateControls();
  }

  function hide() {
    $id(pictureViewId).hidden = true;
  }

  function deletePicture(fileName, onSuccess, onError) {
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.picture_delete,
        datalength: 0
      },
      dataArray: string2Array(fileName)
    };
    SocketManager.send(sendData);

    document.addEventListener(sendData.cmd.id, function _onData(evt) {
      document.removeEventListener(sendData.cmd.id, _onData);
      if (!evt.detail || array2Int(evt.detail) != RS_OK) {
        onError();
        return;
      }
      onSuccess();
    });
  }

  function _getListContainer() {
    return $id('picture-list-container');
  }

  function _getAllPictures() {
    var getPicturesIndex = 0;
    var picturesCount = 0;

    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.picture_getOld,
        datalength: 0
      },
      dataArray: null
    };
    AppManager.animationLoadingDialog.startAnimation();
    SocketManager.send(sendData);

    document.addEventListener(sendData.cmd.id, function _onData(evt) {
      if (!evt.detail) {
        document.removeEventListener(sendData.cmd.id, _onData);
        AppManager.animationLoadingDialog.stopAnimation();
        _updateControls();
        return;
      }
      var recvLength = evt.detail.byteLength !== undefined ? evt.detail.byteLength : evt.detail.length;
      if (recvLength == 4) {
        document.removeEventListener(sendData.cmd.id, _onData);
        _updateChangedPictures();
        _updateUI();
        _updateControls();
        AppManager.animationLoadingDialog.stopAnimation();
        picturesCount = getPicturesIndex;
        return;
      }
      var picture = JSON.parse(array2String(evt.detail));
      getPicturesIndex++;
      _addPicture(picture);
    });
  }

  function _updateChangedPictures() {
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.picture_getChanged,
        datalength: 0
      },
      dataArray: null
    };
    SocketManager.send(sendData);
  }

  function _addPicture(picture) {
    if (!picture) {
      return;
    }

    var threadId = formatDate(parseInt(picture.date));
    var threadContainer = $id('pic-' + threadId);
    var container = _getListContainer();

    if (threadContainer) {
      var threadBody = threadContainer.getElementsByTagName('ul')[0];
      threadBody.appendChild(_createPictureListItem(picture));
      threadContainer.dataset.length = 1 + parseInt(threadContainer.dataset.length);
      var title = threadContainer.getElementsByTagName('label')[0];
      var templateData = {
        threadId: threadId,
        isToday: isToday(new Date(threadId)),
        length: threadContainer.dataset.length
      };
      title.innerHTML = tmpl('tmpl_thread_title', templateData);
      navigator.mozL10n.translate(title);
      return;
    }
    var templateData = {
      id: 'pic-' + threadId,
      isToday: isToday(new Date(threadId)),
      threadId: threadId
    };

    var div = document.createElement('div');
    div.innerHTML = tmpl('tmpl_pic_thread_container', templateData);
    navigator.mozL10n.translate(div);
    var threads = $expr('.picture-thread', container);
    if (threads.length == 0) {
      container.appendChild(div);
    } else {
      var dt = new Date(threadId);
      var index = 0;
      for (; index < threads.length; index++) {
        var date = new Date(threads[index].dataset.threadId);
        if (dt > date) {
          container.insertBefore(div, threads[index].parentNode);
          break;
        }
      }
      if (index == threads.length) {
        container.appendChild(div);
      }
    }
    var title = $expr('label', div)[0];

    title.onclick = function onSelectThread(e) {
      var target = e.target;

      if (!(target instanceof HTMLLabelElement)) {
        return;
      }

      var threadContainer = this.parentNode.parentNode;
      var picItems = $expr('li', threadContainer);

      var bChecked = threadContainer.dataset.checked == 'true';
      threadContainer.dataset.checked = !bChecked;

      picItems.forEach(function(item) {
        item.dataset.checked = !bChecked;
      });

      _updateControls();
    };

    var threadBody = $expr('ul', div)[0];
    threadBody.appendChild(_createPictureListItem(picture));
  }

  function _updateRemovedPictures(pictures) {
    if (!pictures || !pictures.length) {
      return;
    }
    for (var i = 0; i < pictures.length; i++) {
      var pic = $expr('li[data-pic-url="' + pictures[i] + '"]')[0];
      if (!pic) {
        continue;
      }
      var threadBody = pic.parentNode;
      threadBody.removeChild(pic);
      var thread = threadBody.parentNode.parentNode;
      if ($expr('li', threadBody).length == 0) {
        _getListContainer().removeChild(thread);
      } else {
        var headerNode = threadBody.parentNode;
        headerNode.dataset.length = parseInt(headerNode.dataset.length) - 1;
        var numberNode = headerNode.getElementsByTagName('span')[1];
        numberNode.textContent = ' (' + headerNode.dataset.length + ')';
      }
    }
  }

  function _createPictureListItem(picture) {
    var listItem = document.createElement('li');
    listItem.dataset.checked = 'false';
    listItem.dataset.picUrl = picture.name;
    listItem.dataset.title = getFileName(picture.name);
    listItem.dataset.date = picture.date;
    listItem.dataset.size = picture.size;

    var templateData = {
      thumbnail: picture.metadata.thumbnail
    };

    listItem.innerHTML = tmpl('tmpl_pic_item', templateData);

    listItem.onclick = function item_click(e) {
      this.dataset.checked = !(this.dataset.checked == 'true');
      var threadBody = this.parentNode;
      var threadContainer = threadBody.parentNode;
      threadContainer.dataset.checked = $expr('li[data-checked=true]', threadBody).length == threadContainer.dataset.length;
      _updateControls();
    };

    listItem.ondblclick = function(e) {
      $id('tip').hidden = true;
      var picList = $expr('li', _getListContainer());
      var currentIndex = 0;
      for (; currentIndex < picList.length; currentIndex++) {
        if (picList[currentIndex].dataset.picUrl == this.dataset.picUrl) {
          break;
        }
      }

      PictureView.imageViewer = new ImageViewer({
        count: picList.length,
        currentIndex: currentIndex,
        getPictureAt: _getPictureAt
      });
    };

    templateData = {
      name: listItem.dataset.title,
      date: formatDate(parseInt(listItem.dataset.date)),
      size: toSizeInMB(listItem.dataset.size)
    };

    new Tip({
      element: listItem,
      innerHTML: tmpl('tmpl_tip', templateData),
      container: $id('picture-list-container')
    });

    return listItem;
  }

  function _updateControls() {
    if ($expr('#picture-list-container .picture-thread').length == 0) {
      $id('selectAll-pictures').dataset.checked = false;
      $id('selectAll-pictures').dataset.disabled = true;
    } else {
      $id('selectAll-pictures').dataset.checked =
        $expr('#picture-list-container li').length === $expr('#picture-list-container li[data-checked="true"]').length;
      $id('selectAll-pictures').dataset.disabled = false;
    }

    $id('remove-pictures').dataset.disabled =
      $expr('#picture-list-container li[data-checked="true"]').length === 0;

    $id('import-pictures-btn').hidden =
    $id('import-pictures').dataset.disabled = !ConnectView.isWifiConnected &&
                                              (!ConnectView.adbHelperInstalled || ConnectView.needUpdateAdbHelper);

    $id('export-pictures').dataset.disabled = (!ConnectView.isWifiConnected && (!ConnectView.adbHelperInstalled || ConnectView.needUpdateAdbHelper)) ||
                                              ($expr('#picture-list-container li[data-checked="true"]').length === 0);
  }

  function _updateUI() {
    $id('empty-picture-container').hidden = !!$expr('#picture-list-container li').length;
    _selectAllPictures(false);
  }

  function _selectAllPictures(selected) {
    $expr('#picture-list-container .picture-thread').forEach(function(thread) {
      thread.dataset.checked = selected;
      $expr('li', thread).forEach(function(item) {
        item.dataset.checked = selected;
      });
    });

    _updateControls();
  }

  function _removePictures(files) {
    var items = files || [];
    if (items.length <= 0) {
      return;
    }

    var dialog = new FilesOPDialog({
      title_l10n_id: 'remove-pictures-dialog-header',
      processbar_l10n_id: 'processbar-remove-pictures-prompt',
      type: 7,
      files: items,
      alert_prompt: 'files-cannot-be-removed',
      maxSteps: 50
    });

    dialog.start();
  }

  function _importPictures() {
    if (this.dataset.disabled == 'true') {
      return;
    }

    selectMultiFilesFromDisk(function(data) {
      if (!data) {
        return;
      }
      data = data.substr(0, data.length - 1);
      var pictures = data.split(';');

      if (pictures.length == 0) {
        return;
      }

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-pictures-dialog-header',
        processbar_l10n_id: 'processbar-import-pictures-prompt',
        type: 6,
        files: pictures,
        callback: _updateChangedPictures,
        alert_prompt: 'files-cannot-be-imported',
        maxSteps: 50
      });

      dialog.start();
    }, {
      title: _('import-picture-title'),
      fileType: 'Image'
    });
  }

  function _getPictureAt(index, callback) {
    var picList = $expr('li', _getListContainer());
    function onsuccess () {
      callback(true);
      AppManager.animationLoadingDialog.stopAnimation();
    };
    function onerror () {
      new AlertDialog({
        message: _('operation-failed'),
        showCancelButton: false
      });
      AppManager.animationLoadingDialog.stopAnimation();
    };
    function oncancel () {
      AppManager.animationLoadingDialog.stopAnimation();
    };
    if (picList[index]) {
      var aFrom = picList[index].dataset.picUrl;
      AppManager.animationLoadingDialog.startAnimation();
      StorageView.pullFile(aFrom, AppManager.cache_folder + '/temp_pic', onsuccess, onerror, oncancel);
    }
  }

  return {
    init: init,
    show: show,
    hide: hide,
    deletePicture: deletePicture,
    isFirstShow: isFirstShow,
    imageViewer: imageViewer
  };
})();
