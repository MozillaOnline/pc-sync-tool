var MusicView = (function() {
  var musicViewId = "music-view";
  var playedAudio = null;
  var isFirstShow = true;
  function init() {
    MusicView.isFirstShow = true;
    document.addEventListener(AppManager.CHANGE_SELECTED_VIEW, function(e) {
      if (e.detail != "side-view") {
        return;
      }
      MusicView.isFirstShow = true;
      if (!MusicView.playedAudio) {
        return;
      }
      MusicView.playedAudio.pause();
      MusicView.playedAudio.src = '';
      MusicView.playedAudio.removeAttribute('src');
      MusicView.playedAudio = null;
    });
    $id('selectAll-musics').onclick = function onclick_selectAll(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }
      _selectAllMusics(this.dataset.checked == 'false');
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
        var tempMusic = FileUtils.getFile("TmpD", ["ffos-assistant", "temp_music"]);
        var tempMusicUrl = Services.io.newFileURI(tempMusic);
        if (MusicView.playedAudio && decodeURI(MusicView.playedAudio.src) == tempMusicUrl.spec) {
          isPlay = true;
        }
      });
      new AlertDialog({
        message: _('delete-musics-confirm', {
          n: files.length
        }),
        showCancelButton: true,
        okCallback: function() {
          if (MusicView.playedAudio && isPlay) {
            MusicView.playedAudio.pause();
            MusicView.playedAudio.src = '';
            MusicView.playedAudio.removeAttribute('src');
          }
          _removeMusics(files);
        }
      });
    };

    $id('refresh-musics').onclick = function onclick_refreshMusics(event) {
      _updateChangedMusics();
    };

    $id('import-musics-btn').onclick = $id('import-musics').onclick = _importMusics;

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
    document.addEventListener(CMD_ID.listen_music_create, function(e) {
      var music = JSON.parse(array2String(e.detail));
      _getListContainer().appendChild(_createMusicListItem(music));
      _updateUI();
    });
    document.addEventListener(CMD_ID.listen_music_delete, function(e) {
      if (!e.detail) {
        return;
      }
      var music = JSON.parse(array2String(e.detail));
      for (var index = 0; index < music.length; index++) {
        var item = $id(music[index]);
        if (item) {
          _getListContainer().removeChild(item);
        }
      }
      _updateUI();
    });
  }

  function show() {
    $id(musicViewId).hidden = false;
    if (MusicView.isFirstShow) {
      _getListContainer().innerHTML = '';
      MusicView.playedAudio = new Audio();
      for (var uname in StorageView.storageInfoList) {
        if(StorageView.storageInfoList[uname].totalSpace &&
           StorageView.storageInfoList[uname].totalSpace > 0) {
          $id('empty-music-container').hidden = true;
          _getAllMusics();
          _updateChangedMusics();
          MusicView.isFirstShow = false;
          return;
        }
      }
    }
    _updateControls();
  }

  function hide() {
    $id(musicViewId).hidden = true;
    if (!MusicView.playedAudio) {
      return;
    }
    MusicView.playedAudio.pause();
    MusicView.playedAudio.src = '';
    MusicView.playedAudio.removeAttribute('src');
  }

  function deleteMusic(fileName, onSuccess, onError) {
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.music_delete,
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
    return $id('music-list-container');
  }

  function _extractFileName(filePath) {
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

  function _extractFileExtension(fileName) {
    var index = fileName.lastIndexOf('.');
    if (index < 0) {
      return '';
    }
    return fileName.substr(index + 1);
  }

  function _updateUI() {
    $id('empty-music-container').hidden = !!$expr('#music-list-container .music-list-item').length;
    _selectAllMusics(false);
  }

  function _stopMusic() {
    if (!MusicView.playedAudio) {
      return;
    }
    var playMusicBtns = $expr('#music-list-container .music-play-button');
    for (var i = 0; i < playMusicBtns.length; i++) {
      if (!playMusicBtns[i].classList.contains('playing')) {
        continue;
      }
      MusicView.playedAudio.pause();
      MusicView.playedAudio.src = '';
      MusicView.playedAudio.removeAttribute('src');
      playMusicBtns[i].classList.remove('playing');
      break;
    }
  }

  function _playMusic() {
    var self = this;
    function onsuccess () {
      self.classList.add('playing');
      var tempMusic = FileUtils.getFile("TmpD", ["ffos-assistant", "temp_music"]);
      var tempMusicUrl = Services.io.newFileURI(tempMusic);
      MusicView.playedAudio.src = tempMusicUrl.spec;
      MusicView.playedAudio.onended = function() {
        MusicView.playedAudio.pause();
        MusicView.playedAudio.src = '';
        MusicView.playedAudio.removeAttribute('src');
        self.classList.remove('playing');
      }
      MusicView.playedAudio.onerror = function() {
        MusicView.playedAudio.src = '';
        MusicView.playedAudio.removeAttribute('src');
        self.classList.remove('playing');
        new AlertDialog({
          message: _('operation-failed'),
          showCancelButton: false
        });
      }
      MusicView.playedAudio.play();
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
    if (!MusicView.playedAudio) {
      return;
    }
    var isPlay = self.classList.contains('playing');
    _stopMusic();
    if (isPlay) {
      return;
    }
    var file = JSON.parse(self.parentNode.parentNode.dataset.music).name;
    AppManager.animationLoadingDialog.startAnimation();
    StorageView.pullFile(file, AppManager.cache_folder + '/temp_music', onsuccess, onerror, oncancel);
  }

  function _updateControls() {
    if ($expr('#music-list-container .music-list-item').length == 0) {
      $id('selectAll-musics').dataset.checked = false;
      $id('selectAll-musics').dataset.disabled = true;
    } else {
      $id('selectAll-musics').dataset.checked =
        $expr('#music-list-container .music-list-item').length ===
          $expr('#music-list-container .music-list-item[data-checked="true"]').length;
      $id('selectAll-musics').dataset.disabled = false;
    }
    $id('remove-musics').dataset.disabled =
      $expr('#music-list-container .music-list-item[data-checked="true"]').length === 0;

    $id('import-musics-btn').hidden =
    $id('import-musics').dataset.disabled = !ConnectView.isWifiConnected &&
                                            (!ConnectView.adbHelperInstalled || ConnectView.needUpdateAdbHelper);
    $id('export-musics').dataset.disabled = (!ConnectView.isWifiConnected && (!ConnectView.adbHelperInstalled || ConnectView.needUpdateAdbHelper)) ||
                                            ($expr('#music-list-container .music-list-item[data-checked="true"]').length === 0);
  }

  function _musicItemClicked(elem) {
    $expr('#music-list-container .music-list-item[data-checked="true"]').forEach(function(item) {
      if (item == elem) {
        return;
      }
      item.dataset.checked = false;
    });

    elem.dataset.checked = true;
    _updateControls();
  }

  function _selectAllMusics(select) {
    $expr('#music-list-container .music-list-item').forEach(function(item) {
      item.dataset.checked = select;
    });
    _updateControls();
  }

  function _removeMusics(files) {
    var items = files || [];
    if (items.length == 0) {
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

  function _getAllMusics() {
    var getMusicsIndex = 0;
    var musicsCount = 0;

    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.music_getOld,
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
        _updateChangedMusics();
        _updateUI();
        _updateControls();
        AppManager.animationLoadingDialog.stopAnimation();
        musicsCount = getMusicsIndex;
        return;
      }
      var music = JSON.parse(array2String(evt.detail));
      getMusicsIndex++;
      _getListContainer().appendChild(_createMusicListItem(music));
    });
  }

  function _updateChangedMusics() {
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.music_getChanged,
        datalength: 0
      },
      dataArray: null
    };
    SocketManager.send(sendData);
  }

  function _createMusicListItem(music) {
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
    elem.dataset.name = _extractFileName(music.name);
    elem.dataset.type = _extractFileExtension(music.name);
    elem.dataset.id = music.name;
    elem.dataset.checked = false;
    elem.id = music.name;
    elem.onclick = function onclick_list(event) {
      var target = event.target;
      if (target instanceof HTMLLabelElement) {
        elem.dataset.checked = elem.dataset.checked == 'false';
        _updateControls();
      } else {
        _musicItemClicked(elem);
      }
    };
    var playMusicBtns = $expr('.music-play-button', elem);
    for (var i = 0; i < playMusicBtns.length; i++) {
      playMusicBtns[i].onclick = _playMusic;
    }
    return elem;
  }

  function _importMusics() {
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
        callback: _updateChangedMusics,
        alert_prompt: 'files-cannot-be-imported',
        maxSteps: 50
      });

      dialog.start();
    }, {
      title: _('import-music-title'),
      fileType: 'AudioTypes'
    });
  }

  return {
    init: init,
    show: show,
    hide: hide,
    deleteMusic: deleteMusic,
    isFirstShow: isFirstShow,
    playedAudio: playedAudio
  };
})();
