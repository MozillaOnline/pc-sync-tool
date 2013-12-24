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

  function init() {
    playedAudio = new Audio();
    getListContainer().innerHTML = '';
    $id('empty-music-container').hidden = true;
    customEventElement.removeEventListener('dataChange', onMessage);
    customEventElement.addEventListener('dataChange', onMessage);
    getAllMusics();
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
      var music = JSON.parse(oldMusic.data);
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
        animationLoading.stop(loadingGroupId);
      }
    }, function onerror() {
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
      return;
    }

    var templateData = {
      title: music.metadata.title,
      artist: music.metadata.artist,
      album: music.metadata.album,
      type: music.type,
      size: toSizeInMB(music.size),
      id: 'music-play-' + music.name
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
      playMusicBtns[i].addEventListener('click', playMusic);
    }
    return elem;
  }

  function playMusic() {
    var self = this;
    if (!playedAudio) {
      return;
    }
    var playMusicBtns = $expr('#music-list-container .music-play-button');
    for (var i = 0; i < playMusicBtns.length; i++) {
      if (playMusicBtns[i].classList.contains('playing')) {
        playedAudio.pause();
        playedAudio.src = '';
        playMusicBtns[i].classList.remove('playing');
        if (self == playMusicBtns[i]) {
          return;
        } else {
          break;
        }
      }
    }
    var loadingGroupId = animationLoading.start();
    var file = self.id.split('music-play-');
    var path = getCachedDir(['extensions', 'ffosassistant@mozillaonline.com', 'content', MUSIC_CACHE_FOLDER]);
    var cmd = 'adb pull "' + file[1] + '" "' + path + file[1] + '"';
    var cachedUrl = PRE_PATH + MUSIC_CACHE_FOLDER + file[1];
    runCmd(cmd, function() {
      self.classList.add('playing');
      playedAudio.src = cachedUrl;
      playedAudio.play();
      animationLoading.stop(loadingGroupId);
    });
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
    $id('export-musics').dataset.disabled =
      $expr('#music-list-container .music-list-item[data-checked="true"]').length === 0;
    $id('import-musics').dataset.disabled = false;

    if (isWifiConnected) {
      $id('remove-musics').dataset.disabled = true;
      $id('import-musics').dataset.disabled = true;
      $id('export-musics').dataset.disabled = true;
    }
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
      fileType: 'Audio'
    });
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-musics').addEventListener('click', function onclick_selectAll(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }
      selectAllMusics(this.dataset.checked == 'false');
    });

    $id('remove-musics').addEventListener('click', function onclick_removeMusic(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var files = [];
      $expr('#music-list-container .music-list-item[data-checked="true"]').forEach(function(item) {
        files.push(JSON.parse(item.dataset.music).name);
      });

      new AlertDialog({
        message: _('delete-musics-confirm', {
          n: files.length
        }),
        showCancelButton: true,
        callback: function() {
          removeMusics(files);
        }
      });
    });

    $id('refresh-musics').addEventListener('click', function onclick_refreshMusics(event) {
      updateChangedMusics();
    });

    $id('import-musics-btn').addEventListener('click', importMusics);
    $id('import-musics').addEventListener('click', importMusics);

    $id('export-musics').addEventListener('click', function(event) {
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
        fileType: 'Audio'
      });
    });
  });

  return {
    init: init
  };
})();
