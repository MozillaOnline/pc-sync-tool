var Gallery = (function() {
  const GALLERY_CACHE_FOLDER = 'gallery_tmp';
  const PRE_PATH = 'chrome://ffosassistant/content/';

  function getListContainer() {
    return $id('picture-list-container');
  }

  function init() {
    getListContainer().innerHTML = '';
    $id('empty-picture-container').hidden = true;
    customEventElement.removeEventListener('dataChange', onMessage);
    customEventElement.addEventListener('dataChange', onMessage);
    getAllPictures();
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
    CMD.Pictures.getOldPicturesInfo(function(oldPicture) {
      var picture = JSON.parse(oldPicture.data);
      if (picture.callbackID == 'enumerate') {
        getPicturesIndex++;
        addPicture(picture.detail);
      }
      else if (picture.callbackID == 'enumerate-done') {
        picturesCount = picture.detail;
      }
      if (getPicturesIndex == picturesCount) {
        updateChangedPictures();
        updateUI();
        animationLoading.stop(loadingGroupId);
      }
    }, function onerror() {
      animationLoading.stop(loadingGroupId);
    });
  }

  function updateChangedPictures() {
    CMD.Pictures.getChangedPicturesInfo();
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
        threadId : threadId,
        length: threadContainer.dataset.length
      };
      title.innerHTML = tmpl('tmpl_thread_title', templateData);
      return;
    }
    var templateData = {
      id: 'pic-' + threadId,
      threadId: threadId
    };

    var div = document.createElement('div');
    div.innerHTML = tmpl('tmpl_pic_thread_container', templateData);
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
    if (picList[index]) {
      // TODO: check if picture has been cached already
      var path = getGalleryCachedDir(['extensions', 'ffosassistant@mozillaonline.com', 'content', GALLERY_CACHE_FOLDER]);
      var cmd = 'adb pull "' + picList[index].dataset.picUrl + '" "' + path + picList[index].dataset.picUrl + '"';
      var cachedUrl = PRE_PATH + GALLERY_CACHE_FOLDER + picList[index].dataset.picUrl;
      var req = runCmd(cmd);

      req.onsuccess = function on_success(result) {
        callback(true, cachedUrl);
      };
      req.onerror = function on_error(e) {
        callback(false);
      };
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
    $id('export-pictures').dataset.disabled =
      $expr('#picture-list-container li[data-checked="true"]').length === 0;
    $id('import-pictures').dataset.disabled = false;

    if (isWifiConnected) {
      $id('remove-pictures').dataset.disabled = true;
      $id('import-pictures').dataset.disabled = true;
      $id('export-pictures').dataset.disabled = true;
    }
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
    $id('selectAll-pictures').addEventListener('click', function(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      selectAllPictures(this.dataset.checked == "false");
    });

    $id('remove-pictures').addEventListener('click', function onclick_removePictures(event) {
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
        callback: function() {
          removePictures(files);
        }
      });
    });

    $id('refresh-pictures').addEventListener('click', function onclick_refreshPictures(event) {
      updateChangedPictures();
    });

    $id('import-pictures-btn').addEventListener('click', importPictures);

    $id('import-pictures').addEventListener('click', importPictures);

    $id('export-pictures').addEventListener('click', function onclick_exportPictures(event) {
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
    });
  });

  return {
    init: init
  };
})();
