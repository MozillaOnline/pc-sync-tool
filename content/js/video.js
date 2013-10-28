var Video = (function() {
  function getListContainer() {
    return $id('video-list-container');
  }

  function init() {
    getListContainer().innerHTML = '';
    $id('empty-video-container').hidden = true;
    getAllVideos();
  }

  function getAllVideos() {
    CMD.Videos.getOldVideosInfo(function(oldVideo) {
      var video = JSON.parse(oldVideo.data);
      if (video.callbackID == 'enumerate') {
        addVideo(video.detail);
        return;
      }
      if (video.callbackID == 'enumerate-done') {
        updateChangedVideos();
      }
    }, function(e) {
      log('Error occurs when getting all videos.');
    });
  }

  function updateChangedVideos() {
    CMD.Videos.getChangedVideosInfo(function(changedVideoInfo) {
      var changedVideo = JSON.parse(changedVideoInfo.data);
      if (changedVideo.callbackID == 'enumerate') {
        addVideo(changedVideo.detail);
        return;
      }
      if (changedVideo.callbackID == 'ondeleted') {
        updateRemovedVideos(changedVideo.detail);
        return;
      }
      if (changedVideo.callbackID == 'enumerate-done') {
        updateUI();
      }
    }, function(e) {
      log('Error occurs when updating changed videos.');
    });
  }

  function addVideo(video) {
    if (!video) {
      return;
    }
    var threadId = parseDate(parseInt(video.date));
    var threadContainer = $id('video-' + threadId);
    var container = getListContainer();
    if (threadContainer) {
      var threadBody = threadContainer.getElementsByTagName('ul')[0];
      threadBody.appendChild(createVideoListItem(video));
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
      id: 'video-' + threadId,
      threadId: threadId
    };

    var div = document.createElement('div');
    div.innerHTML = tmpl('tmpl_video_thread_container', templateData);

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
      }
    }
  }

  function createVideoListItem(video) {
    var listItem = document.createElement('li');
    listItem.dataset.checked = 'false';
    listItem.dataset.videoUrl = video.name;
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
      date: parseDate(parseInt(listItem.dataset.date)),
      size: toSizeInMB(listItem.dataset.size)
    };

    new Tip({
      element: listItem,
      innerHTML: tmpl('tmpl_tip', templateData)
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
    $id('export-videos').dataset.disabled =
      $expr('#video-list-container li[data-checked="true"]').length === 0;
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
      processbar_l10n_id: 'processbar-remove-videos-promot',
      type: 0,
      files: items,
      callback: updateChangedVideos,
      alert_prompt: 'files-cannot-be-removed',
      maxSteps: 50
    });

    dialog.start();
  }

  function importVideos() {
    if (navigator.mozFFOSAssistant.isWifiConnected) {
      new WifiModePromptDialog({
        title_l10n_id: 'import-videos-dialog-header',
        prompt_l10n_id: 'wifi-mode-import-videos-promot'
      });
      return;
    }

    navigator.mozFFOSAssistant.selectMultiFilesFromDisk(function(data) {
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
        processbar_l10n_id: 'processbar-import-videos-promot',
        type: 3,
        files: videos,
        callback: updateChangedVideos,
        alert_prompt: 'files-cannot-be-imported',
        maxSteps: 50
      });

      dialog.start();
    }, {
      title: _('import-video-title'),
      fileType: 'Video'
    });
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-videos').addEventListener('click', function(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }
      selectAllVideos(this.dataset.checked == 'false');
    });

    $id('remove-videos').addEventListener('click', function onclick_removeVideos(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnected) {
        new WifiModePromptDialog({
          title_l10n_id: 'remove-videos-dialog-header',
          prompt_l10n_id: 'wifi-mode-remove-videos-promot'
        });
        return;
      }

      var files = [];
      $expr('#video-list-container li[data-checked="true"]').forEach(function(item) {
        files.push(item.dataset.videoUrl);
      });

      new AlertDialog(_('delete-videos-confirm', {
          n: files.length
        }), true, function() {
        removeVideos(files);
      });
    });

    $id('refresh-videos').addEventListener('click', function onclick_refreshVideos(event) {
      updateChangedVideos();
    });

    $id('import-videos-btn').addEventListener('click', importVideos);

    $id('import-videos').addEventListener('click', importVideos);

    $id('export-videos').addEventListener('click', function onclick_exportVideos(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnected) {
        new WifiModePromptDialog({
          title_l10n_id: 'export-videos-dialog-header',
          prompt_l10n_id: 'wifi-mode-export-videos-promot'
        });
        return;
      }

      var videos = $expr('#video-list-container li[data-checked="true"]');

      if (videos.length == 0) {
        return;
      }

      navigator.mozFFOSAssistant.selectDirectory(function(dir) {
        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-videos-dialog-header',
          processbar_l10n_id: 'processbar-export-videos-promot',
          dir: dir,
          type: 4,
          files: videos,
          alert_prompt: 'files-cannot-be-exported',
          maxSteps: 50
        });

        dialog.start();
      }, {
        title: _('export-video-title'),
        fileType: 'Video'
      });
    });
  });

  return {
    init: init
  };
})();
