var MusicList = (function() {
  function getListContainer() {
    return $id('music-list-container');
  }

  function retriveName(str) {
    var index = str.lastIndexOf('/');
    if (index < 0) {
      return 'Unkown';
    }
    str = str.substr(index + 1, str.length);

    index = str.lastIndexOf('.');
    if (index < 0) {
      return str;
    }
    return str.substr(0, index);
  }

  function retriveType(type) {
    var index = type.lastIndexOf('/');
    if (index < 0) {
      return type;
    }
    return type.substr(index + 1, type.length);
  }

  function retriveExtension(str) {
    var index = str.lastIndexOf('.');
    if (index < 0) {
      return '';
    }
    return str.substr(index + 1, str.length);
  }

  function init() {
    getListContainer().innerHTML = '';
    $id('empty-music-container').hidden = true;
  }

  function addMusic(music) {
    if (!music) {
      return;
    }
    var container = getListContainer();
    var listItem = _createMusicListItem(music);
    container.appendChild(listItem);
  }

  function removeMusic(music) {
    if (!music || !music.length || music.length < 1) {
      return;
    }
    for (var index = 0; index < music.length; index++) {
      var item = $id(music[index]);
      if (item) {
        getListContainer().removeChild(item);
      }
    }
  }

  function updateUI() {
    var musicList = $expr('#music-list-container .music-list-item');
    if (musicList.length == 0) {
      $id('empty-music-container').hidden = false;
    } else {
      $id('empty-music-container').hidden = true;
      for (var index = 0; index < musicList.length; index++) {
        if (index % 2) {
          if (musicList[index].classList.contains('even')) {
            musicList[index].classList.remove('even');
          }
          musicList[index].classList.add('odd');
        } else {
          if (musicList[index].classList.contains('odd')) {
            musicList[index].classList.remove('odd');
          }
          musicList[index].classList.add('even');
        }
      }
    }
  }

  function _createMusicListItem(music) {
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
    elem.dataset.name = retriveName(music.name);
    elem.dataset.type = retriveExtension(music.name);
    elem.dataset.id = music.name;
    elem.dataset.checked = false;
    elem.onclick = function onclick_messages_list(event) {
      var target = event.target;
      if (target instanceof HTMLLabelElement) {
        toggleMusicItem(elem);
      } else {
        musicItemClicked(elem);
      }
    };
    elem.id = music.name;
    return elem;
  }

  function toggleMusicItem(elem) {
    var item = $expr('label', elem)[0];
    if (!item) {
      return;
    }
    var select = false;
    if (item.dataset.checked == 'false') {
      select = true;
    }
    elem.dataset.checked = item.dataset.checked = select;
    opStateChanged();
  }

  function opStateChanged() {
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
    $expr('#music-list-container .music-list-item[data-checked="true"]').forEach(function(e) {
      if (e != elem) {
        e.dataset.checked = false;
        var item = $expr('label', e)[0];
        if (item) {
          item.dataset.checked = false;
        }
      }
    });

    item = $expr('label', elem)[0];
    if (item) {
      item.dataset.checked = true;
    }
    elem.dataset.checked = true;
    if ($expr('#music-list-container .music-list-item').length === 1) {
      $id('selectAll-musics').dataset.checked = true;
    } else {
      $id('selectAll-musics').dataset.checked = false;
    }
    $id('remove-musics').dataset.disabled = false;
    $id('export-musics').dataset.disabled = false;
  }

  function selectAllMusics(select) {
    $expr('#music-list-container .music-list-item').forEach(function(item) {
      selectMusicItem(item, select);
    });

    opStateChanged();
  }

  function selectMusicItem(elem, selected) {
    var item = $expr('label', elem)[0];
    if (!item) {
      return;
    }
    item.dataset.checked = elem.dataset.checked = selected;
  }

  /**
   * Get music object by give music id
   */

  function getMusic(id) {
    var musicItem = $id('music-' + id);
    if (!musicItem) {
      throw 'No music item is found!';
    }
    return JSON.parse(musicItem.dataset.music);
  }

  /**
   * Remove musics
   */

  function removeMusics(files) {
    var items = files || [];
    if (items.length <= 0) {
      //TODO: prompt select musics to be removed...
      return;
    }

    var filesToBeRemoved = [];
    var filesCanNotBeRemoved = [];

    var fileIndex = 0;
    var oldFileIndex = 0;
    var steps = 0;

    var pb = new ProcessBar({
      sectionsNumber: items.length,
      stepsPerSection: 50
    });

    var dialog = new FilesOPDialog({
      title_l10n_id: 'remove-musics-dialog-header',
      processbar_l10n_id: 'processbar-remove-musics-promot',
      processbar: pb
    });

    var filesIndicator = $id('files-indicator');
    filesIndicator.innerHTML = '0/' + items.length;

    var bTimer = false;

    setTimeout(function doRemoveMusic() {
      var cmd = 'adb shell rm "' + items[fileIndex] + '"';
      var req = navigator.mozFFOSAssistant.runCmd(cmd);
      if (!bTimer) {
        bTimer = true;
        var timer = setInterval(function() {
          if (oldFileIndex == fileIndex) {
            if (steps < 50) {
              steps++;
              pb.moveForward();
            }
          } else {
            oldFileIndex = fileIndex;
            steps = 0;
          }
        }, 100);
      }

      req.onsuccess = function(e) {
        filesToBeRemoved.push(items[fileIndex]);
        fileIndex++;
        pb.finish(filesToBeRemoved.length);
        filesIndicator.innerHTML = filesToBeRemoved.length + '/' + items.length;

        if (fileIndex == items.length) {
          clearInterval(timer);
          pb.finish(items.length);
          dialog.closeAll();

          //updating UI after removing musics
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            new AlertDialog(filesCanNotBeRemoved.length + " files can't be removed");
          }

          updateMusicsList(filesToBeRemoved);
          opStateChanged();
        } else {
          doRemoveMusic();
        }
      };

      req.onerror = function(e) {
        filesCanNotBeRemoved.push(items[fileIndex]);
        fileIndex++;
        pb.finish(filesToBeRemoved.length);
        filesIndicator.innerHTML = filesToBeRemoved.length + '/' + items.length;

        if (fileIndex == items.length) {
          clearInterval(timer);
          pb.finish(items.length);
          dialog.closeAll();

          //updating UI after removing musics
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            new AlertDialog(filesCanNotBeRemoved.length + " files can't be removed");
          }

          updateMusicsList(filesToBeRemoved);
          opStateChanged();
        } else {
          doRemoveMusic();
        }
      };
    }, 0);
  }

  function updateMusicsList(toBeRemovedFiles) {
    var container = $id('music-list-container');
    toBeRemovedFiles.forEach(function(item) {
      var music = $id(item);
      container.removeChild(music);
    });
    MusicList.updateUI();
  }

  function importMusics() {
    if (navigator.mozFFOSAssistant.isWifiConnect) {
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

      if (musics.length <= 0) {
        return;
      }

      var filesToBeImported = [];
      var filesCanNotBeImported = [];
      var fileIndex = 0;
      var oldFileIndex = 0;
      var steps = 0;

      var pb = new ProcessBar({
        sectionsNumber: musics.length,
        stepsPerSection: 50
      });

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-musics-dialog-header',
        processbar_l10n_id: 'processbar-import-musics-promot',
        processbar: pb
      });

      var filesIndicator = $id('files-indicator');
      filesIndicator.innerHTML = '0/' + musics.length;

      var bTimer = false;

      setTimeout(function doImportMusic() {
        var newDir = musics[fileIndex];
        if (navigator.mozFFOSAssistant.isWindows) {
          newDir = UrlEncode(newDir);
        }

        var cmd = 'adb push "' + newDir + '" /sdcard/Music';
        var req = navigator.mozFFOSAssistant.runCmd(cmd);

        if (!bTimer) {
          bTimer = true;
          var timer = setInterval(function() {
            if (oldFileIndex == fileIndex) {
              if (steps < 50) {
                steps++;
                pb.moveForward();
              }
            } else {
              oldFileIndex = fileIndex;
              steps = 0;
            }
          }, 100);
        }

        req.onsuccess = function(e) {
          filesToBeImported.push(musics[fileIndex]);
          fileIndex++;
          pb.finish(filesToBeImported.length);
          filesIndicator.innerHTML = fileIndex + '/' + musics.length;

          if (fileIndex == musics.length) {
            clearInterval(timer);
            pb.finish(musics.length);
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              new AlertDialog(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing musics
            FFOSAssistant.getAndShowAllMusics();
          } else {
            doImportMusic();
          }
        };

        req.onerror = function(e) {
          filesCanNotBeImported.push(musics[fileIndex]);
          fileIndex++;

          if (fileIndex == musics.length) {
            clearInterval(timer);
            pb.finish(musics.length);
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              new AlertDialog(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing musics
            FFOSAssistant.getAndShowAllMusics();
          } else {
            doImportMusic();
          }
        };
      }, 0);
    }, {
      title: _('import-music-title'),
      fileType: 'Audio'
    });
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-musics').addEventListener('click', function sall_onclick(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      selectAllMusics(this.dataset.checked == "false");
    });

    $id('remove-musics').addEventListener('click', function onclick_removeMusic(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnect) {
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
        }), true, function (returnBtn) {
        if(returnBtn) {
          MusicList.removeMusics(files);
        }
      });
    });

    $id('refresh-musics').addEventListener('click', function onclick_refreshMusics(event) {
      FFOSAssistant.getAndShowAllMusics();
    });

    $id('import-musics-btn').addEventListener('click', importMusics);

    $id('import-musics').addEventListener('click', importMusics);

    $id('export-musics').addEventListener('click', function onclick_exportMusics(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnect) {
        new WifiModePromptDialog({
          title_l10n_id: 'export-musics-dialog-header',
          prompt_l10n_id: 'wifi-mode-export-musics-promot'
        });
        return;
      }

      var musics = $expr('#music-list-container .music-list-item[data-checked="true"]');

      if (musics.length <= 0) {
        return;
      }

      navigator.mozFFOSAssistant.selectDirectory(function(dir) {
        var filesToBeExported = [];
        var filesCanNotBeExported = [];

        var fileIndex = 0;
        var oldFileIndex = 0;
        var steps = 0;

        var pb = new ProcessBar({
          sectionsNumber: musics.length,
          stepsPerSection: 50
        });

        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-musics-dialog-header',
          processbar_l10n_id: 'processbar-export-musics-promot',
          processbar: pb
        });

        var filesIndicator = $id('files-indicator');
        filesIndicator.innerHTML = '0/' + musics.length;

        var bTimer = false;

        setTimeout(function doExportMusic() {
          var newDir = decodeURI(dir);
          var oldDir = musics[fileIndex].dataset.id;
          newDir = newDir + '/' + musics[fileIndex].dataset.name + '.' + musics[fileIndex].dataset.type;
          if (navigator.mozFFOSAssistant.isWindows) {
            newDir = newDir.substring(1, newDir.length);
            newDir = UrlEncode(newDir);
          }
          var cmd = 'adb pull "' + oldDir + '" "' + newDir + '"';
          var req = navigator.mozFFOSAssistant.runCmd(cmd);

          if (!bTimer) {
            bTimer = true;
            var timer = setInterval(function() {
              if (oldFileIndex == fileIndex) {
                if (steps < 50) {
                  steps++;
                  pb.moveForward();
                }
              } else {
                oldFileIndex = fileIndex;
                steps = 0;
              }
            }, 100);
          }

          req.onsuccess = function(e) {
            filesToBeExported.push(musics[fileIndex]);
            fileIndex++;
            pb.finish(filesToBeExported.length);
            filesIndicator.innerHTML = filesToBeExported.length + '/' + musics.length;

            if (fileIndex == musics.length) {
              clearInterval(timer);
              pb.finish(musics.length);
              dialog.closeAll();

              if (filesCanNotBeExported.length > 0) {
                //TODO: tell user some files can't be exported
                new AlertDialog(filesCanNotBeExported.length + " music files can't be exported");
              }
            } else {
              doExportMusic();
            }
          };

          req.onerror = function(e) {
            filesCanNotBeExported.push(musics[fileIndex]);
            fileIndex++;
            if (fileIndex == musics.length) {
              clearInterval(timer);
              pb.finish(musics.length);
              dialog.closeAll();

              if (filesCanNotBeExported.length > 0) {
                //TODO: tell user some musics can't be exported
                new AlertDialog(filesCanNotBeExported.length + " music files can't be exported");
              }
            } else {
              doExportMusic();
            }
          };
        }, 0);
      }, {
        title: _('export-music-title'),
        fileType: 'Audio'
      });
    });
  });

  return {
    init: init,
    addMusic: addMusic,
    removeMusic: removeMusic,
    updateUI: updateUI,
    getMusic: getMusic,
    selectAllMusics: selectAllMusics,
    removeMusics: removeMusics
  };
})();