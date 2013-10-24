var MusicList = (function() {
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
    getListContainer().innerHTML = '';
    $id('empty-music-container').hidden = true;
    getAllMusics();
  }

  function getAllMusics() {
    CMD.Musics.getOldMusicsInfo(function(oldMusic) {
      var music = JSON.parse(oldMusic.data);
      if (music.callbackID == 'enumerate') {
        getListContainer().appendChild(createMusicListItem(music.detail));
        return;
      }
      if (music.callbackID == 'enumerate-done') {
        updateChangedMusics();
      }
    }, function onerror_getOldMusicsInfo(e) {
      log('Error occurs when getting all musics.');
    });
  }

  function updateChangedMusics() {
    CMD.Musics.getChangedMusicsInfo(function(changedMusicInfo) {
      var changedMusic = JSON.parse(changedMusicInfo.data);
      if (changedMusic.callbackID == 'enumerate') {
        getListContainer().appendChild(createMusicListItem(changedMusic.detail));
        return;
      }
      if (changedMusic.callbackID == 'ondeleted') {
        if (!changedMusic.detail || !changedMusic.detail.length || changedMusic.detail.length < 1) {
          return;
        }
        for (var index = 0; index < changedMusic.detail.length; index++) {
          var item = $id(changedMusic.detail[index]);
          if (item) {
            getListContainer().removeChild(item);
          }
        }
        return;
      }
      if (changedMusic.callbackID == 'onscanend') {
        updateUI();
        return;
      }
    }, function onerror_getChangedMusics(e) {
      log('Error occurs when updating changed musics.');
    })
  }

  function updateUI() {
    $id('empty-music-container').hidden = !$expr('#music-list-container .music-list-item').length == 0;
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
      size: toSizeInMB(music.size)
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
    return elem;
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

  /**
   * Remove musics
   */
  function removeMusics(files) {
    var items = files || [];
    if (items.length == 0) {
      // TODO: prompt selecting musics to remove...
      return;
    }

    var maxSteps = 50;
    var pb = new ProcessBar({
      sectionsNumber: items.length,
      stepsPerSection: maxSteps
    });

    var dialog = new FilesOPDialog({
      title_l10n_id: 'remove-musics-dialog-header',
      processbar_l10n_id: 'processbar-remove-musics-promot',
      processbar: pb,
      type: 0,
      files: items,
      callback: updateMusicsList,
      alert_prompt: 'files-cannot-be-removed',
      max_steps: maxSteps * 0.9
    });

    dialog.start();
  }

  function updateMusicsList(FilestoBeRemoved) {
    FilestoBeRemoved.forEach(function(item) {
      var music = $id(item);
      $id('music-list-container').removeChild(music);
    });
    updateUI();
  }

  function importMusics() {
    if (navigator.mozFFOSAssistant.isWifiConnected) {
      new WifiModePromptDialog({
        title_l10n_id: 'import-musics-dialog-header',
        prompt_l10n_id: 'wifi-mode-import-musics-promot'
      });
      return;
    }

    navigator.mozFFOSAssistant.selectMultiFilesFromDisk(function(data) {
      if (!data) {
        return;
      }
      data = data.substr(0, data.length - 1);
      var musics = data.split(';');

      if (musics.length == 0) {
        return;
      }

      var maxSteps = 50;
      var pb = new ProcessBar({
        sectionsNumber: musics.length,
        stepsPerSection: maxSteps
      });

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-musics-dialog-header',
        processbar_l10n_id: 'processbar-import-musics-promot',
        processbar: pb,
        type: 1,
        files: musics,
        callback: updateChangedMusics,
        alert_prompt: 'files-cannot-be-imported',
        max_steps: maxSteps * 0.9
      });

      dialog.start();
      updateUI();
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

      if (navigator.mozFFOSAssistant.isWifiConnected) {
        new WifiModePromptDialog({
          title_l10n_id: 'remove-musics-dialog-header',
          prompt_l10n_id: 'wifi-mode-remove-musics-promot'
        });
        return;
      }

      var files = [];
      $expr('#music-list-container .music-list-item[data-checked="true"]').forEach(function(item) {
        files.push(JSON.parse(item.dataset.music).name);
      });

      new AlertDialog(_('delete-musics-confirm', {
          n: files.length
        }), true, function() {
        removeMusics(files);
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

      if (navigator.mozFFOSAssistant.isWifiConnected ) {
        new WifiModePromptDialog({
          title_l10n_id: 'export-musics-dialog-header',
          prompt_l10n_id: 'wifi-mode-export-musics-promot'
        });
        return;
      }

      var musics = $expr('#music-list-container .music-list-item[data-checked="true"]');

      if (musics.length == 0) {
        return;
      }

      navigator.mozFFOSAssistant.selectDirectory(function(dir) {
        var maxSteps = 50;
        var pb = new ProcessBar({
          sectionsNumber: musics.length,
          stepsPerSection: maxSteps
        });

        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-musics-dialog-header',
          processbar_l10n_id: 'processbar-export-musics-promot',
          processbar: pb,
          dir: dir,
          type: 2,
          files: musics,
          alert_prompt: 'files-cannot-be-exported',
          max_steps: maxSteps * 0.9
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
