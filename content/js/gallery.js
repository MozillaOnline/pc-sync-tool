var Gallery = (function() {
  function getListContainer() {
    return $id('picture-list-container');
  }

  const CACHE_FOLDER_NAME = 'gallery_tmp';
  const PRE_PATH = 'chrome://ffosassistant/content/';

  function init() {
    getListContainer().innerHTML = '';
    checkGalleryIsEmpty();
  }

  function addPicture(picture) {
    if (!picture) {
      return;
    }

    var threadId = parseDate(parseInt(picture.date));
    var threadContainer = $id('pic-' + threadId);
    var container = getListContainer();

    if (threadContainer) {
      var threadBody = threadContainer.getElementsByTagName('ul')[0];
      threadBody.appendChild(_createPictureListItem(picture));
      threadContainer.dataset.length = 1 + parseInt(threadContainer.dataset.length);
      var title = threadContainer.getElementsByTagName('label')[0];
      title.innerHTML = '<span>' + threadId + ' (' + threadContainer.dataset.length + ')</span>';
    } else {
      var templateData = {
        id: 'pic-' + threadId,
        threadId: threadId
      };

      var div = document.createElement('div');
      div.innerHTML = tmpl('tmpl_pic_thread_container', templateData);
      container.appendChild(div);
      var title = $expr('label', div)[0];

      title.onclick = function onSelectThread(e) {
        var target = e.target;
        if (target instanceof HTMLLabelElement) {
          var threadContainer = this.parentNode.parentNode;
          var picItems = $expr('li', threadContainer);

          if (threadContainer.dataset.checked == 'true') {
            threadContainer.dataset.checked = false;

            picItems.forEach(function(item) {
              item.dataset.checked = false;
            });
          } else {
            threadContainer.dataset.checked = true;

            picItems.forEach(function(item) {
              item.dataset.checked = true;
            });
          }
          opStateChanged();
        }
      };

      var threadBody = $expr('ul', div)[0];
      threadBody.appendChild(_createPictureListItem(picture));
    }
  }

  function updateRemovedPictures(pictures) {
    if (!pictures || !pictures.length || pictures.length < 1) {
      return;
    }
    for (var i = 0; i < pictures.length; i++) {
      var pic = $expr('li[data-pic-url="' + pictures[i] + '"]')[0];
      if (!pic) {
        continue;
      }
      var threadBody = pic.parentNode;
      threadBody.removeChild(pic);
      var thread = threadBody.parentNode.parentNode;
      if ($expr('li', threadBody).length == 0) {
        getListContainer().removeChild(thread);
      }
    }
  }

  function _createPictureListItem(picture) {
    var listItem = document.createElement('li');
    listItem.dataset.checked = 'false';
    listItem.dataset.picUrl = picture.name;
    listItem.dataset.title = getFileName(picture.name);
    listItem.dataset.date = picture.date;
    listItem.dataset.size = picture.size;

    var templateData = {
      thumbnail: picture.metadata.thumbnail
    };
    listItem.innerHTML = tmpl('tmpl_pic_item', templateData);

    listItem.onclick = function item_click(e) {
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

    listItem.ondblclick = function(e) {
      var tip = $id('pic-tip');
      if (tip) {
        tip.parentNode.removeChild(tip);
      }

      var picList = $expr('li', getListContainer());
      var currentIndex = 0;
      for (; currentIndex < picList.length; currentIndex++) {
        if (picList[currentIndex].dataset.picUrl == this.dataset.picUrl) {
          break;
        }
      }

      var imageViewer = new ImageViewer({
        count: picList.length,
        currentIndex: currentIndex,
        getPictureAt: getPictureAt
      });
    };

    listItem.onmouseover = function(e) {
      var tip = $id('tip');
      tip.innerHTML = '<div>name:' + this.dataset.title + '</div><div>date:' + parseDate(parseInt(this.dataset.date)) + '</div><div>size:' + toSizeInMB(this.dataset.size) + 'M' + '</div>';
      tip.style.top = (e.target.parentNode.offsetTop + e.target.parentNode.offsetParent.offsetTop + e.target.parentNode.clientHeight - $id('picture-list-container').scrollTop) + 'px';
      tip.style.left = (e.target.parentNode.offsetParent.offsetLeft + e.target.parentNode.offsetLeft + e.target.parentNode.clientWidth / 2) + 'px';
      tip.style.display = 'block';
    };

    listItem.onmouseout = function(e) {
      var tip = $id('tip');
      tip.style.display = 'none';
    };
    return listItem;
  }

  function getPictureAt(index, callback) {
    var picList = $expr('li', getListContainer());
    if (picList[index]) {
      //TODO: CHECK IF PICTURE HAS BEEN CACHED ALREADY
      var path = navigator.mozFFOSAssistant.getGalleryCachedDir(['extensions', 'ffosassistant@mozillaonline.com', 'content', CACHE_FOLDER_NAME]);
      var cmd = 'adb pull "' + picList[index].dataset.picUrl + '" "' + path + picList[index].dataset.picUrl + '"';
      var cachedUrl = PRE_PATH + CACHE_FOLDER_NAME + picList[index].dataset.picUrl;
      var req = navigator.mozFFOSAssistant.runCmd(cmd);

      req.onsuccess = function on_success(result) {
        callback(true, cachedUrl);
      };
      req.onerror = function on_error(e) {
        callback(false);
      };
    }
  }

  function opStateChanged() {
    if ($expr('#picture-list-container .picture-thread').length == 0) {
      $id('selectAll-pictures').dataset.checked = false;
      $id('selectAll-pictures').dataset.disabled = true;
    } else {
      $id('selectAll-pictures').dataset.checked =
      $expr('#picture-list-container li').length === $expr('#picture-list-container li[data-checked="true"]').length;
      $id('selectAll-pictures').dataset.disabled = false;
    }

    $id('remove-pictures').dataset.disabled =
    $expr('#picture-list-container li[data-checked="true"]').length === 0;
    $id('export-pictures').dataset.disabled =
    $expr('#picture-list-container li[data-checked="true"]').length === 0;
  }

  function checkGalleryIsEmpty() {
    var isEmpty = $expr('#picture-list-container li').length === 0;
    $id('selectAll-pictures').dataset.disabled = isEmpty;
    $id('empty-picture-container').hidden = !isEmpty;
  }

  function selectAllPictures(select) {
    $expr('#picture-list-container .picture-thread').forEach(function(thread) {
      thread.dataset.checked = selected;
      $expr('li', thread).forEach(function(item) {
        item.dataset.checked = selected;
      });
    });

    opStateChanged();
  }

  /**
   * Remove pictures
   */

  function removePictures(files) {
    var items = files || [];
    if (items.length <= 0) {
      //TODO: prompt select pictures to be removed...
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
      title_l10n_id: 'remove-pictures-dialog-header',
      processbar_l10n_id: 'processbar-remove-pictures-prompt',
      processbar: pb
    });

    var filesIndicator = $id('files-indicator');
    filesIndicator.innerHTML = '0/' + items.length;

    var bTimer = false;

    setTimeout(function doRemovePicture() {
      var cmd = 'adb shell rm ' + items[fileIndex];
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

          //updating UI after removing pictures
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            new AlertDialog(filesCanNotBeRemoved.length + " files can't be removed");
          }

          updateRemovedPictures(filesToBeRemoved);
          checkGalleryIsEmpty();
          opStateChanged();
        } else {
          doRemovePicture();
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

          //updating UI after removing pictures
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            new AlertDialog(filesCanNotBeRemoved.length + " files can't be removed");
          }

          updateRemovedPictures(filesToBeRemoved);
          checkGalleryIsEmpty();
          opStateChanged();
        } else {
          doRemovePicture();
        }
      };
    }, 0);
  }

  function importPictures() {
    if (navigator.mozFFOSAssistant.isWifiConnect) {
      new WifiModePromptDialog({
        title_l10n_id: 'import-pictures-dialog-header',
        prompt_l10n_id: 'wifi-mode-import-pictures-promot'
      });
      return;
    }

    navigator.mozFFOSAssistant.selectMultiFilesFromDisk(function(data) {
      if (!data) {
        return;
      }
      data = data.substr(0, data.length - 1);
      var pictures = data.split(';');

      if (pictures.length <= 0) {
        return;
      }

      var filesToBeImported = [];
      var filesCanNotBeImported = [];
      var fileIndex = 0;
      var oldFileIndex = 0;
      var steps = 0;

      var pb = new ProcessBar({
        sectionsNumber: pictures.length,
        stepsPerSection: 50
      });

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-pictures-dialog-header',
        processbar_l10n_id: 'processbar-import-pictures-promot',
        processbar: pb
      });

      var filesIndicator = $id('files-indicator');
      filesIndicator.innerHTML = '0/' + pictures.length;

      var bTimer = false;

      setTimeout(function doImportPicture() {
        var cmd = 'adb push "' + pictures[fileIndex] + '" /sdcard/DCIM/';
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
          filesToBeImported.push(pictures[fileIndex]);
          fileIndex++;
          pb.finish(filesToBeImported.length);
          filesIndicator.innerHTML = fileIndex + '/' + pictures.length;

          if (fileIndex == pictures.length) {
            clearInterval(timer);
            pb.finish(pictures.length);
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              new AlertDialog(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing gallery
            FFOSAssistant.getAndShowGallery();
          } else {
            doImportPicture();
          }
        };

        req.onerror = function(e) {
          filesCanNotBeImported.push(pictures[fileIndex]);
          fileIndex++;

          if (fileIndex == pictures.length) {
            clearInterval(timer);
            pb.finish(pictures.length);
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              new AlertDialog(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing gallery
            FFOSAssistant.getAndShowGallery();
          } else {
            doImportPicture();
          }
        };
      }, 0);
    }, {
      title: _('import-picture-title'),
      fileType: 'Image'
    });
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-pictures').addEventListener('click', function(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      selectAllPictures(this.dataset.checked == "false");
    });

    $id('remove-pictures').addEventListener('click', function onclick_removePictures(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnect) {
        new WifiModePromptDialog({
          title_l10n_id: 'remove-pictures-dialog-header',
          prompt_l10n_id: 'wifi-mode-remove-pictures-promot'
        });
        return;
      }

      var files = [];
      $expr('#picture-list-container li[data-checked="true"]').forEach(function(item) {
        files.push(item.dataset.picUrl);
      });

      new AlertDialog(_('delete-pictures-confirm', {
          n: files.length
        }), true, function (returnBtn) {
        if(returnBtn) {
          Gallery.removePictures(files);
        }
      });
    });

    $id('refresh-pictures').addEventListener('click', function onclick_refreshPictures(event) {
      FFOSAssistant.getAndShowGallery();
    });

    $id('import-pictures-btn').addEventListener('click', importPictures);

    $id('import-pictures').addEventListener('click', importPictures);

    $id('export-pictures').addEventListener('click', function onclick_exportPictures(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnect) {
        new WifiModePromptDialog({
          title_l10n_id: 'export-pictures-dialog-header',
          prompt_l10n_id: 'wifi-mode-export-pictures-promot'
        });
        return;
      }

      var pictures = $expr('#picture-list-container li[data-checked="true"]');

      if (pictures.length <= 0) {
        return;
      }

      navigator.mozFFOSAssistant.selectDirectory(function(dir) {
        var filesToBeExported = [];
        var filesCanNotBeExported = [];

        var fileIndex = 0;
        var oldFileIndex = 0;
        var steps = 0;

        var pb = new ProcessBar({
          sectionsNumber: pictures.length,
          stepsPerSection: 50
        });

        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-pictures-dialog-header',
          processbar_l10n_id: 'processbar-export-pictures-promot',
          processbar: pb
        });

        var filesIndicator = $id('files-indicator');
        filesIndicator.innerHTML = '0/' + pictures.length;

        var bTimer = false;

        var newDir = dir;
        if (navigator.mozFFOSAssistant.isWindows) {
          newDir = dir.substring(1, dir.length);
        }

        setTimeout(function doExportPicture() {
          var cmd = 'adb pull "' + pictures[fileIndex].dataset.picUrl + '" "' + decodeURI(newDir) + '/' + convertToOutputFileName(pictures[fileIndex].dataset.picUrl) + '"';

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
            filesToBeExported.push(pictures[fileIndex]);
            fileIndex++;
            pb.finish(filesToBeExported.length);
            filesIndicator.innerHTML = filesToBeExported.length + '/' + pictures.length;

            if (fileIndex == pictures.length) {
              clearInterval(timer);
              pb.finish(pictures.length);
              dialog.closeAll();

              if (filesCanNotBeExported.length > 0) {
                //TODO: tell user some files can't be exported
                new AlertDialog(filesCanNotBeExported.length + " files can't be exported");
              }
            } else {
              doExportPicture();
            }
          };

          req.onerror = function(e) {
            filesCanNotBeExported.push(pictures[fileIndex]);
            fileIndex++;

            if (fileIndex == pictures.length) {
              clearInterval(timer);
              pb.finish(pictures.length);
              dialog.closeAll();

              if (filesCanNotBeExported.length > 0) {
                //TODO: tell user some files can't be exported
                new AlertDialog(filesCanNotBeExported.length + " files can't be exported");
              }
            } else {
              doExportPicture();
            }
          };
        }, 0);
      }, {
        title: _('export-picture-title'),
        fileType: 'Image'
      });
    });
  });

  return {
    init: init,
    addPicture: addPicture,
    updateRemovedPictures: updateRemovedPictures,
    checkGalleryIsEmpty: checkGalleryIsEmpty,
    selectAllPictures: selectAllPictures,
    removePictures: removePictures
  };
})();
