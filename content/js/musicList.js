var MusicList = (function() {
  var playedAudio = null;
  const MUSIC_CACHE_FOLDER = 'music_tmp';
  const PRE_PATH = 'chrome://ffosassistant/content/';
  function getListContainer() {
    return $id('music-list-container');
  }

  function extractFileName(filePath) {
    var index = filePath.lastIndexOf('/');
    if (index < 0) {
      return _('Unkown');
    }
    filePath = filePath.substr(index + 1);

    index = filePath.lastIndexOf('.');
    if (index < 0) {
      return filePath;
    }
    return filePath.substr(0, index);
  }

  function extractFileExtension(fileName) {
    var index = fileName.lastIndexOf('.');
    if (index < 0) {
      return '';
    }
    return fileName.substr(index + 1);
  }

  function resetView() {
    if (!playedAudio) {
      return;
    }
    playedAudio.pause();
    playedAudio.src = '';
    playedAudio.removeAttribute('src');
  }

  function init() {
    getListContainer().innerHTML = '';
    playedAudio = new Audio();
    for (var uname in storageInfoList) {
      if(storageInfoList[uname].totalSpace && storageInfoList[uname].totalSpace > 0) {
        $id('empty-music-container').hidden = true;
        customEventElement.removeEventListener('dataChange', onMessage);
        customEventElement.addEventListener('dataChange', onMessage);
        getAllMusics();
        return;
      }
    }
    updateControls();
  }

  function onMessage(e) {
    if (e.detail.type != 'music') {
      return;
    }
    var msg = e.detail.data;
    switch (msg.callbackID) {
      case 'ondeleted':
        if (!msg.detail || !msg.detail.length || msg.detail.length < 1) {
          return;
        }
        for (var index = 0; index < msg.detail.length; index++) {
          var item = $id(msg.detail[index]);
          if (item) {
            getListContainer().removeChild(item);
          }
        }
        updateUI();
        break;
      case 'enumerate':
        getListContainer().appendChild(createMusicListItem(msg.detail));
        updateUI();
        break;
      default:
        break;
    }
  }

  function getAllMusics() {
    var getMusicsIndex = 0;
    var musicsCount = 0;
    var loadingGroupId = animationLoading.start();
    CMD.Musics.getOldMusicsInfo(function(oldMusic) {
      var music = JSON.parse(array2String(oldMusic.data));
      if (music.callbackID == 'enumerate') {
        getMusicsIndex++;
        getListContainer().appendChild(createMusicListItem(music.detail));
      }
      else if (music.callbackID == 'enumerate-done') {
        musicsCount = music.detail;
      }
      if (getMusicsIndex == musicsCount) {
        updateChangedMusics();
        updateUI();
        updateControls();
        animationLoading.stop(loadingGroupId);
      }
    }, function onerror() {
      updateControls();
      animationLoading.stop(loadingGroupId);
    });
  }

  function updateChangedMusics() {
    CMD.Musics.getChangedMusicsInfo();
  }

  function updateUI() {
    $id('empty-music-container').hidden = !!$expr('#music-list-container .music-list-item').length;
    selectAllMusics(false);
  }

  function createMusicListItem(music) {
    if (!music) {
      return null;
    }
    var musicType;
    if (music.type.indexOf('/') < 0) {
      musicType = music.type;
    } else {
      musicType = music.type.substring(music.type.indexOf('/') + 1);
    }
    var templateData = {
      title: music.metadata.title,
      artist: music.metadata.artist,
      album: music.metadata.album,
      type: musicType,
      size: toSizeInMB(music.size),
      id: 'music-play-' + music.name,
      canPlay: true
    };
    var elem = document.createElement('div');
    elem.classList.add('music-header');
    elem.classList.add('music-list-item');
    elem.innerHTML = tmpl('tmpl_music_item', templateData);

    elem.dataset.music = JSON.stringify(music);
    elem.dataset.name = extractFileName(music.name);
    elem.dataset.type = extractFileExtension(music.name);
    elem.dataset.id = music.name;
    elem.dataset.checked = false;
    elem.id = music.name;
    elem.onclick = function onclick_list(event) {
      var target = event.target;
      if (target instanceof HTMLLabelElement) {
        elem.dataset.checked = elem.dataset.checked == 'false';
        updateControls();
      } else {
        musicItemClicked(elem);
      }
    };
    var playMusicBtns = $expr('.music-play-button', elem);
    for (var i = 0; i < playMusicBtns.length; i++) {
      playMusicBtns[i].onclick = playMusic;
    }
    return elem;
  }

  function stopMusic() {
    if (!playedAudio) {
      return;
    }
    var playMusicBtns = $expr('#music-list-container .music-play-button');
    for (var i = 0; i < playMusicBtns.length; i++) {
      if (!playMusicBtns[i].classList.contains('playing')) {
        continue;
      }
      playedAudio.pause();
      playedAudio.src = '';
      playedAudio.removeAttribute('src');
      playMusicBtns[i].classList.remove('playing');
      break;
    }
  }

  function playMusic() {
    var self = this;
    function onsuccess () {
      self.classList.add('playing');
      playedAudio.src = cachedUrl;
      playedAudio.onended = function() {
        playedAudio.pause();
        playedAudio.src = '';
        playedAudio.removeAttribute('src');
        self.classList.remove('playing');
      }
      playedAudio.onerror = function() {
        playedAudio.src = '';
        playedAudio.removeAttribute('src');
        self.classList.remove('playing');
        new AlertDialog({
          message: _('operation-failed'),
          showCancelButton: false
        });
      }
      playedAudio.play();
      animationLoading.stop(loadingGroupId);
    };
    function onerror () {
      new AlertDialog({
        message: _('operation-failed'),
        showCancelButton: false
      });
      animationLoading.stop(loadingGroupId);
    };
    if (!playedAudio) {
      return;
    }
    var isPlay = self.classList.contains('playing');
    stopMusic();
    if (isPlay) {
      return;
    }
    var file = JSON.parse(self.parentNode.parentNode.dataset.music).name;
    var index = file.lastIndexOf('/');
    var name = file.substr(index);
    name = decodeURIComponent(name);
    var path = getCachedDir(['extensions', 'ffosassistant@mozillaonline.com', 'content', CACHE_FOLDER]);
    var cachedUrl = PRE_PATH + CACHE_FOLDER + name;
    var aFrom = file;
    var reg = /^\/([a-z0-9]+)\//;
    var result = aFrom.match(reg);
    var storage = result[1];
    if (!storageInfoList[storage] || !storageInfoList[storage].path) {
      return;
    }
    var loadingGroupId = animationLoading.start();
    if (isWifiConnected) {
      var fileName = aFrom.substring(aFrom.indexOf(storage) + storage.length + 1);
      var fileInfo = {
        storageName: storage,
        fileName: fileName
      };
      CMD.Files.filePull(JSON.stringify(fileInfo), null, function (message) {
        OS.File.writeAtomic(path + name, message.data, {}).then(
          function onSuccess(number) {
            onsuccess();
          },
          function onFailure(reason) {
            onerror();
          }
        );
      }, onerror);
    } else {
      if (!device) {
        return;
      }
      aFrom = aFrom.replace(reg, storageInfoList[storage].path);
      device.pull(aFrom, path + name).then(onsuccess, onerror);
    }
  }

  function updateControls() {
    if ($expr('#music-list-container .music-list-item').length == 0) {
      $id('selectAll-musics').dataset.checked = false;
      $id('selectAll-musics').dataset.disabled = true;
    } else {
      $id('selectAll-musics').dataset.checked =
        $expr('#music-list-container .music-list-item').length === $expr('#music-list-container .music-list-item[data-checked="true"]').length;
      $id('selectAll-musics').dataset.disabled = false;
    }
    $id('remove-musics').dataset.disabled =
      $expr('#music-list-container .music-list-item[data-checked="true"]').length === 0;

    $id('import-musics-btn').hidden =
    $id('import-musics').dataset.disabled = !isWifiConnected &&
                                            (!adbHelperInstalled || needUpdateAdbHelper);
    $id('export-musics').dataset.disabled = (!isWifiConnected && (!adbHelperInstalled || needUpdateAdbHelper)) ||
                                            ($expr('#music-list-container .music-list-item[data-checked="true"]').length === 0);
  }

  function musicItemClicked(elem) {
    $expr('#music-list-container .music-list-item[data-checked="true"]').forEach(function(item) {
      if (item == elem) {
        return;
      }
      item.dataset.checked = false;
    });

    elem.dataset.checked = true;
    updateControls();
  }

  function selectAllMusics(select) {
    $expr('#music-list-container .music-list-item').forEach(function(item) {
      item.dataset.checked = select;
    });
    updateControls();
  }

  function removeMusics(files) {
    var items = files || [];
    if (items.length == 0) {
      // TODO: prompt selecting musics to remove...
      return;
    }

    var dialog = new FilesOPDialog({
      title_l10n_id: 'remove-musics-dialog-header',
      processbar_l10n_id: 'processbar-remove-musics-prompt',
      type: 8,
      files: items,
      alert_prompt: 'files-cannot-be-removed',
      maxSteps: 50
    });

    dialog.start();
  }

  function importMusics() {
    if (this.dataset.disabled == 'true') {
      return;
    }

    selectMultiFilesFromDisk(function(data) {
      if (!data) {
        return;
      }
      data = data.substr(0, data.length - 1);
      var musics = data.split(';');

      if (musics.length == 0) {
        return;
      }

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-musics-dialog-header',
        processbar_l10n_id: 'processbar-import-musics-prompt',
        type: 1,
        files: musics,
        callback: updateChangedMusics,
        alert_prompt: 'files-cannot-be-imported',
        maxSteps: 50
      });

      dialog.start();
    }, {
      title: _('import-music-title'),
      fileType: 'AudioTypes'
    });
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-musics').onclick = function onclick_selectAll(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }
      selectAllMusics(this.dataset.checked == 'false');
    };

    $id('remove-musics').onclick = function onclick_removeMusic(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var files = [];
      var isPlay = false;
      $expr('#music-list-container .music-list-item[data-checked="true"]').forEach(function(item) {
        var name = JSON.parse(item.dataset.music).name;
        files.push(name);
        var cachedUrl = PRE_PATH + MUSIC_CACHE_FOLDER + name;
        if (playedAudio && decodeURI(playedAudio.src) == cachedUrl) {
          isPlay = true;
        }
      });
      new AlertDialog({
        message: _('delete-musics-confirm', {
          n: files.length
        }),
        showCancelButton: true,
        okCallback: function() {
          if (playedAudio && isPlay) {
            playedAudio.pause();
            playedAudio.src = '';
            playedAudio.removeAttribute('src');
          }
          removeMusics(files);
        }
      });
    };

    $id('refresh-musics').onclick = function onclick_refreshMusics(event) {
      updateChangedMusics();
    };

    $id('import-musics-btn').onclick = $id('import-musics').onclick = importMusics;

    $id('export-musics').onclick = function(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      var musics = $expr('#music-list-container .music-list-item[data-checked="true"]');

      if (musics.length == 0) {
        return;
      }

      selectDirectory(function(dir) {
        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-musics-dialog-header',
          processbar_l10n_id: 'processbar-export-musics-prompt',
          dir: dir,
          type: 2,
          files: musics,
          alert_prompt: 'files-cannot-be-exported',
          maxSteps: 50
        });

        dialog.start();
      }, {
        title: _('export-music-title'),
        fileType: 'AudioTypes'
      });
    };
  });

  return {
    init: init,
    resetView: resetView
  };
})();
