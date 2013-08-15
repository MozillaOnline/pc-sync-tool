/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var Gallery = (function() {
  function getListContainer() {
    return $id('picture-list-container');
  }

  // directory for caching pitures
  var galleryCachedDir = 'gallery_tmp';

  //switch between addon and html debugging
  let debug = 1;
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
    //TODO: show empty gallery
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
    dataPool.dataList = pictures;
    dataPool.groupedData = [];
    makeGroup();
    sortGroup();
    var index = 0;
    setTimeout(function getGalleryGoups() {
      if (index == dataPool.groupedData.length) {
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
          var cmd = 'adb pull "' + group.data[position].name + '" "' + path + group.data[position].name + '"';
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
        ratio = Math.round(fileIndex * 100 / items.length);
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

          filesToBeRemoved.forEach(function(file) {
            var picDiv = $expr('.pic-item-div[data-pic-url="' + file + '"]')[0];
            if (picDiv) {
              var parent = picDiv.parentNode;
              parent.removeChild(picDiv);
              if ($expr('.pic-item-div', parent).length == 0) {
                var group = parent.parentNode;
                getListContainer().removeChild(group);
              }
            }
          });
        } else {
          removePicture();
        }
      };

      req.onerror = function (e) {
        filesCanNotBeRemoved.push(items[fileIndex]);
        fileIndex++;
        if (fileIndex == items.length) {
          clearInterval(timer);
          pb.style.width = '100%';
          dialog.closeAll();

          //updating UI after removing pictures
          if (filesCanNotBeRemoved.length > 0) {
            //TODO: tell user some files can't be removed
            alert(filesCanNotBeRemoved.length + " files can't be removed");
          }
          filesToBeRemoved.forEach(function(file) {
            var picDiv = $expr('.pic-item-div[data-pic-url="' + file + '"]')[0];
            if (picDiv) {
              var parent = picDiv.parentNode;
              parent.removeChild(picDiv);
              if ($expr('.pic-item-div', parent).length == 0) {
                var group = parent.parentNode;
                getListContainer().removeChild(group);
              }
            }
          });
        } else {
          removePicture();
        }
      };
    }, 0);
  }

  function importPictures() {
    navigator.mozFFOSAssistant.selectMultiFilesFromDisk(function (state, data) {
      data = data.substr(0,data.length-1);
      var pictures = data.split(';');
      var importedNum = 0;
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

      if (pictures.length > 0) {
        var range = Math.round(100 / pictures.length);
        var step = range / 50;
        var bTimer = false;
         for (var index = 0; index < pictures.length; index++) {
          var cmd = 'adb push "' + pictures[index] + '" /sdcard/DCIM/';
          var req = navigator.mozFFOSAssistant.runCmd(cmd);
          if (!bTimer) {
            bTimer = true;
            var timer = setInterval(function() {
              if (oldFileIndex == importedNum) {
                if (steps < 50) {
                  steps++;
                  ratio+= step;
                  pb.style.width = ratio + '%';
                }
              } else {
                oldFileIndex = importedNum;
                steps = 0;
              }
            },100);
          }

          req.onsuccess = req.onerror= function(e) {
            importedNum++;
            ratio = Math.round(importedNum * 100 / pictures.length);
            pb.style.width = ratio + '%';
            filesIndicator.innerHTML = importedNum + '/' + pictures.length;
            if (importedNum == pictures.length) {
              clearInterval(timer);
              pb.style.width.innerHTML = '100%';
              dialog.closeAll();
              FFOSAssistant.getAndShowGallery();
            }
          };
        }
      }
    });
    selectAllPictures(false);
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

    $id('remove-pictures').addEventListener('click', function onclick_removeMusic(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      var files = [];
      $expr('#picture-list-container .pic-item-div[data-checked="true"]').forEach(function(item) {
        files.push(item.dataset.picUrl);
      });

      if (window.confirm(_('delete-musics-confirm', {n: files.length}))) {
        Gallery.removePictures(files);
      }
    });

    $id('refresh-pictures').addEventListener('click', function onclick_refreshMusics(event) {
      FFOSAssistant.getAndShowGallery();
    });

    //$id('import-picturess-btn').addEventListener('click', importMusics);

    $id('import-pictures').addEventListener('click', importPictures);

    $id('export-pictures').addEventListener('click', function onclick_exportPictures(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }
      var pictures = $expr('#picture-list-container .pic-item-div[data-checked="true"]');
      navigator.mozFFOSAssistant.selectDirectory(function(status, dir) {
        if (status) {
          setTimeout(function() {
            var length = pictures.length;
            var index = 0;

            function traverseList() {
              if (index == length) {
                return;
              }
              var cmd = 'adb pull "' + pictures[index].dataset.picUrl + '" "' + decodeURI(dir) + pictures[index].dataset.picUrl + '"';
              var req = navigator.mozFFOSAssistant.runCmd(cmd);
              req.onsuccess = req.onerror= function(e) {
                index++;
                setTimeout(traverseList, 0);
              }
            }
            traverseList();
          }, 0);
        }
      }, {
        title: 'Choose where to save'
      });
    selectAllPictures(false);
    });
  });

  return {
    init: initList,
    selectAllPictures: selectAllPictures,
    removePictures: removePictures
  };
})();
