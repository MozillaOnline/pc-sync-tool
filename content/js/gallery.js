/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Gallery = (function() {
  function getListContainer() {
    return $id('picture-list-container');
  }

  // directory for caching pitures
  var galleryCachedDir = 'gallery_tmp';

  // Modify addonDir to the place on your PC
  // and set debug = 1 for debugging in html with firebug
  var addonDir = '/home/tiger/work/ffosassistant/'
  var debug = 1;

  if (debug) {
    var prePath = '';
  } else {
    var prePath = 'chrome://ffosassistant/content/';
  }

  function opStateChanged() {
    if ($expr('#picture-list-container .pictures-group').length == 0) {
      $id('selectAll-pictures').dataset.checked = false;
      $id('selectAll-pictures').dataset.disabled = true;
    } else {
      $id('selectAll-pictures').dataset.checked =
        $expr('#picture-list-container .pic-item-div').length ===
          $expr('#picture-list-container .pic-item-div[data-checked="true"]').length;
      $id('selectAll-pictures').dataset.disabled = false;
    }

    $id('remove-pictures').dataset.disabled =
      $expr('#picture-list-container .pic-item-div[data-checked="true"]').length === 0;
    $id('export-pictures').dataset.disabled =
      $expr('#picture-list-container .pic-item-div[data-checked="true"]').length === 0;
  }

  function checkGalleryIsEmpty() {
    var isEmpty = $expr('#picture-list-container .pic-item-div').length === 0 ;
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

  var dataPool = {
    dataList:[],
    groupedData:[]
  };

  var currentGroupIndex;
  var currentPictureIndex;

  function initList(pictures) {
    var container = getListContainer();
    container.innerHTML = '';
    showEmptyGallery(false);
    dataPool.dataList = pictures;
    dataPool.groupedData = [];
    makeGroup();
    sortGroup();
    var index = 0;
    setTimeout(function getGalleryGoups() {
      if (index == dataPool.groupedData.length) {
        checkGalleryIsEmpty();
        opStateChanged();
        return;
      }

      var group = dataPool.groupedData[index];
      var groupItem = document.createElement('div');
      groupItem.classList.add('pictures-group');
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
      setTimeout(function getGoupPictures() {
        if (position == group.data.length) {
          titleDiv.onclick = function selectGroup(event) {
            var target = event.target;
            if (target instanceof HTMLLabelElement) {
              target.classList.toggle('group-checked');
              var groupContainer = this.parentNode;
              var checkboxes = $expr('.pic-unchecked',groupContainer);
              var picDivs = $expr('.pic-item-div',groupContainer);

              if (target.classList.contains('group-checked')) {
                groupContainer.dataset.checked = true;
                checkboxes.forEach(function(item) {
                  item.classList.add('pic-checked');
                });

                picDivs.forEach(function(div) {
                  div.dataset.checked = true;
                });
              } else {
                groupContainer.dataset.checked = false;
                checkboxes.forEach(function(item) {
                  item.classList.remove('pic-checked');
                });

                picDivs.forEach(function(div) {
                  div.dataset.checked = false;
                });
              }
              opStateChanged();
            }
          };
          index++;
          getGalleryGoups();
          return;
        }

        navigator.mozFFOSAssistant.getDirInTmp(['extensions', 'ffosassistant@mozillaonline.com', 'content', galleryCachedDir], function(path) {
          if (debug) {
            var cmd = 'adb pull "' + group.data[position].name + '" "' + addonDir + 'content/' + galleryCachedDir + group.data[position].name + '"';
          } else {
            var cmd = 'adb pull "' + group.data[position].name + '" "' + path + group.data[position].name + '"';
          }
          var req = navigator.mozFFOSAssistant.runCmd(cmd);

          req.onsuccess = function on_success(result) {
            var div = document.createElement('div');
            div.classList.add('pic-item-div');
            div.dataset.checked = 'false';
            div.dataset.picUrl = group.data[position].name;
            div.dataset.groupIndex = index;
            div.dataset.position = position;
            groupBody.appendChild(div);

            var picture = document.createElement('div');
            picture.classList.add('pic-item');
            picture.innerHTML = '<img src="' + prePath + galleryCachedDir + group.data[position].name + '">';
            div.appendChild(picture);
            var checkboxDiv = document.createElement('div');
            checkboxDiv.classList.add('pic-unchecked');
            div.appendChild(checkboxDiv);

            checkboxDiv.onclick = function select_pic(event) {
              this.classList.toggle('pic-checked');
              var picDiv = this.parentNode;

              if (this.classList.contains('pic-checked')) {
                picDiv.dataset.checked = 'true';
              } else {
                picDiv.dataset.checked = 'false';
              }

              var groupBody = this.parentNode.parentNode;
              var groupContainer = groupBody.parentNode;
              var labels = groupContainer.getElementsByTagName('label');
              if ($expr('.pic-checked', groupBody).length == groupContainer.dataset.length) {
                labels[0].classList.add('group-checked');
                groupContainer.dataset.checked = true;
              } else {
                labels[0].classList.remove('group-checked');
                groupContainer.dataset.checked = false;
              }
              opStateChanged();
            };

            picture.onclick = function (event) {
              var target = event.target;
              if (target instanceof HTMLImageElement) {
                var picDiv = this.parentNode;
                currentGroupIndex = picDiv.dataset.groupIndex;
                currentPictureIndex = picDiv.dataset.position;
                var dialog = new ShowPicDialog({
                  picUrl: prePath + galleryCachedDir + picDiv.dataset.picUrl,
                  showPreviousPic: showPreviousPic,
                  showNextPic: showNextPic
                });
              }
            };
            position++;
            getGoupPictures();
          };

          req.onerror = function on_error(result) {
            position++;
            getGoupPictures();
          };
        });
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

  function showPreviousPic() {
    var pic = $id('pic-content');

    if (currentPictureIndex == 0) {
      if (currentGroupIndex == 0) {
        currentGroupIndex = dataPool.groupedData.length - 1;
        currentPictureIndex = dataPool.groupedData[currentGroupIndex].data.length - 1;
      } else {
        currentGroupIndex--;
        currentPictureIndex = dataPool.groupedData[currentGroupIndex].data.length - 1;
      }
    } else {
      currentPictureIndex--;
    }

    var previouseUrl = prePath + galleryCachedDir + dataPool.groupedData[currentGroupIndex].data[currentPictureIndex].name;
    pic.setAttribute('src', previouseUrl);
  }

  function showNextPic() {
    var pic = $id('pic-content');

    if (currentPictureIndex == dataPool.groupedData[currentGroupIndex].data.length - 1) {
      currentPictureIndex = 0;
      if (currentGroupIndex == dataPool.groupedData.length - 1) {
        currentGroupIndex = 0;
      } else {
        currentGroupIndex++;
      }
    } else {
      currentPictureIndex++;
    }

    var previouseUrl = prePath + galleryCachedDir + dataPool.groupedData[currentGroupIndex].data[currentPictureIndex].name;
    pic.setAttribute('src', previouseUrl);
  }

  function selectAllPictures(select) {
    $expr('#picture-list-container .pictures-group').forEach(function(group) {
      selectPicturesGroup(group, select);
    });

    opStateChanged();
  }

  function selectPicturesGroup(group, selected) {
    group.dataset.checked = selected;
    $expr('.pic-item-div', group).forEach(function(picDiv) {
      picDiv.dataset.checked = selected;
    });

    var groupCheckbox = $expr('.group-unckecked', group)[0];

    if (groupCheckbox) {
      if (selected) {
        groupCheckbox.classList.add('group-checked');
        $expr('.pic-unchecked', group).forEach(function(picCheckbox) {
          picCheckbox.classList.add('pic-checked');
        });
      } else {
        groupCheckbox.classList.remove('group-checked');
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
      var picDiv = $expr('.pic-item-div[data-pic-url="' + filesToBeRemoved[i] + '"]')[0];
      if (picDiv) {
        var groupBody = picDiv.parentNode;
        groupBody.removeChild(picDiv);
        var group = groupBody.parentNode;
        var groupId = group.dataset.groupId;
        var groupData = findGroupById(groupId);
        if (groupData) {
          for (var j = 0; j < groupData.data.length; j++) {
            if (groupData.data[j].name  == picDiv.dataset.picUrl) {
              groupData.data.splice(j ,1);
              if (groupData.data.length == 0) {
                removeGroup(groupData);
              }
              break;
            }
          }
        }
        if ($expr('.pic-item-div', groupBody).length == 0) {
          getListContainer().removeChild(group);
        }
      }
    }
  }

  function importPictures() {
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

      var files = [];
      $expr('#picture-list-container .pic-item-div[data-checked="true"]').forEach(function(item) {
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

      var pictures = $expr('#picture-list-container .pic-item-div[data-checked="true"]');

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
            var cmd = 'adb pull "' + pictures[fileIndex].dataset.picUrl + '" "' + decodeURI(newDir) + pictures[fileIndex].dataset.picUrl + '"';

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
    init: initList,
    selectAllPictures: selectAllPictures,
    removePictures: removePictures
  };
})();
