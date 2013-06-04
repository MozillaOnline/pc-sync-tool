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
    return Math.round(100 * size/1024/1024) / 100;
  }
  function createMusicListItem(music) {
    var html = '';
    html += '<div>  <input type="checkbox" data-checked="false"></input> </div>';
    html += '<div class="music-names item">' +  retriveName(music.name) + '</div>';
    html += '<div class="music-singer item">' + music.metadate.artist + '</div>';
    html += '<div class="music-album item">' + music.metadate.album + '</div>';
    html += '<div class="music-timespan item">' + '5:05' + '</div>';
    html += '<div class="music-type item">' + retriveExtension(music.name) +  '</div>';
    html += '<div class="music-size item">' + retriveSize(music.size) + ' MB' +  '</div>';
    
    var elem = document.createElement('div');
    elem.classList.add('music-list-item');
    elem.innerHTML = html;

    elem.dataset.music = JSON.stringify(music);
    elem.dataset.name = retriveName(music.name);
    elem.dataset.type = retriveExtension(music.name);
    //elem.dataset.contactId = music.id;
    //elem.id = 'music-' + music.id;
    //elem.dataset.avatar = '';

    elem.onclick = function onclick_messages_list(event) {
      var target = event.target;
      if (target instanceof HTMLInputElement) {
        selectMusicItem(elem, target.checked);
      }
    };
    //navigator.mozL10n.translate(elem);

    return elem;
  }
  
  function checkIfMusicListEmpty() {
    var isEmpty = groupedList.count() == 0;
    if (isEmpty) {
      MusicForm.editMusic();
      $id('music-view').classList.add('empty-list');
    } else {
      $id('music-view').classList.remove('empty-list');
    }
  }

  var groupedList = null;

  function initList(musics) {
    var container = getListContainer();
    container.innerHTML = '';
    musics.forEach(function(music) {
      //console.log('djod');
    var listItem = createMusicListItem(music);
    container.appendChild(listItem);
    });
    //checkIfMusicListEmpty();
  }

  function selectAllMusics(select) {
    $expr('#music-list-container .music-list-item').forEach(function(item) {
      selectMusicItem(item, select);
    });

    $id('select-all-musics-checkbox').checked = select;
  }

  function selectMusicItem(item, select) {
    if (select) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }

    $expr('input[type=checkbox]', item).forEach(function(checkbox) {
      checkbox.checked = select;
      checkbox.dataset.checked = !!select;
    });

    $id('select-all-musics-checkbox').checked =
      $expr('#music-list-container input[data-checked=false]').length === 0;
    $id('remove-musics').dataset.disabled =
      $expr('#music-list-container input[data-checked=true]').length === 0;
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
  function removeMusic(id) {
    CMD.Musics.removeMusic(id, function onresponse_removeMusic(message) {
      // Make sure the 'select-all' box is not checked.
      MusicList.selectAllMusics(false);
      var keepVcardView = true;
      var vcardView = $id('music-vcard-view');
      if (message.result) {
        return;
      }

      // Check if music exists in the list.
      var item = $id('music-' + id);
      if (!item) {
        return;
      }

      // Remove music from grouped list
      groupedList.remove(getContact(id));

      if (vcardView.dataset.contactId == id) {
        keepVcardView = false;
      }
      
      if (!keepVcardView) {
        // Pick a music to show
        var availableContacts = $expr('#music-list-container .music-list-item');
        if (availableContacts.length == 0) {
          vcardView.hidden = true;
        } else {
          showVcardInView(JSON.parse(availableContacts[0].dataset.music));
        }
      }
    }, function onerror_removeContact(message) {
      alert('Error occurs when removing contacts!');
    });
  }
  
  window.addEventListener('load', function wnd_onload(event) {
    $id('select-all-musics-checkbox').addEventListener('change', function sall_onclick(event) {
      selectAllMusics(this.checked);
    });

    $id('remove-musics').addEventListener('click', function onclick_removeMusic(event) {
      alert('remove musics');
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
                setTimeout(traverseList,0);
              }
            }
            traverseList();
          } , 0);
        }
      }, {
        title: 'Choose where to save'
      });
    });
  });

  return {
    init:            initList,
    getMusic:        getMusic,
    selectAllMusics: selectAllMusics,
    removeMusic: removeMusic
  };
})();

