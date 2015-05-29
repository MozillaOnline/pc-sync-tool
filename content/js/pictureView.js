var PictureView = (function() {
  var pictureViewId = "picture-view";
  function init() {
  }
  function show() {
    $id(pictureViewId).hidden = false;
  }

  function hide() {
    $id(pictureViewId).hidden = true;
  }


  return {
    init: init,
    show: show,
    hide: hide
  };
})();
/*
var Gallery = (function() {
  const PRE_PATH = 'chrome://ffosassistant/content/';

  function getListContainer() {
    return $id('picture-list-container');
  }

  function init() {
    getListContainer().innerHTML = '';
    for (var uname in storageInfoList) {
      if(storageInfoList[uname].totalSpace && storageInfoList[uname].totalSpace > 0) {
        $id('empty-picture-container').hidden = true;
        customEventElement.removeEventListener('dataChange', onMessage);
        customEventElement.addEventListener('dataChange', onMessage);
        getAllPictures();
        return;
      }
    }
    updateControls();
  }

  function onMessage(e) {
    if (e.detail.type != 'picture') {
      return;
    }
    var msg = e.detail.data;
    switch (msg.callbackID) {
      case 'ondeleted':
        updateRemovedPictures(msg.detail);
        updateUI();
        break;
      case 'enumerate':
        addPicture(msg.detail);
        updateUI();
        break;
      default:
        break;
    }
  }

  function getAllPictures() {
    var getPicturesIndex = 0;
    var picturesCount = 0;
    var loadingGroupId = animationLoading.start();
    var cmd = CMD.Pictures.getOldPicturesInfo();
    socketsManager.send(cmd);
    document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
      var result = evt.detail.result;
      if (result != RS_OK && result !== RS_MIDDLE) {
        updateControls();
        animationLoading.stop(loadingGroupId);
        return;
      }
      var picture = JSON.parse(array2String(evt.detail.data));
      if (picture.callbackID == 'enumerate') {
        getPicturesIndex++;
        addPicture(picture.detail);
      }
      else if (picture.callbackID == 'enumerate-done') {
        picturesCount = picture.detail;
      }
      if (getPicturesIndex == picturesCount) {
        document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
        updateChangedPictures();
        updateUI();
        updateControls();
        animationLoading.stop(loadingGroupId);
      }
    });
  }

  function updateChangedPictures() {
    var cmd = CMD.Pictures.getChangedPicturesInfo();
    socketsManager.send(cmd);
  }

  function addPicture(picture) {
    if (!picture) {
      return;
    }

    var threadId = formatDate(parseInt(picture.date));
    var threadContainer = $id('pic-' + threadId);
    var container = getListContainer();

    if (threadContainer) {
      var threadBody = threadContainer.getElementsByTagName('ul')[0];
      threadBody.appendChild(createPictureListItem(picture));
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

      updateControls();
    };

    var threadBody = $expr('ul', div)[0];
    threadBody.appendChild(createPictureListItem(picture));
  }

  function updateRemovedPictures(pictures) {
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
        getListContainer().removeChild(thread);
      } else {
        var headerNode = threadBody.parentNode;
        headerNode.dataset.length = parseInt(headerNode.dataset.length) - 1;
        var numberNode = headerNode.getElementsByTagName('span')[1];
        numberNode.textContent = ' (' + headerNode.dataset.length + ')';
      }
    }
  }

  function createPictureListItem(picture) {
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
      updateControls();
    };

    listItem.ondblclick = function(e) {
      $id('tip').hidden = true;
      var picList = $expr('li', getListContainer());
      var currentIndex = 0;
      for (; currentIndex < picList.length; currentIndex++) {
        if (picList[currentIndex].dataset.picUrl == this.dataset.picUrl) {
          break;
        }
      }

      new ImageViewer({
        count: picList.length,
        currentIndex: currentIndex,
        getPictureAt: getPictureAt
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

  function getPictureAt(index, callback) {
    var picList = $expr('li', getListContainer());
    function onsuccess () {
      callback(true, cachedUrl);
      animationLoading.stop(loadingGroupId);
    };
    function onerror () {
      new AlertDialog({
        message: _('operation-failed'),
        showCancelButton: false
      });
      animationLoading.stop(loadingGroupId);
    };
    if (picList[index]) {
      // TODO: check if picture has been cached already
      var name = picList[index].dataset.picUrl.substr(picList[index].dataset.picUrl.lastIndexOf('/'));

      var path = getCachedDir(['extensions', 'ffosassistant@mozillaonline.com', 'content', CACHE_FOLDER]);
      name = decodeURIComponent(name);
      var cachedUrl = PRE_PATH + CACHE_FOLDER + name;
      var aFrom = picList[index].dataset.picUrl;
      var reg = /^\/([a-z0-9]+)\//;
      var result = aFrom.match(reg);
      var storage = result[1];
      if (!storageInfoList[storage] || !storageInfoList[storage].path) {
        return;
      }
      if (isWifiConnected) {
        var fileName = aFrom.substring(aFrom.indexOf(storage) + storage.length + 1);
        var fileInfo = {
          storageName: storage,
          fileName: fileName
        };
        var cmd = CMD.Files.filePull(JSON.stringify(fileInfo), null);
        socketsManager.send(cmd);
        document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
          document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
          var result = evt.detail.result;
          if (result != RS_OK) {
            onerror();
            return;
          }
          OS.File.writeAtomic(path + name, message.data, {}).then(
            function onSuccess(number) {
              onsuccess();
            },
            function onFailure(reason) {
              onerror();
            }
          );
        });
      } else {
        if (!device) {
          return;
        }
        aFrom = aFrom.replace(reg, storageInfoList[storage].path);
        device.pull(aFrom, path + name).then(onsuccess, onerror);
      }
    }
  }

  function updateControls() {
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

    //$id('remove-pictures').dataset.disabled = isWifiConnected;
    $id('import-pictures-btn').hidden =
    $id('import-pictures').dataset.disabled = !isWifiConnected &&
                                              (!adbHelperInstalled || needUpdateAdbHelper);

    $id('export-pictures').dataset.disabled = (!isWifiConnected && (!adbHelperInstalled || needUpdateAdbHelper)) ||
                                              ($expr('#picture-list-container li[data-checked="true"]').length === 0);
  }

  function updateUI() {
    $id('empty-picture-container').hidden = !!$expr('#picture-list-container li').length;
    selectAllPictures(false);
  }

  function selectAllPictures(selected) {
    $expr('#picture-list-container .picture-thread').forEach(function(thread) {
      thread.dataset.checked = selected;
      $expr('li', thread).forEach(function(item) {
        item.dataset.checked = selected;
      });
    });

    updateControls();
  }

  function removePictures(files) {
    var items = files || [];
    if (items.length <= 0) {
      // TODO: prompt selecting pictures to remove...
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

  function importPictures() {
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
        callback: updateChangedPictures,
        alert_prompt: 'files-cannot-be-imported',
        maxSteps: 50
      });

      dialog.start();
    }, {
      title: _('import-picture-title'),
      fileType: 'Image'
    });
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-pictures').onclick = function(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      selectAllPictures(this.dataset.checked == "false");
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
          removePictures(files);
        }
      });
    };

    $id('refresh-pictures').onclick = function onclick_refreshPictures(event) {
      updateChangedPictures();
    };

    $id('import-pictures-btn').onclick = $id('import-pictures').onclick = importPictures;

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
  });

  return {
    init: init
  };
})();
*/