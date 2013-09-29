/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Video = (function() {
  function getListContainer() {
    return $id('video-list-container');
  }

  function init() {
    getListContainer().innerHTML = '';
    showEmptyVideoList(false);
  }

  function addVideo(video) {
    if (!video) {
      return;
    }
    _addToVideoList(video);
  }

  function removeVideo(videos) {
    if (!videos || !videos.length || videos.length < 1) {
      return;
    }
    removeVideosProcess(videos);
  }

  function updateUI() {
    var videoList = $expr('#video-list-container li');
    if (videoList.length == 0) {
      showEmptyVideoList(true);
    }
  }

  function _addToVideoList(video) {
    var groupId = parseDate(parseInt(video.date));
    var groupContainer = $id('video-' + groupId);
    var container = getListContainer();
    if (groupContainer) {
      var groupBody = groupContainer.getElementsByTagName('ul')[0];
      groupBody.appendChild(_createVideoListItem(video));
      groupContainer.dataset.length = 1 + parseInt(groupContainer.dataset.length);
      var titles = $expr('.title', groupContainer);
      titles[0].innerHTML = '<span>' + groupId + ' (' + groupContainer.dataset.length + ')</span>';
    } else {
      groupContainer = document.createElement('div');
      groupContainer.setAttribute('id', 'video-' + groupId);
      groupContainer.classList.add('video-thread');
      var header = document.createElement('div');
      header.classList.add('header');
      groupContainer.appendChild(header);

      var title = document.createElement('label');
      title.classList.add('title');
      header.appendChild(title);
      title.innerHTML = '<span>' + groupId + ' (' + 1 + ')</span>';
      container.appendChild(groupContainer);
      title.onclick = function onSelectGroup(e) {
        var target = e.target;
        if (target instanceof HTMLLabelElement) {
          target.classList.toggle('group-checked');
          var groupContainer = this.parentNode.parentNode;
          var checkboxes = $expr('.video-unchecked', groupContainer);
          var videoItems = $expr('li', groupContainer);

          if (target.classList.contains('group-checked')) {
            groupContainer.dataset.checked = true;
            checkboxes.forEach(function(item) {
              item.classList.add('video-checked');
            });

            videoItems.forEach(function(item) {
              item.dataset.checked = true;
            });
          } else {
            groupContainer.dataset.checked = false;
            checkboxes.forEach(function(cb) {
              cb.classList.remove('video-checked');
            });

            videoItems.forEach(function(item) {
              item.dataset.checked = false;
            });
          }
          opStateChanged();
        }
      };

      var groupBody = document.createElement('ul');
      groupBody.classList.add('body');
      groupContainer.appendChild(groupBody);
      groupContainer.dataset.length = 1;
      groupContainer.dataset.checked = false;
      groupContainer.dataset.groupId = groupId;

      groupBody.appendChild(_createVideoListItem(video));
    }
  }

  function _createVideoListItem(video) {
    var listItem = document.createElement('li');
    listItem.dataset.checked = 'false';
    listItem.dataset.videoUrl = video.name;
    listItem.dataset.title = video.metadata.title;
    listItem.dataset.date = video.date;
    listItem.dataset.size = video.size;

    listItem.innerHTML = '<img src="' + video.metadata.poster + '">';

    var itemCheckbox = document.createElement('div');
    itemCheckbox.classList.add('video-unchecked');
    listItem.appendChild(itemCheckbox);

    listItem.onclick = function item_click(e) {
      itemCheckbox.classList.toggle('video-checked');

      if (itemCheckbox.classList.contains('video-checked')) {
        this.dataset.checked = 'true';
      } else {
        this.dataset.checked = 'false';
      }

      var groupBody = this.parentNode;
      var groupContainer = groupBody.parentNode;
      var labels = groupContainer.getElementsByTagName('label');
      if ($expr('.video-checked', groupBody).length == groupContainer.dataset.length) {
        labels[0].classList.add('group-checked');
        groupContainer.dataset.checked = true;
      } else {
        labels[0].classList.remove('group-checked');
        groupContainer.dataset.checked = false;
      }
      opStateChanged();
    };
    listItem.onmouseover = function(e) {
      var tip = document.createElement('div');
      tip.setAttribute('id', 'video-tip');
      tip.classList.add('video-tip');
      tip.style.top = (e.target.parentNode.offsetTop + 80) + 'px';
      tip.style.left = (e.target.parentNode.offsetLeft + 55) + 'px';
      tip.innerHTML = '<div>name:' + this.dataset.title + '</div><div>date:' + parseDate(parseInt(this.dataset.date)) + '</div><div>size:' + parseSize(this.dataset.size) + 'M' + '</div>';
      $id('video-view').appendChild(tip);
    };
    listItem.onmouseout = function(e) {
      var tip = $id('video-tip');
      if (tip) {
        tip.parentNode.removeChild(tip);
      }
    };
    return listItem;
  }

  function opStateChanged() {
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

  function checkVideoListIsEmpty() {
    var isEmpty = $expr('#video-list-container li').length === 0;
    if (isEmpty) {
      $id('selectAll-videos').dataset.disabled = true;
      showEmptyVideoList(true);
    } else {
      $id('selectAll-videos').dataset.disabled = false;
      showEmptyVideoList(false);
    }
  }

  function showEmptyVideoList(bFlag) {
    if (bFlag) {
      $id('empty-video-container').hidden = false;
    } else {
      $id('empty-video-container').hidden = true;
    }
  }

  function selectAllVideos(select) {
    $expr('#video-list-container .video-thread').forEach(function(group) {
      selectVideosGroup(group, select);
    });

    opStateChanged();
  }

  function selectVideosGroup(group, selected) {
    group.dataset.checked = selected;
    $expr('li', group).forEach(function(videoItem) {
      videoItem.dataset.checked = selected;
    });

    var groupCheckbox = $expr('.title', group)[0];

    if (groupCheckbox) {
      if (selected) {
        groupCheckbox.classList.add('group-checked');
        $expr('.video-unchecked', group).forEach(function(cb) {
          cb.classList.add('video-checked');
        });
      } else {
        groupCheckbox.classList.remove('group-checked');
        $expr('.video-unchecked', group).forEach(function(cb) {
          cb.classList.remove('video-checked');
        });
      }
    }
  }

  /**
   * Remove videos
   */

  function removeVideos(files) {
    var items = files || [];
    if (items.length <= 0) {
      //TODO: prompt select videos to be removed...
      return;
    }

    var filesToBeRemoved = [];
    var filesCanNotBeRemoved = [];

    var fileIndex = 0;
    var oldFileIndex = 0;
    var steps = 0;

    var dialog = new FilesOPDialog({
      title_l10n_id: 'remove-videos-dialog-header',
      processbar_l10n_id: 'processbar-remove-videos-promot'
    });

    var filesIndicator = $id('files-indicator');
    var pb = $id('processbar');
    var ratio = 0;
    filesIndicator.innerHTML = '0/' + items.length;

    //processbar range for one file
    var range = Math.round(100 / items.length);
    var step = range / 50;
    var bTimer = false;

    setTimeout(function removeVideo() {
      var cmd = 'adb shell rm "' + items[fileIndex] + '"';
      var req = navigator.mozFFOSAssistant.runCmd(cmd);
      if (!bTimer) {
        bTimer = true;
        var timer = setInterval(function() {
          if (oldFileIndex == fileIndex) {
            if (steps < 50) {
              steps++;
              ratio += step;
              pb.style.width = ratio + '%';
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
        ratio = Math.round(filesToBeRemoved.length * 100 / items.length);
        pb.style.width = ratio + '%';
        filesIndicator.innerHTML = filesToBeRemoved.length + '/' + items.length;

        if (fileIndex == items.length) {
          clearInterval(timer);
          pb.style.width = '100%';
          dialog.closeAll();

          //updating UI after removing videos
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            new AlertDialog(filesCanNotBeRemoved.length + " files can't be removed");
          }

          removeVideosProcess(filesToBeRemoved);
          checkVideoListIsEmpty();
          opStateChanged();
        } else {
          removeVideo();
        }
      };

      req.onerror = function(e) {
        filesCanNotBeRemoved.push(items[fileIndex]);
        fileIndex++;
        ratio = Math.round(filesToBeRemoved.length * 100 / items.length);
        pb.style.width = ratio + '%';
        filesIndicator.innerHTML = filesToBeRemoved.length + '/' + items.length;

        if (fileIndex == items.length) {
          clearInterval(timer);
          pb.style.width = '100%';
          dialog.closeAll();

          //updating UI after removing videos
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            new AlertDialog(filesCanNotBeRemoved.length + " files can't be removed");
          }

          removeVideosProcess(filesToBeRemoved);
          checkVideoListIsEmpty();
          opStateChanged();
        } else {
          removeVideo();
        }
      };
    }, 0);
  }

  function removeVideosProcess(filesToBeRemoved) {
    for (var i = 0; i < filesToBeRemoved.length; i++) {
      var video = $expr('li[data-video-url="' + filesToBeRemoved[i] + '"]')[0];
      if (video) {
        var groupBody = video.parentNode;
        groupBody.removeChild(video);
        var group = groupBody.parentNode;

        if ($expr('li', groupBody).length == 0) {
          getListContainer().removeChild(group);
        }
      }
    }
  }

  function importVideos() {
    if (navigator.mozFFOSAssistant.isWifiConnect) {
      new WifiModePromptDialog({
        title_l10n_id: 'import-videos-dialog-header',
        prompt_l10n_id: 'wifi-mode-import-videos-promot'
      });
      return;
    }

    navigator.mozFFOSAssistant.selectMultiFilesFromDisk(function(state, data) {
      data = data.substr(0, data.length - 1);
      var videos = data.split(';');

      if (videos.length <= 0) {
        return;
      }

      var filesToBeImported = [];
      var filesCanNotBeImported = [];
      var fileIndex = 0;
      var oldFileIndex = 0;
      var steps = 0;

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-videos-dialog-header',
        processbar_l10n_id: 'processbar-import-videos-promot'
      });

      var filesIndicator = $id('files-indicator');
      var pb = $id('processbar');
      var ratio = 0;
      filesIndicator.innerHTML = '0/' + videos.length;

      var range = Math.round(100 / videos.length);
      var step = range / 50;
      var bTimer = false;

      setTimeout(function importVideo() {
        var cmd = 'adb push "' + videos[fileIndex] + '" /sdcard/Movies/';
        var req = navigator.mozFFOSAssistant.runCmd(cmd);

        if (!bTimer) {
          bTimer = true;
          var timer = setInterval(function() {
            if (oldFileIndex == fileIndex) {
              if (steps < 50) {
                steps++;
                ratio += step;
                pb.style.width = ratio + '%';
              }
            } else {
              oldFileIndex = fileIndex;
              steps = 0;
            }
          }, 100);
        }

        req.onsuccess = function(e) {
          filesToBeImported.push(videos[fileIndex]);
          fileIndex++;
          ratio = Math.round(filesToBeImported.length * 100 / videos.length);
          pb.style.width = ratio + '%';
          filesIndicator.innerHTML = fileIndex + '/' + videos.length;

          if (fileIndex == videos.length) {
            clearInterval(timer);
            pb.style.width.innerHTML = '100%';
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              new AlertDialog(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing videos
            FFOSAssistant.getAndShowAllVideos();
          } else {
            importVideo();
          }
        };

        req.onerror = function(e) {
          filesCanNotBeImported.push(videos[fileIndex]);
          fileIndex++;

          if (fileIndex == videos.length) {
            clearInterval(timer);
            pb.style.width.innerHTML = '100%';
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              new AlertDialog(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing videos
            FFOSAssistant.getAndShowAllVideos();
          } else {
            importVideo();
          }
        };
      }, 0);
    }, {
      title: _('import-video-title'),
      fileType: 'VideoTypes'
    });
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-videos').addEventListener('click', function(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      if (this.dataset.checked == "false") {
        selectAllVideos(true);
      } else {
        selectAllVideos(false);
      }
    });

    $id('remove-videos').addEventListener('click', function onclick_removeVideos(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnect) {
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

      if (window.confirm(_('delete-videos-confirm', {
        n: files.length
      }))) {
        Video.removeVideos(files);
      }
    });

    $id('refresh-videos').addEventListener('click', function onclick_refreshVideos(event) {
      FFOSAssistant.getAndShowAllVideos();
    });

    $id('import-videos-btn').addEventListener('click', importVideos);

    $id('import-videos').addEventListener('click', importVideos);

    $id('export-videos').addEventListener('click', function onclick_exportVideos(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnect) {
        new WifiModePromptDialog({
          title_l10n_id: 'export-videos-dialog-header',
          prompt_l10n_id: 'wifi-mode-export-videos-promot'
        });
        return;
      }

      var videos = $expr('#video-list-container li[data-checked="true"]');

      if (videos.length <= 0) {
        return;
      }

      navigator.mozFFOSAssistant.selectDirectory(function(status, dir) {
        if (status) {
          var filesToBeExported = [];
          var filesCanNotBeExported = [];

          var fileIndex = 0;
          var oldFileIndex = 0;
          var steps = 0;

          var dialog = new FilesOPDialog({
            title_l10n_id: 'export-videos-dialog-header',
            processbar_l10n_id: 'processbar-export-videos-promot'
          });

          var filesIndicator = $id('files-indicator');
          var pb = $id('processbar');
          var ratio = 0;
          filesIndicator.innerHTML = '0/' + videos.length;

          //processbar range for one file
          var range = Math.round(100 / videos.length);
          var step = range / 50;
          var bTimer = false;

          var os = (function() {
            var oscpu = navigator.oscpu.toLowerCase();
            return {
              isWindows: /windows/.test(oscpu),
              isLinux: /linux/.test(oscpu),
              isMac: /mac/.test(oscpu)
            };
          })();

          var newDir = dir;
          if (os.isWindows) {
            newDir = dir.substring(1, dir.length);
          }

          setTimeout(function exportVideo() {
            var cmd = 'adb pull "' + videos[fileIndex].dataset.videoUrl + '" "' + decodeURI(newDir) + '/' + convertToOutputFileName(videos[fileIndex].dataset.videoUrl) + '"';

            var req = navigator.mozFFOSAssistant.runCmd(cmd);
            if (!bTimer) {
              bTimer = true;
              var timer = setInterval(function() {
                if (oldFileIndex == fileIndex) {
                  if (steps < 50) {
                    steps++;
                    ratio += step;
                    pb.style.width = ratio + '%';
                  }
                } else {
                  oldFileIndex = fileIndex;
                  steps = 0;
                }
              }, 100);
            }

            req.onsuccess = function(e) {
              filesToBeExported.push(videos[fileIndex]);
              fileIndex++;
              ratio = Math.round(filesToBeExported.length * 100 / videos.length);
              pb.style.width = ratio + '%';
              filesIndicator.innerHTML = filesToBeExported.length + '/' + videos.length;

              if (fileIndex == videos.length) {
                clearInterval(timer);
                pb.style.width = '100%';
                dialog.closeAll();

                if (filesCanNotBeExported.length > 0) {
                  //TODO: tell user some files can't be exported
                  new AlertDialog(filesCanNotBeExported.length + " files can't be exported");
                }
              } else {
                exportVideo();
              }
            };

            req.onerror = function(e) {
              filesCanNotBeExported.push(videos[fileIndex]);
              fileIndex++;

              if (fileIndex == videos.length) {
                clearInterval(timer);
                pb.style.width = '100%';
                dialog.closeAll();

                if (filesCanNotBeExported.length > 0) {
                  //TODO: tell user some files can't be exported
                  new AlertDialog(filesCanNotBeExported.length + " files can't be exported");
                }
              } else {
                exportVideo();
              }
            };
          }, 0);
        }
      }, {
        title: _('export-video-title'),
        fileType: 'Video'
      });
    });
  });

  return {
    init: init,
    addVideo: addVideo,
    removeVideo: removeVideo,
    updateUI: updateUI,
    selectAllVideos: selectAllVideos,
    removeVideos: removeVideos
  };
})();
