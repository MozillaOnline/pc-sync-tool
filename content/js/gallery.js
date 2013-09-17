/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Gallery = (function() {
  function getListContainer() {
    return $id('picture-list-container');
  }

  function convertFileName(str) {
    var obj = {
      folder: '',
      file: ''
    };

    var index = str.lastIndexOf('/');
    if (index < 0) {
      obj.file = str;
      return obj;
    }

    obj.file = str.substr(index + 1);
    str = str.substr(0, index);

    index = str.lastIndexOf('/');
    if (index >= 0) {
      obj.folder = str.substr(index + 1);
    }
    return obj;
  }

  function parseName(str) {
    var s = '';
    var index = str.lastIndexOf('/');
    if (index != -1) {
      s = str.substr(index + 1);
    }
    return s;
  }

  function parseSize(size) {
    var retSize = size / 1024 /10.24;
    return parseInt(retSize) / 100;
  }

  function parseDate(date) {
    var dt = new Date(date);
    var strDate = dt.getFullYear() + '-';

    if (dt.getMonth() < 9) {
      strDate += '0' + (dt.getMonth() + 1) + '-';
    } else {
      strDate += (dt.getMonth() + 1) + '-';
    }
    if(dt.getDay() < 9) {
      strDate += '0' + (dt.getDay() + 1);
    } else {
      strDate += dt.getDay() + 1;
    }
    return strDate;
  }

  // directory for caching pitures
  var galleryCachedDir = 'gallery_tmp';
  var addonDir = '/home/tiger/work/ffosassistant/'

  // Modify addonDir to the place on your PC
  // and set debug = 1 for debugging in html with firebug
  var debug = 1;

  if (debug) {
    var prePath = '';
  } else {
    var prePath = 'chrome://ffosassistant/content/';
  }

  function init() {
    getListContainer().innerHTML = '';
    showEmptyGallery(false);
  }

  function addPicture(picture) {
    if (!picture) {
      return;
    }
    _addToPictureList(picture);
  }

  function removePicture(pictures) {
    if (!pictures || !pictures.length || pictures.length < 1) {
      return;
    }
    removePicturesProcess(pictures);
  }

  function updateUI() {
    var pictureList = $expr('#picture-list-container li');
    if (pictureList.length == 0) {
      showEmptyGallery(true);
    }
  }

  function _addToPictureList(picture) {
    var threadId = parseDate(parseInt(picture.date));
    var threadContainer = $id('pic-' + threadId);
    var container = getListContainer();
    if (threadContainer) {
      var threadBody = threadContainer.getElementsByTagName('ul')[0];
      threadBody.appendChild(_createPictureListItem(picture));
      threadContainer.dataset.length = 1 + parseInt(threadContainer.dataset.length);
      var titles = $expr('.title', threadContainer);
      titles[0].innerHTML = '<span>' + threadId + ' (' + threadContainer.dataset.length + ')</span>';
    } else {
      threadContainer = document.createElement('div');
      threadContainer.setAttribute('id', 'pic-' + threadId);
      threadContainer.classList.add('picture-thread');
      var header = document.createElement('div');
      header.classList.add('header');
      threadContainer.appendChild(header);

      var title = document.createElement('label');
      title.classList.add('title');
      header.appendChild(title);
      title.innerHTML = '<span>' + threadId + ' (' + 1 + ')</span>';
      container.appendChild(threadContainer);
      title.onclick = function onSelectGroup(e) {
        var target = e.target;
        if (target instanceof HTMLLabelElement) {
          target.classList.toggle('thread-checked');
          var threadContainer = this.parentNode.parentNode;
          var checkboxes = $expr('.pic-unchecked',threadContainer);
          var picItems = $expr('li',threadContainer);

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

  function _createPictureListItem(picture) {
      var listItem = document.createElement('li');
      listItem.dataset.checked = 'false';
      listItem.dataset.picUrl = picture.name;
      listItem.dataset.title = parseName(picture.name);
      listItem.dataset.date = picture.date;
      listItem.dataset.size = picture.size;

      listItem.innerHTML = '<img src="' + picture.metadata.thumbnail + '">';

      var itemCheckbox = document.createElement('div');
      itemCheckbox.classList.add('pic-unchecked');
      listItem.appendChild(itemCheckbox);

      listItem.onclick = function item_click(e) {
        itemCheckbox.classList.toggle('pic-checked');

        if (itemCheckbox.classList.contains('pic-checked')) {
          this.dataset.checked = 'true';
        } else {
          this.dataset.checked = 'false';
        }

        var threadBody = this.parentNode;
        var threadContainer = threadBody.parentNode;
        var labels = threadContainer.getElementsByTagName('label');
        if ($expr('.pic-checked', threadBody).length == threadContainer.dataset.length) {
          labels[0].classList.add('thread-checked');
          threadContainer.dataset.checked = true;
        } else {
          labels[0].classList.remove('thread-checked');
          threadContainer.dataset.checked = false;
        }
        opStateChanged();
      };
      listItem.ondblclick = function (e) {
        var tip = $id('pic-tip');
        if (tip) {
          tip.parentNode.removeChild(tip);
        }
        var self = this;
        navigator.mozFFOSAssistant.getDirInTmp(['extensions', 'ffosassistant@mozillaonline.com', 'content', galleryCachedDir], function(path) {
          if (debug) {
            var cmd = 'adb pull "' + self.dataset.picUrl + '" "' + addonDir + 'content/' + galleryCachedDir + self.dataset.picUrl + '"';
          } else {
            var cmd = 'adb pull "' + self.dataset.picUrl + '" "' + path + self.dataset.picUrl + '"';
          }
          var req = navigator.mozFFOSAssistant.runCmd(cmd);

          req.onsuccess = function on_success(result) {
            var dialog = new ShowPicDialog({
              cachedUrl: prePath + galleryCachedDir + self.dataset.picUrl,
              picUrl: self.dataset.picUrl,
              showPreviousPic: showPreviousPic,
              showNextPic: showNextPic
            });
          };
          req.onerror = function on_error(e) {
            alert("Can't pull picture to cache");
          };
        });
      };
      listItem.onmouseover = function(e) {
        var tip = document.createElement('div');
        tip.setAttribute('id', 'pic-tip');
        tip.classList.add('pic-tip');
        tip.style.top = (e.target.parentNode.offsetTop + 247 - $id('picture-list-container').scrollTop) + 'px';
        tip.style.left = (e.target.parentNode.offsetLeft + 595) + 'px';
        tip.innerHTML = '<div>name:' + this.dataset.title + '</div><div>date:'
                         + parseDate(parseInt(this.dataset.date)) + '</div><div>size:'
                         + parseSize(this.dataset.size) + 'M' + '</div>';
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

  function opStateChanged() {
    if ($expr('#picture-list-container .picture-thread').length == 0) {
      $id('selectAll-pictures').dataset.checked = false;
      $id('selectAll-pictures').dataset.disabled = true;
    } else {
      $id('selectAll-pictures').dataset.checked =
        $expr('#picture-list-container li').length ===
          $expr('#picture-list-container li[data-checked="true"]').length;
      $id('selectAll-pictures').dataset.disabled = false;
    }

    $id('remove-pictures').dataset.disabled =
      $expr('#picture-list-container li[data-checked="true"]').length === 0;
    $id('export-pictures').dataset.disabled =
      $expr('#picture-list-container li[data-checked="true"]').length === 0;
  }

  function checkGalleryIsEmpty() {
    var isEmpty = $expr('#picture-list-container li').length === 0 ;
    if (isEmpty) {
      $id('selectAll-pictures').dataset.disabled = true;
      showEmptyGallery(true);
    } else {
      $id('selectAll-pictures').dataset.disabled = false;
      showEmptyGallery(false);
    }
  }

  function showEmptyGallery(bFlag) {
    if (bFlag) {
      $id('empty-picture-container').style.display = 'block';
    } else {
      $id('empty-picture-container').style.display = 'none';
    }

  }

  function showPreviousPic() {
    var picList = $expr('li', getListContainer());
    var pic = $id('pic-content');
   
    for (var i = 0; i < picList.length; i++) {
      if (picList[i].dataset.picUrl == pic.dataset.picUrl) {
        if (i == 0) {
          var previouseUrl = prePath + galleryCachedDir + picList[picList.length -1].dataset.picUrl;
          pic.dataset.picUrl = picList[picList.length -1].dataset.picUrl;
          //TODO: check if picture cached
          navigator.mozFFOSAssistant.getDirInTmp(['extensions', 'ffosassistant@mozillaonline.com', 'content', galleryCachedDir], function(path) {
            if (debug) {
              var cmd = 'adb pull "' + picList[picList.length -1].dataset.picUrl + '" "' + addonDir + 'content/' + galleryCachedDir + picList[picList.length -1].dataset.picUrl + '"';
            } else {
              var cmd = 'adb pull "' + picList[picList.length -1].dataset.picUrl + '" "' + path + picList[picList.length -1].dataset.picUrl + '"';
            }
            var req = navigator.mozFFOSAssistant.runCmd(cmd);

            req.onsuccess = function on_success(result) {
              pic.setAttribute('src', previouseUrl);
            };
            req.onerror = function on_error(e) {
              alert("Can't pull picture to cache");
            };
          });
        } else {
          var previouseUrl = prePath + galleryCachedDir + picList[i-1].dataset.picUrl;
          pic.dataset.picUrl = picList[i -1].dataset.picUrl;
          //TODO: check if picture cached
          navigator.mozFFOSAssistant.getDirInTmp(['extensions', 'ffosassistant@mozillaonline.com', 'content', galleryCachedDir], function(path) {
            if (debug) {
              var cmd = 'adb pull "' + picList[i -1].dataset.picUrl + '" "' + addonDir + 'content/' + galleryCachedDir + picList[i -1].dataset.picUrl + '"';
            } else {
              var cmd = 'adb pull "' + picList[i -1].dataset.picUrl + '" "' + path + picList[i -1].dataset.picUrl + '"';
            }
            var req = navigator.mozFFOSAssistant.runCmd(cmd);

            req.onsuccess = function on_success(result) {
              pic.setAttribute('src', previouseUrl);
            };
            req.onerror = function on_error(e) {
              alert("Can't pull picture to cache");
            };
          });
        }
        break;
      }
    }
  }

  function showNextPic() {
    var picList = $expr('li', getListContainer());
    var pic = $id('pic-content');

    for (var i = 0; i < picList.length; i++) {
      if (picList[i].dataset.picUrl == pic.dataset.picUrl) {
        if (i == picList.length -1) {
          var nextUrl = prePath + galleryCachedDir + picList[0].dataset.picUrl;
          pic.dataset.picUrl = picList[0].dataset.picUrl;
          //TODO: check if picture cached
          navigator.mozFFOSAssistant.getDirInTmp(['extensions', 'ffosassistant@mozillaonline.com', 'content', galleryCachedDir], function(path) {
            if (debug) {
              var cmd = 'adb pull "' + picList[0].dataset.picUrl + '" "' + addonDir + 'content/' + galleryCachedDir + picList[0].dataset.picUrl + '"';
            } else {
              var cmd = 'adb pull "' + picList[0].dataset.picUrl + '" "' + path + picList[0].dataset.picUrl + '"';
            }
            var req = navigator.mozFFOSAssistant.runCmd(cmd);

            req.onsuccess = function on_success(result) {
              pic.setAttribute('src', nextUrl);
            };
            req.onerror = function on_error(e) {
              alert("Can't pull picture to cache");
            };
          });
        } else {
          var nextUrl = prePath + galleryCachedDir + picList[i+1].dataset.picUrl;
          pic.dataset.picUrl = picList[i+1].dataset.picUrl;
          //TODO: check if picture cached
          navigator.mozFFOSAssistant.getDirInTmp(['extensions', 'ffosassistant@mozillaonline.com', 'content', galleryCachedDir], function(path) {
            if (debug) {
              var cmd = 'adb pull "' + picList[i+1].dataset.picUrl + '" "' + addonDir + 'content/' + galleryCachedDir + picList[i+1].dataset.picUrl + '"';
            } else {
              var cmd = 'adb pull "' + picList[i+1].dataset.picUrl + '" "' + path + picList[i+1].dataset.picUrl + '"';
            }
            var req = navigator.mozFFOSAssistant.runCmd(cmd);

            req.onsuccess = function on_success(result) {
              pic.setAttribute('src', nextUrl);
            };
            req.onerror = function on_error(e) {
              alert("Can't pull picture to cache");
            };
          });
        }
        break;
      }
    }

  }

  function selectAllPictures(select) {
    $expr('#picture-list-container .picture-thread').forEach(function(group) {
      selectPicturesGroup(group, select);
    });

    opStateChanged();
  }

  function selectPicturesGroup(group, selected) {
    group.dataset.checked = selected;
    $expr('li', group).forEach(function(picDiv) {
      picDiv.dataset.checked = selected;
    });

    var groupCheckbox = $expr('.title', group)[0];

    if (groupCheckbox) {
      if (selected) {
        groupCheckbox.classList.add('thread-checked');
        $expr('.pic-unchecked', group).forEach(function(picCheckbox) {
          picCheckbox.classList.add('pic-checked');
        });
      } else {
        groupCheckbox.classList.remove('thread-checked');
        $expr('.pic-unchecked', group).forEach(function(picCheckbox) {
          picCheckbox.classList.remove('pic-checked');
        });
      }
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
      processbar_l10n_id: 'processbar-remove-pictures-promot' 
    });

    var filesIndicator = $id('files-indicator');
    var pb = $id('processbar');
    var ratio = 0;
    filesIndicator.innerHTML = '0/' + items.length;

    //processbar range for one file
    var range = Math.round(100 / items.length);
    var step = range / 50;
    var bTimer = false;

    setTimeout(function removePicture() {
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

          //updating UI after removing pictures
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            alert(filesCanNotBeRemoved.length + " files can't be removed");
          }

          removePicturesProcess(filesToBeRemoved);
          checkGalleryIsEmpty();
          opStateChanged();
        } else {
          removePicture();
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

          //updating UI after removing pictures
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            alert(filesCanNotBeRemoved.length + " files can't be removed");
          }

          removePicturesProcess(filesToBeRemoved);
          checkGalleryIsEmpty();
          opStateChanged();
        } else {
          removePicture();
        }
      };
    }, 0);
  }

  function removePicturesProcess(filesToBeRemoved) {
    for (var i = 0; i < filesToBeRemoved.length; i++) {
      var pic = $expr('li[data-pic-url="' + filesToBeRemoved[i] + '"]')[0];
      if (pic) {
        var threadBody = pic.parentNode;
        threadBody.removeChild(pic);
        var thread = threadBody.parentNode;
        
        if ($expr('li', threadBody).length == 0) {
          getListContainer().removeChild(thread);
        }
      }
    }
  }

  function importPictures() {
    if (navigator.mozFFOSAssistant.isWifiConnect) {
      new WifiModePromptDialog({title_l10n_id: 'import-pictures-dialog-header',
                               prompt_l10n_id: 'wifi-mode-import-pictures-promot'});
      return;
    }

    navigator.mozFFOSAssistant.selectMultiFilesFromDisk(function (state, data) {
      data = data.substr(0,data.length-1);
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

      setTimeout(function importPicture() {
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
              alert(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing gallery
            FFOSAssistant.getAndShowGallery();
          } else {
            importPicture();
          }
        };

        req.onerror = function (e) {
          filesCanNotBeImported.push(pictures[fileIndex]);
          fileIndex++;

          if (fileIndex == pictures.length) {
            clearInterval(timer);
            pb.style.width.innerHTML = '100%';
            dialog.closeAll();

            if (filesCanNotBeImported.length > 0) {
              //TODO: tell user some files can't be imported
              alert(filesCanNotBeImported.length + " files can't be imported");
            }
            //TODO: update imported files insteadof refreshing gallery
            FFOSAssistant.getAndShowGallery();
          } else {
            importPicture();
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
      if (this.dataset.checked == "false") {
        selectAllPictures(true);
      } else {
        selectAllPictures(false);
      }
    });

    $id('remove-pictures').addEventListener('click', function onclick_removePictures(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      if (navigator.mozFFOSAssistant.isWifiConnect) {
        new WifiModePromptDialog({title_l10n_id: 'remove-pictures-dialog-header',
                                 prompt_l10n_id: 'wifi-mode-remove-pictures-promot'});
        return;
      }

      var files = [];
      $expr('#picture-list-container li[data-checked="true"]').forEach(function(item) {
        files.push(item.dataset.picUrl);
      });

      if (window.confirm(_('delete-pictures-confirm', {n: files.length}))) {
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
        new WifiModePromptDialog({title_l10n_id: 'export-pictures-dialog-header',
                                 prompt_l10n_id: 'wifi-mode-export-pictures-promot'});
        return;
      }

      var pictures = $expr('#picture-list-container li[data-checked="true"]');

      if (pictures.length <= 0 ) {
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

          setTimeout(function exportPicture() {
            var obj = convertFileName(pictures[fileIndex].dataset.picUrl);
            var cmd = 'adb pull "' + pictures[fileIndex].dataset.picUrl + '" "' + decodeURI(newDir) + '/' + obj.folder + '_' + obj.file + '"';

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
                  alert(filesCanNotBeExported.length + " files can't be exported");
                }
              } else {
                exportPicture();
              }
            };

            req.onerror = function (e) {
              filesCanNotBeExported.push(pictures[fileIndex]);
              fileIndex++;

              if (fileIndex == pictures.length) {
                clearInterval(timer);
                pb.style.width = '100%';
                dialog.closeAll();

                if (filesCanNotBeExported.length > 0) {
                  //TODO: tell user some files can't be exported
                  alert(filesCanNotBeExported.length + " files can't be exported");
                }
              } else {
                exportPicture();
              }
            };
          }, 0);
        }
      }, {
        title: _('export-picture-title'),
        fileType: 'Image'
      });
    });
  });

  return {
    init: init,
    addPicture: addPicture,
    removePicture: removePicture,
    updateUI: updateUI,
    selectAllPictures: selectAllPictures,
    removePictures: removePictures
  };
})();
