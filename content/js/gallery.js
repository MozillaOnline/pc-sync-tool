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
      var titles = threadContainer.getElementsByTagName('label');
      titles[0].innerHTML = '<span>' + threadId + ' (' + threadContainer.dataset.length + ')</span>';
    } else {
      threadContainer = document.createElement('div');
      threadContainer.setAttribute('id', 'pic-' + threadId);
      threadContainer.classList.add('picture-thread');
      var header = document.createElement('div');
      header.classList.add('header');
      threadContainer.appendChild(header);

      var title = document.createElement('label');
      header.appendChild(title);
      title.innerHTML = '<span>' + threadId + ' (' + 1 + ')</span>';
      container.appendChild(threadContainer);
      title.onclick = function onSelectThread(e) {
        var target = e.target;
        if (target instanceof HTMLLabelElement) {
          target.classList.toggle('thread-checked');
          var threadContainer = this.parentNode.parentNode;
          var checkboxes = $expr('.pic-unchecked', threadContainer);
          var picItems = $expr('li', threadContainer);

          if (target.classList.contains('thread-checked')) {
            threadContainer.dataset.checked = true;
            checkboxes.forEach(function(item) {
              item.classList.add('pic-checked');
            });

            picItems.forEach(function(item) {
              item.dataset.checked = true;
            });
          } else {
            threadContainer.dataset.checked = false;
            checkboxes.forEach(function(cb) {
              cb.classList.remove('pic-checked');
            });

            picItems.forEach(function(item) {
              item.dataset.checked = false;
            });
          }
          opStateChanged();
        }
      };

      var threadBody = document.createElement('ul');
      threadBody.classList.add('body');
      threadContainer.appendChild(threadBody);
      threadContainer.dataset.length = 1;
      threadContainer.dataset.checked = false;
      threadContainer.dataset.threadId = threadId;

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
      var thread = threadBody.parentNode;
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

    listItem.innerHTML = '<img src="' + picture.metadata.thumbnail + '">';

    var itemCheckbox = document.createElement('div');
    itemCheckbox.classList.add('pic-unchecked');
    listItem.appendChild(itemCheckbox);

    listItem.onclick = function item_click(e) {
      this.dataset.checked = itemCheckbox.classList.toggle('pic-checked');
      var threadBody = this.parentNode;
      var threadContainer = threadBody.parentNode;
      threadContainer.dataset.checked = $expr('.pic-checked', threadBody).length == threadContainer.dataset.length;
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
      var tip = document.createElement('div');
      tip.setAttribute('id', 'pic-tip');
      tip.classList.add('pic-tip');
      tip.style.top = (e.target.parentNode.offsetTop + 187 - $id('picture-list-container').scrollTop) + 'px';
      tip.style.left = (e.target.parentNode.offsetLeft + 515) + 'px';
      tip.innerHTML = '<div>name:' + this.dataset.title + '</div><div>date:' + parseDate(parseInt(this.dataset.date)) + '</div><div>size:' + toSizeInMB(this.dataset.size) + 'M' + '</div>';
      $id('gallery-view').appendChild(tip);
    };

    listItem.onmouseout = function(e) {
      var tip = $id('pic-tip');
      if (tip) {
        tip.parentNode.removeChild(tip);
      }
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
    $expr('#picture-list-container .picture-thread').forEach(function(group) {
      selectPicturesGroup(group, select);
    });

    opStateChanged();
  }

  function selectPicturesGroup(group, selected) {
    group.dataset.checked = selected;
    $expr('li', group).forEach(function(item) {
      item.dataset.checked = selected;
    });

    var threadCheckbox = group.getElementsByTagName('label')[0];

    if (!threadCheckbox) {
      return;
    }
    if (selected) {
      threadCheckbox.classList.add('thread-checked');
      $expr('.pic-unchecked', group).forEach(function(cb) {
        cb.classList.add('pic-checked');
      });
    } else {
      threadCheckbox.classList.remove('thread-checked');
      $expr('.pic-unchecked', group).forEach(function(cb) {
        cb.classList.remove('pic-checked');
      });
    }
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

    var dialog = new FilesOPDialog({
      title_l10n_id: 'remove-pictures-dialog-header',
      processbar_l10n_id: 'processbar-remove-pictures-prompt'
    });

    var filesIndicator = $id('files-indicator');
    var pb = $id('processbar');
    var ratio = 0;
    filesIndicator.innerHTML = '0/' + items.length;

    //processbar range for one file
    var range = Math.round(100 / items.length);
    var step = range / 50;
    var bTimer = false;

    setTimeout(function doRemovePicture() {
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
        ratio = Math.round(filesToBeRemoved.length * 100 / items.length);
        pb.style.width = ratio + '%';
        filesIndicator.innerHTML = filesToBeRemoved.length + '/' + items.length;

        if (fileIndex == items.length) {
          clearInterval(timer);
          pb.style.width = '100%';
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

    navigator.mozFFOSAssistant.selectMultiFilesFromDisk(function(state, data) {
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

      var dialog = new FilesOPDialog({
        title_l10n_id: 'import-pictures-dialog-header',
        processbar_l10n_id: 'processbar-import-pictures-promot'
      });

      var filesIndicator = $id('files-indicator');
      var pb = $id('processbar');
      var ratio = 0;
      filesIndicator.innerHTML = '0/' + pictures.length;

      var range = Math.round(100 / pictures.length);
      var step = range / 50;
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
          filesToBeImported.push(pictures[fileIndex]);
          fileIndex++;
          ratio = Math.round(filesToBeImported.length * 100 / pictures.length);
          pb.style.width = ratio + '%';
          filesIndicator.innerHTML = fileIndex + '/' + pictures.length;

          if (fileIndex == pictures.length) {
            clearInterval(timer);
            pb.style.width.innerHTML = '100%';
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
            pb.style.width.innerHTML = '100%';
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

      if (window.confirm(_('delete-pictures-confirm', {
        n: files.length
      }))) {
        Gallery.removePictures(files);
      }
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

      navigator.mozFFOSAssistant.selectDirectory(function(status, dir) {
        if (!status) {
          return;
        }
        var filesToBeExported = [];
        var filesCanNotBeExported = [];

        var fileIndex = 0;
        var oldFileIndex = 0;
        var steps = 0;

        var dialog = new FilesOPDialog({
          title_l10n_id: 'export-pictures-dialog-header',
          processbar_l10n_id: 'processbar-export-pictures-promot'
        });

        var filesIndicator = $id('files-indicator');
        var pb = $id('processbar');
        var ratio = 0;
        filesIndicator.innerHTML = '0/' + pictures.length;

        //processbar range for one file
        var range = Math.round(100 / pictures.length);
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

        setTimeout(function doExportPicture() {
          var cmd = 'adb pull "' + pictures[fileIndex].dataset.picUrl + '" "' + decodeURI(newDir) + '/' + convertToOutputFileName(pictures[fileIndex].dataset.picUrl) + '"';

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
            filesToBeExported.push(pictures[fileIndex]);
            fileIndex++;
            ratio = Math.round(filesToBeExported.length * 100 / pictures.length);
            pb.style.width = ratio + '%';
            filesIndicator.innerHTML = filesToBeExported.length + '/' + pictures.length;

            if (fileIndex == pictures.length) {
              clearInterval(timer);
              pb.style.width = '100%';
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
              pb.style.width = '100%';
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
