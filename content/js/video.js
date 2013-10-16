var Video = (function() {
  function getListContainer() {
    return $id('video-list-container');
  }

  function init() {
    getListContainer().innerHTML = '';
    checkVideoListIsEmpty();
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
      threadBody.appendChild(_createVideoListItem(video));
      threadContainer.dataset.length = 1 + parseInt(threadContainer.dataset.length);
      var title = threadContainer.getElementsByTagName('label')[0];
      title.innerHTML = '<span>' + threadId + ' (' + threadContainer.dataset.length + ')</span>';
    } else {
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
        if (target instanceof HTMLLabelElement) {
          var threadContainer = this.parentNode.parentNode;
          var videoItems = $expr('li', threadContainer);

          if (threadContainer.dataset.checked == 'true') {
            threadContainer.dataset.checked = false;
            videoItems.forEach(function(item) {
              item.dataset.checked = false;
            });
          } else {
            threadContainer.dataset.checked = true;
            videoItems.forEach(function(item) {
              item.dataset.checked = true;
            });
          }

          opStateChanged();
        }
      };

      var threadBody = $expr('ul', div)[0];
      threadBody.appendChild(_createVideoListItem(video));
    }
  }

  function updateRemovedVideos(videos) {
    if (!videos || !videos.length || videos.length < 1) {
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

  function _createVideoListItem(video) {
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
      if (this.dataset.checked == 'true') {
        this.dataset.checked = 'false';
      } else {
        this.dataset.checked = 'true';
      }
      var threadBody = this.parentNode;
      var threadContainer = threadBody.parentNode;
      threadContainer.dataset.checked = $expr('li[data-checked=true]', threadBody).length == threadContainer.dataset.length;
      opStateChanged();
    };

    listItem.onmouseover = function(e) {
      var tip = $id('tip');
      tip.innerHTML = '<div>name:' + this.dataset.title + '</div><div>date:' + parseDate(parseInt(this.dataset.date)) + '</div><div>size:' + toSizeInMB(this.dataset.size) + 'M' + '</div>';
      tip.style.top = (e.target.parentNode.offsetTop + e.target.clientHeight + e.target.clientTop) + 'px';
      tip.style.left = (e.target.parentNode.offsetLeft + e.target.clientWidth /2 + e.target.clientLeft) + 'px';
      tip.style.display = 'block';
    };

    listItem.onmouseout = function(e) {
      var tip = $id('tip');
      tip.style.display = 'none';
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
    $id('selectAll-videos').dataset.disabled = isEmpty;
    $id('empty-video-container').hidden = !isEmpty;
  }

  function selectAllVideos(selected) {
    $expr('#video-list-container .video-thread').forEach(function(thread) {
      thread.dataset.checked = selected;
      $expr('li', thread).forEach(function(item) {
        item.dataset.checked = selected;
      });
    });

    opStateChanged();
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

    var pb = new ProcessBar({
      sectionsNumber: files.length,
      stepsPerSection: 50
    });

    var dialog = new FilesOPDialog({
      title_l10n_id: 'remove-videos-dialog-header',
      processbar_l10n_id: 'processbar-remove-videos-promot',
      processbar: pb
    });

    var filesIndicator = $id('files-indicator');
    filesIndicator.innerHTML = '0/' + items.length;

    var bTimer = false;

    setTimeout(function doRemoveVideo() {
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

          //updating UI after removing videos
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            new AlertDialog(filesCanNotBeRemoved.length + " files can't be removed");
          }

          updateRemovedVideos(filesToBeRemoved);
          checkVideoListIsEmpty();
          opStateChanged();
        } else {
          doRemoveVideo();
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

          //updating UI after removing videos
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            new AlertDialog(filesCanNotBeRemoved.length + " files can't be removed");
          }

          updateRemovedVideos(filesToBeRemoved);
          checkVideoListIsEmpty();
          opStateChanged();
        } else {
          doRemoveVideo();
        }
      };
    }, 0);
  }

  function importVideos() {
    if (navigator.mozFFOSAssistant.isWifiConnect) {
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
      if (videos.length <= 0) {
        return;
      }

      var filesToBeImported = [];
      var filesCanNotBeImported = [];
      var fileIndex = 0;
      var oldFileIndex = 0;
      var steps = 0;

      var pb = new ProcessBar({
        sectionsNumber: videos.length,
        stepsPerSection: 50
      });

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-videos-dialog-header',
        processbar_l10n_id: 'processbar-import-videos-promot',
        processbar: pb
      });

      var filesIndicator = $id('files-indicator');
      filesIndicator.innerHTML = '0/' + videos.length;

      var bTimer = false;

      setTimeout(function doImportVideo() {
        var cmd = 'adb push "' + videos[fileIndex] + '" /sdcard/Movies';
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
          filesToBeImported.push(videos[fileIndex]);
          fileIndex++;
          pb.finish(filesToBeImported.length);
          filesIndicator.innerHTML = fileIndex + '/' + videos.length;

          if (fileIndex == videos.length) {
            clearInterval(timer);
            pb.finish(videos.length);
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              new AlertDialog(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing videos
            FFOSAssistant.getAndShowAllVideos();
          } else {
            doImportVideo();
          }
        };

        req.onerror = function(e) {
          filesCanNotBeImported.push(videos[fileIndex]);
          fileIndex++;

          if (fileIndex == videos.length) {
            clearInterval(timer);
            pb.finish(videos.length);
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              new AlertDialog(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing videos
            FFOSAssistant.getAndShowAllVideos();
          } else {
            doImportVideo();
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
      selectAllVideos(this.dataset.checked == "false");
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

      new AlertDialog(_('delete-videos-confirm', {
          n: files.length
        }), true, function (returnBtn) {
        if(returnBtn) {
          Video.removeVideos(files);
        }
      });
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

      navigator.mozFFOSAssistant.selectDirectory(function(dir) {
        var filesToBeExported = [];
        var filesCanNotBeExported = [];
        var fileIndex = 0;
        var oldFileIndex = 0;
        var steps = 0;

        var pb = new ProcessBar({
          sectionsNumber: videos.length,
          stepsPerSection: 50
        });

        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-videos-dialog-header',
          processbar_l10n_id: 'processbar-export-videos-promot',
          processbar: pb
        });

        var filesIndicator = $id('files-indicator');
        filesIndicator.innerHTML = '0/' + videos.length;

        var bTimer = false;

        var newDir = dir;
        if (navigator.mozFFOSAssistant.isWindows) {
          newDir = dir.substring(1, dir.length);
        }

        setTimeout(function doExportVideo() {
          var cmd = 'adb pull "' + videos[fileIndex].dataset.videoUrl + '" "' + decodeURI(newDir) + '/' + convertToOutputFileName(videos[fileIndex].dataset.videoUrl) + '"';

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
            filesToBeExported.push(videos[fileIndex]);
            fileIndex++;
            pb.finish(filesToBeExported.length);
            filesIndicator.innerHTML = filesToBeExported.length + '/' + videos.length;

            if (fileIndex == videos.length) {
              clearInterval(timer);
              pb.finish(videos.length);
              dialog.closeAll();

              if (filesCanNotBeExported.length > 0) {
                //TODO: tell user some files can't be exported
                new AlertDialog(filesCanNotBeExported.length + " files can't be exported");
              }
            } else {
              doExportVideo();
            }
          };

          req.onerror = function(e) {
            filesCanNotBeExported.push(videos[fileIndex]);
            fileIndex++;

            if (fileIndex == videos.length) {
              clearInterval(timer);
              pb.finish(videos.length);
              dialog.closeAll();

              if (filesCanNotBeExported.length > 0) {
                //TODO: tell user some files can't be exported
                new AlertDialog(filesCanNotBeExported.length + " files can't be exported");
              }
            } else {
              doExportVideo();
            }
          };
        }, 0);
      }, {
        title: _('export-video-title'),
        fileType: 'Video'
      });
    });
  });

  return {
    init: init,
    addVideo: addVideo,
    updateRemovedVideos: updateRemovedVideos,
    checkVideoListIsEmpty: checkVideoListIsEmpty,
    selectAllVideos: selectAllVideos,
    removeVideos: removeVideos
  };
})();
