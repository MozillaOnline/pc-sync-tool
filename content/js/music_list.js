/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

  //function retriveTimeSpan() {}

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

  function retriveSize(size) {
    return Math.round(100 * size / 1024 / 1024) / 100;
  }

  function createMusicListItem(music, index) {
    var html = '';
    html += '<label class="unchecked"></label>';
    html += '<div class="music-names item"><span>' + retriveName(music.name) + '</span></div>';
    html += '<div class="music-singer item"><span>' + music.metadate.artist + '</span></div>';
    html += '<div class="music-album item"><span>' + music.metadate.album + '</span></div>';
    html += '<div class="music-timespan item"><span>' + '5:05' + '</span></div>';
    html += '<div class="music-type item"><span>' + retriveExtension(music.name) + '</span></div>';
    html += '<div class="music-size item"><span>' + retriveSize(music.size) + ' MB' + '</span></div>';

    var elem = document.createElement('div');
    elem.classList.add('music-header');
    elem.classList.add('music-list-item');
    if (index % 2) {
      elem.classList.add('odd');
    } else {
      elem.classList.add('even');
    }
    elem.innerHTML = html;

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
    elem.setAttribute('id', music.name);
    return elem;
  }

  function toggleMusicItem(elem) {
    var item = $expr('label.unchecked', elem)[0];
    if (item) {
      item.classList.toggle('checked');
    }
    if (item.classList.contains('checked')) {
      elem.dataset.checked = true;
    } else {
      elem.dataset.checked = false;
    }
    opStateChanged();
  }

  function opStateChanged() {
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
    $id('export-musics').dataset.disabled =
      $expr('#music-list-container .music-list-item[data-checked="true"]').length === 0;
  }

  function musicItemClicked(elem) {
    $expr('#music-list-container .music-list-item[data-checked="true"]').forEach(function(e) {
      if (e != elem) {
        e.dataset.checked = false;
        var item = $expr('label.unchecked', e)[0];
        if (item) {
          item.classList.remove('checked');
        }
      }
    });

    item = $expr('label.unchecked', elem)[0];
    if (item) {
      item.classList.add('checked');
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

  function checkIfMusicListEmpty() {
    var isEmpty = $expr('#music-list-container .music-list-item').length === 0 ;
    if (isEmpty) {
      $id('selectAll-musics').dataset.disabled = true;
      showEmptyMusics(true);
    } else {
      $id('selectAll-musics').dataset.disabled = false;
      showEmptyMusics(false);
    }
  }

  function showEmptyMusics(bFlag) {
    if (bFlag) {
      $id('empty-music-container').style.display = 'block';
    } else {
      $id('empty-music-container').style.display = 'none';
    }
  }

  var groupedList = null;

  function initList(musics) {
    var container = getListContainer();
    container.innerHTML = '';
    var index = 0;
    musics.forEach(function(music) {
      var listItem = createMusicListItem(music, index);
      container.appendChild(listItem);
      index++;
    });
    checkIfMusicListEmpty();
  }

  function selectAllMusics(select) {
    $expr('#music-list-container .music-list-item').forEach(function(item) {
      selectMusicItem(item, select);
    });

    opStateChanged();
  }

  function selectMusicItem(elem, selected) {
    var item = $expr('label.unchecked', elem)[0];
    if (item) {
      if (selected) {
        item.classList.add('checked');
        elem.dataset.checked = true;
      } else {
        item.classList.remove('checked');
        elem.dataset.checked = false;
      }
    }
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

  function removeMusic(files) {
    var items = files || [];
    var toBeRemovedFiles = [];
    var index = 0;
    items.forEach(function(item) {
      var req = navigator.mozFFOSAssistant.runCmd('adb shell rm ' + item);
      req.onsuccess = function (result) {
        toBeRemovedFiles.push(item);
        index++;
        if (index == items.length) {
          updateMusicsList(toBeRemovedFiles);
        }
      }
      req.onerror = function(e) {
        index++;
        if (index == items.length) {
          updateMusicsList(toBeRemovedFiles);
        }
        alert('error occured when removing ' + item);
      }
    });
  }

  function updateMusicsList(toBeRemovedFiles) {
    var container = $id('music-list-container');
    toBeRemovedFiles.forEach(function(item) {
      var music = $id(item);
      container.removeChild(music);
    });
    var musics = $expr('#music-list-container .music-list-item');
    for (var index = 0; index < musics.length; index++) {
      if (index % 2) {
        if (musics[index].classList.contains('even')) {
          musics[index].classList.remove('even');
        }
        musics[index].classList.add('odd');
      } else {
        if (musics[index].classList.contains('odd')) {
          musics[index].classList.remove('odd');
        }
        musics[index].classList.add('even');
      }
    }
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-musics').addEventListener('click', function sall_onclick(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      if (this.dataset.checked == "false") {
        selectAllMusics(true);
      } else {
        selectAllMusics(false);
      }
    });

    $id('remove-musics').addEventListener('click', function onclick_removeMusic(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var files = [];
      $expr('#music-list-container .music-list-item[data-checked="true"]').forEach(function(item) {
        files.push(JSON.parse(item.dataset.music).name);
      });

      if (window.confirm(_('delete-musics-confirm', {n: files.length}))) {
        MusicList.removeMusic(files);
      }
    });

    $id('refresh-musics').addEventListener('click', function onclick_refreshMusics(event) {
      FFOSAssistant.getAndShowAllMusics();
    });

    $id('import-musics').addEventListener('click', function onclick_importMusics(event) {
      alert('import musics');
    });

    $id('export-musics').addEventListener('click', function onclick_exportMusics(event) {
      var musics = [];
      $expr('#music-list-container div.selected').forEach(function(item) {
        var e = {};
        e.music = JSON.parse(item.dataset.music);
        e.name = item.dataset.name + '.' + item.dataset.type;
        musics.push(e);
      });
      navigator.mozFFOSAssistant.selectDirectory(function(status, dir) {
        if (status) {
          setTimeout(function() {
            var length = musics.length;
            var index = 0;

            function traverseList() {
              if (index == length) {
                return;
              }
              var cmd = 'adb pull ' + musics[index].music.name + ' ' + dir + '/' + musics[index].name;
              var req = navigator.mozFFOSAssistant.runCmd(cmd);
              req.onsuccess = function(e) {
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
    });
  });

  return {
    init: initList,
    getMusic: getMusic,
    selectAllMusics: selectAllMusics,
    removeMusic: removeMusic
  };
})();