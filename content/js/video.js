/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Video = (function() {
  function getListContainer() {
    return $id('video-list-container');
  }

  function opStateChanged() {
    if ($expr('#video-list-container .videos-group').length == 0) {
      $id('selectAll-videos').dataset.checked = false;
      $id('selectAll-videos').dataset.disabled = true;
    } else {
      $id('selectAll-videos').dataset.checked =
        $expr('#video-list-container .video-item-div').length ===
          $expr('#video-list-container .video-item-div[data-checked="true"]').length;
      $id('selectAll-videos').dataset.disabled = false;
    }

    $id('remove-videos').dataset.disabled =
      $expr('#video-list-container .video-item-div[data-checked="true"]').length === 0;
    $id('export-videos').dataset.disabled =
      $expr('#video-list-container .video-item-div[data-checked="true"]').length === 0;
  }

  function checkVideoListIsEmpty() {
    var isEmpty = $expr('#video-list-container .video-item-div').length === 0 ;
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
      $id('empty-video-container').style.display = 'block';
    } else {
      $id('empty-video-container').style.display = 'none';
    }
  }

  var dataPool = {
    dataList:[],
    groupedData:[]
  };

  var currentGroupIndex;
  var currentVideoIndex;

  function initList(videos) {
    var container = getListContainer();
    container.innerHTML = '';
    dataPool.dataList = videos;
    dataPool.groupedData = [];
    makeGroup();
    sortGroup();
    var index = 0;
    setTimeout(function getVideoGoups() {
      if (index == dataPool.groupedData.length) {
        checkVideoListIsEmpty();
        opStateChanged();
        return;
      }

      var group = dataPool.groupedData[index];
      var groupItem = document.createElement('div');
      groupItem.classList.add('videos-group');
      var titleDiv = document.createElement('div');
      titleDiv.classList.add('title');
      groupItem.appendChild(titleDiv);

      var html = '';
      html += '  <label class="group-unckecked"></label>';
      html += '  <div class="groupInfo">';
      html += '  <span>';
      html += group.id;
      html += '  </span>';
      html += '  <span>';
      html += '(' + group.data.length + ')';
      html += '  </span>';
      html += '  </div>';
      titleDiv.innerHTML += html;

      container.appendChild(groupItem);
      var groupBody = document.createElement('div');
      groupBody.classList.add('groupBody');
      groupItem.appendChild(groupBody);
      groupItem.dataset.length = group.data.length;
      groupItem.dataset.checked = false;
      groupItem.dataset.groupId = group.id;

      var position = 0;
      setTimeout(function getGoupVideos() {
        if (position == group.data.length) {
          titleDiv.onclick = function selectGroup(event) {
            var target = event.target;
            if (target instanceof HTMLLabelElement) {
              target.classList.toggle('group-checked');
              var groupContainer = this.parentNode;
              var checkboxes = $expr('.video-unchecked',groupContainer);
              var videoDivs = $expr('.video-item-div',groupContainer);

              if (target.classList.contains('group-checked')) {
                groupContainer.dataset.checked = true;
                checkboxes.forEach(function(item) {
                  item.classList.add('video-checked');
                });

                videoDivs.forEach(function(div) {
                  div.dataset.checked = true;
                });
              } else {
                groupContainer.dataset.checked = false;
                checkboxes.forEach(function(item) {
                  item.classList.remove('video-checked');
                });

                videoDivs.forEach(function(div) {
                  div.dataset.checked = false;
                });
              }
              opStateChanged();
            }
          };
          index++;
          getVideoGoups();
          return;
        }

        CMD.Videos.getVideoPosterByName(group.data[position].name,
          function on_getVideoPosterSuccess(result) {
            var div = document.createElement('div');
            div.classList.add('video-item-div');
            div.dataset.checked = 'false';
            div.dataset.videoUrl = group.data[position].name;
            div.dataset.groupIndex = index;
            div.dataset.position = position;
            groupBody.appendChild(div);
            var videoDiv = document.createElement('div');
            videoDiv.classList.add('video-item');
            videoDiv.innerHTML = '<img src="' + result.data + '">';
            div.appendChild(videoDiv);
            var checkboxDiv = document.createElement('div');
            checkboxDiv.classList.add('video-unchecked');
            div.appendChild(checkboxDiv);

            checkboxDiv.onclick = function select_video(event) {
              this.classList.toggle('video-checked');
              var video = this.parentNode;

              if (this.classList.contains('video-checked')) {
                video.dataset.checked = 'true';
              } else {
                video.dataset.checked = 'false';
              }

              var groupBody = this.parentNode.parentNode;
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
            position++;
            getGoupVideos();
          },
          function on_getVideoPosterError(error) {
            position++;
            getGoupVideos();
            alert('get video poster error');
          }
        );
      }, 0 );
    }, 0);
  }

  function makeGroup() {
    dataPool.dataList.forEach(function(item) {
      var dt = new Date(parseInt(item.date));
      var groupId = dt.getFullYear() + '-';

      if (dt.getMonth() < 9) {
        groupId += '0' + (dt.getMonth() + 1) + '-';
      } else {
        groupId += (dt.getMonth() + 1) + '-';
      }
      if(dt.getDay() < 9) {
        groupId += '0' + (dt.getDay() + 1);
      } else {
        groupId += dt.getDay() + 1;
      }

      var group = findGroupById(groupId);
      if (group) {
        group.data.push(item);
      } else {
        group = {id:groupId, data:[]};
        group.data.push(item);
        dataPool.groupedData.push(group);
      }
    });
  }

  function sortGroup() {
    dataPool.groupedData.sort(function(a,b) {
      var dt1 = new Date(a.id).getTime();
      var dt2 = new Date(b.id).getTime();
      if (dt1 == dt2) {
        return 0;
      }
      if (dt1 > dt2) {
        return -1;
      } else {
        return 1;
      }
    });
  }

  function findGroupById(groupId) {
    var group = null;
    for (var i =0; i < dataPool.groupedData.length; i++) {
      if (dataPool.groupedData[i].id == groupId) {
        group = dataPool.groupedData[i];
        break;
      }
    }
    return group;
  }

  function removeGroup(group) {
    for (var i =0; i < dataPool.groupedData.length; i++) {
      if (dataPool.groupedData[i].id == group.id) {
        dataPool.groupedData.splice(i, 1);
        break;
      }
    }
  }

  function selectAllVideos(select) {
    $expr('#video-list-container .videos-group').forEach(function(group) {
      selectVideosGroup(group, select);
    });

    opStateChanged();
  }

  function selectVideosGroup(group, selected) {
    group.dataset.checked = selected;
    $expr('.video-item-div', group).forEach(function(videoDiv) {
      videoDiv.dataset.checked = selected;
    });

    var groupCheckbox = $expr('.group-unckecked', group)[0];

    if (groupCheckbox) {
      if (selected) {
        groupCheckbox.classList.add('group-checked');
        $expr('.video-unchecked', group).forEach(function(videoCheckbox) {
          videoCheckbox.classList.add('video-checked');
        });
      } else {
        groupCheckbox.classList.remove('group-checked');
        $expr('.video-unchecked', group).forEach(function(videoCheckbox) {
          videoCheckbox.classList.remove('video-checked');
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
              ratio+= step;
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
            alert(filesCanNotBeRemoved.length + " files can't be removed");
          }

          removeVideosProcess(filesToBeRemoved);
          checkVideoListIsEmpty();
          opStateChanged();
        } else {
          removeVideo();
        }
      };

      req.onerror = function (e) {
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
            alert(filesCanNotBeRemoved.length + " files can't be removed");
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
      var videoDiv = $expr('.video-item-div[data-video-url="' + filesToBeRemoved[i] + '"]')[0];
      if (videoDiv) {
        var groupBody = videoDiv.parentNode;
        groupBody.removeChild(videoDiv);
        var group = groupBody.parentNode;
        var groupId = group.dataset.groupId;
        var groupData = findGroupById(groupId);
        if (groupData) {
          for (var j = 0; j < groupData.data.length; j++) {
            if (groupData.data[j].name  == videoDiv.dataset.videoUrl) {
              groupData.data.splice(j ,1);
              if (groupData.data.length == 0) {
                removeGroup(groupData);
              }
              break;
            }
          }
        }
        if ($expr('.video-item-div', groupBody).length == 0) {
          getListContainer().removeChild(group);
        }
      }
    }
  }

  function importVideos() {
    if (navigator.mozFFOSAssistant.isWifiConnect) {
      new WifiModePromptDialog({title_l10n_id: 'import-videos-dialog-header',
                               prompt_l10n_id: 'wifi-mode-import-videos-promot'});
      return;
    }

    navigator.mozFFOSAssistant.selectMultiFilesFromDisk(function (state, data) {
      data = data.substr(0,data.length-1);
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
              alert(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing videos
            FFOSAssistant.getAndShowAllVideos();
          } else {
            importVideo();
          }
        };

        req.onerror = function (e) {
          filesCanNotBeImported.push(videos[fileIndex]);
          fileIndex++;

          if (fileIndex == videos.length) {
            clearInterval(timer);
            pb.style.width.innerHTML = '100%';
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              alert(filesCanNotBeImported.length + " files can't be imported");
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
        fileType: 'Video'
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
        new WifiModePromptDialog({title_l10n_id: 'remove-videos-dialog-header',
                                 prompt_l10n_id: 'wifi-mode-remove-videos-promot'});
        return;
      }

      var files = [];
      $expr('#video-list-container .video-item-div[data-checked="true"]').forEach(function(item) {
        files.push(item.dataset.videoUrl);
      });

      if (window.confirm(_('delete-videos-confirm', {n: files.length}))) {
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
        new WifiModePromptDialog({title_l10n_id: 'export-videos-dialog-header',
                                 prompt_l10n_id: 'wifi-mode-export-videos-promot'});
        return;
      }

      var videos = $expr('#video-list-container .video-item-div[data-checked="true"]');

      if (videos.length <= 0 ) {
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
            var cmd = 'adb pull "' + videos[fileIndex].dataset.videoUrl + '" "' + decodeURI(newDir) + videos[fileIndex].dataset.videoUrl + '"';

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
                  alert(filesCanNotBeExported.length + " files can't be exported");
                }
              } else {
                exportVideo();
              }
            };

            req.onerror = function (e) {
              filesCanNotBeExported.push(videos[fileIndex]);
              fileIndex++;

              if (fileIndex == videos.length) {
                clearInterval(timer);
                pb.style.width = '100%';
                dialog.closeAll();

                if (filesCanNotBeExported.length > 0) {
                  //TODO: tell user some files can't be exported
                  alert(filesCanNotBeExported.length + " files can't be exported");
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
    init: initList,
    selectAllVideos: selectAllVideos,
    removeVideos: removeVideos
  };
})();