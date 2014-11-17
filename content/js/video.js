var Video = (function() {
  function getListContainer() {
    return $id('video-list-container');
  }

  function init() {
    getListContainer().innerHTML = '';
    for (var uname in storageInfoList) {
      if(storageInfoList[uname].totalSpace && storageInfoList[uname].totalSpace > 0) {
        $id('empty-video-container').hidden = true;
        customEventElement.removeEventListener('dataChange', onMessage);
        customEventElement.addEventListener('dataChange', onMessage);
        getAllVideos();
        return;
      }
    }
    updateControls();
  }

  function onMessage(e) {
    if (e.detail.type != 'video') {
      return;
    }
    var msg = e.detail.data;
    switch (msg.callbackID) {
      case 'ondeleted':
        updateRemovedVideos(msg.detail);
        updateUI();
        break;
      case 'enumerate':
        addVideo(msg.detail);
        updateUI();
        break;
      default:
        break;
    }
  }

  function getAllVideos() {
    var getVideosIndex = 0;
    var videosCount = 0;
    var loadingGroupId = animationLoading.start();
    CMD.Videos.getOldVideosInfo(function(oldVideo) {
      var video = JSON.parse(array2String(oldVideo.data));
      if (video.callbackID == 'enumerate') {
        getVideosIndex++;
        addVideo(video.detail);
      }
      else if (video.callbackID == 'enumerate-done') {
        videosCount = video.detail;
      }
      if (getVideosIndex == videosCount) {
        updateChangedVideos();
        updateUI();
        updateControls();
        animationLoading.stop(loadingGroupId);
      }
    }, function onerror() {
      updateControls();
      animationLoading.stop(loadingGroupId);
    });
  }

  function updateChangedVideos() {
    CMD.Videos.getChangedVideosInfo();
  }

  function addVideo(video) {
    if (!video) {
      return;
    }
    var threadId = formatDate(parseInt(video.date));
    var threadContainer = $id('video-' + threadId);
    var container = getListContainer();
    if (threadContainer) {
      var threadBody = threadContainer.getElementsByTagName('ul')[0];
      threadBody.appendChild(createVideoListItem(video));
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
      id: 'video-' + threadId,
      isToday: isToday(new Date(threadId)),
      threadId: threadId
    };

    var div = document.createElement('div');
    div.innerHTML = tmpl('tmpl_video_thread_container', templateData);
    navigator.mozL10n.translate(div);

    var threads = $expr('.video-thread', container);
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
      var videoItems = $expr('li', threadContainer);

      var bChecked = threadContainer.dataset.checked == 'true';
      threadContainer.dataset.checked = !bChecked;
      videoItems.forEach(function(item) {
        item.dataset.checked = !bChecked;
      });

      updateControls();
    };

    var threadBody = $expr('ul', div)[0];
    threadBody.appendChild(createVideoListItem(video));
  }

  function updateRemovedVideos(videos) {
    if (!videos || !videos.length) {
      return;
    }
    for (var i = 0; i < videos.length; i++) {
      var video = $expr('li[data-video-url="' + videos[i] + '"]')[0];
      if (!video) {
        continue;
      }
      var threadBody = video.parentNode;
      threadBody.removeChild(video);
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

  function createVideoListItem(video) {
    var listItem = document.createElement('li');
    listItem.dataset.checked = 'false';
    listItem.dataset.videoUrl = video.name;
    if (video.metadata.preview && video.metadata.preview.filename) {
      listItem.dataset.previewName = video.metadata.preview.filename;
    } else {
      listItem.dataset.previewName = '';
    }
    listItem.dataset.title = video.metadata.title;
    listItem.dataset.date = video.date;
    listItem.dataset.size = video.size;

    var templateData = {
      poster: video.metadata.poster
    };

    listItem.innerHTML = tmpl('tmpl_video_item', templateData);

    listItem.onclick = function onItemClick(e) {
      this.dataset.checked = !(this.dataset.checked == 'true');
      var threadBody = this.parentNode;
      var threadContainer = threadBody.parentNode;
      threadContainer.dataset.checked = $expr('li[data-checked=true]', threadBody).length == threadContainer.dataset.length;
      updateControls();
    };

    templateData = {
      name: listItem.dataset.title,
      date: formatDate(parseInt(listItem.dataset.date)),
      size: toSizeInMB(listItem.dataset.size)
    };

    new Tip({
      element: listItem,
      innerHTML: tmpl('tmpl_tip', templateData),
      container: $id('video-list-container')
    });

    return listItem;
  }

  function updateControls() {
    if ($expr('#video-list-container .video-thread').length == 0) {
      $id('selectAll-videos').dataset.checked = false;
      $id('selectAll-videos').dataset.disabled = true;
    } else {
      $id('selectAll-videos').dataset.checked =
        $expr('#video-list-container li').length === $expr('#video-list-container li[data-checked="true"]').length;
      $id('selectAll-videos').dataset.disabled = false;
    }

    $id('remove-videos').dataset.disabled =
      $expr('#video-list-container li[data-checked="true"]').length === 0;

    $id('import-videos-btn').hidden =
    $id('import-videos').dataset.disabled = !isWifiConnected &&
                                            (!adbHelperInstalled || needUpdateAdbHelper);
    $id('export-videos').dataset.disabled = (!isWifiConnected && (!adbHelperInstalled || needUpdateAdbHelper)) ||
                                            ($expr('#video-list-container li[data-checked="true"]').length === 0);
  }

  function updateUI() {
    $id('empty-video-container').hidden = !!$expr('#video-list-container li').length;
    selectAllVideos(false);
  }

  function selectAllVideos(selected) {
    $expr('#video-list-container .video-thread').forEach(function(thread) {
      thread.dataset.checked = selected;
      $expr('li', thread).forEach(function(item) {
        item.dataset.checked = selected;
      });
    });

    updateControls();
  }

  function removeVideos(files) {
    var items = files || [];
    if (items.length == 0) {
      // TODO: prompt selecting videos to remove...
      return;
    }

    var dialog = new FilesOPDialog({
      title_l10n_id: 'remove-videos-dialog-header',
      processbar_l10n_id: 'processbar-remove-videos-prompt',
      type: 9,
      files: items,
      alert_prompt: 'files-cannot-be-removed',
      maxSteps: 50
    });

    dialog.start();
  }

  function importVideos() {
    if (this.dataset.disabled == 'true') {
      return;
    }

    selectMultiFilesFromDisk(function(data) {
      if (!data) {
        return;
      }
      data = data.substr(0, data.length - 1);
      var videos = data.split(';');

      if (videos.length == 0) {
        return;
      }

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-videos-dialog-header',
        processbar_l10n_id: 'processbar-import-videos-prompt',
        type: 3,
        files: videos,
        callback: updateChangedVideos,
        alert_prompt: 'files-cannot-be-imported',
        maxSteps: 50
      });

      dialog.start();
    }, {
      title: _('import-video-title'),
      fileType: 'VideoTypes'
    });
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-videos').onclick = function(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }
      selectAllVideos(this.dataset.checked == 'false');
    };

    $id('remove-videos').onclick = function onclick_removeVideos(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      var files = [];
      $expr('#video-list-container li[data-checked="true"]').forEach(function(item) {
        var fileInfo = {
          'fileName': item.dataset.videoUrl,
          'previewName': item.dataset.previewName
        };
        files.push(JSON.stringify(fileInfo));
      });

      new AlertDialog({
        message: _('delete-videos-confirm', {
          n: files.length
        }),
        showCancelButton: true,
        okCallback: function() {
          removeVideos(files);
        }
      });
    };

    $id('refresh-videos').onclick = function onclick_refreshVideos(event) {
      updateChangedVideos();
    };

    $id('import-videos-btn').onclick = $id('import-videos').onclick =importVideos;

    $id('export-videos').onclick = function onclick_exportVideos(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      var videos = $expr('#video-list-container li[data-checked="true"]');

      if (videos.length == 0) {
        return;
      }

      selectDirectory(function(dir) {
        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-videos-dialog-header',
          processbar_l10n_id: 'processbar-export-videos-prompt',
          dir: dir,
          type: 4,
          files: videos,
          alert_prompt: 'files-cannot-be-exported',
          maxSteps: 50
        });

        dialog.start();
      }, {
        title: _('export-video-title'),
        fileType: 'VideoTypes'
      });
    };
  });

  return {
    init: init
  };
})();
