/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MusicList = (function() {
  function getListContainer() {
    return $id('music-list-container');
  }
  
  function createMusicListItem(music) {
    var html = '';
    html += '<div>';
    html += '  <input type="checkbox" data-checked="false"></input>';
    html += '    <div class="bookmark"></div>';
    html += '    <div class="avatar-small" data-noavatar="true"></div>';
    html += '      <div class="music-info">';
    html += '        <div class="name">' + music.name + '</div>';
    
      html += '        <div class="type">' + music.type +  '</div>';
      html += '        <div class="size">' + music.size +  '</div>';
      html += '        <div class="date">' + music.date +  '</div>';

    html += '      </div>';
    html += '    </div>';

    var elem = document.createElement('div');
    elem.classList.add('music-list-item');
    if (music.category && music.category.indexOf('favorite') > -1) {
      elem.classList.add('favorite');
    }
    elem.innerHTML = html;

    elem.dataset.music = JSON.stringify(music);
    //elem.dataset.contactId = music.id;
    //elem.id = 'music-' + music.id;
    elem.dataset.avatar = '';

    elem.onclick = function onclick_music_list(event) {
      var target = event.target;
    };

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

    groupedList = new GroupedList({
      dataList: musics,
      dataIndexer: function getMusicIndex(music) {
        // TODO
        // - index family name for Chinese name
        // - filter the special chars
        var firstChar = music.name.charAt(0).toUpperCase();
        var pinyin = makePy(firstChar);

        // Sometimes no pinyin found, like: 红
        if (pinyin.length == 0) {
          return '#';
        }

        return pinyin[0].toUpperCase();
      },
      renderFunc: createMusicListItem,
      container: container,
      ondatachange: checkIfMusicListEmpty
    });

    groupedList.render();

    checkIfMusicListEmpty();
  }

  function selectAllMusics(select) {
    $expr('#music-list-container .music-list-item').forEach(function(item) {
      selectMusicItem(item, select);
    });

    $id('select-all').checked = select;
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

    $id('select-all').checked =
      $expr('#music-list-container input[data-checked=false]').length === 0;
    $id('remove-contacts').dataset.disabled =
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
    $id('select-all').addEventListener('change', function sall_onclick(event) {
      selectAllMusics(this.checked);
    });

    $id('remove-musics').addEventListener('click', function onclick_removeMusic(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var ids = [];
      $expr('#music-list-container div.selected').forEach(function(item) {
        ids.push(item.dataset.contactId);
      });
      
      if (window.confirm(_('delete-musics-confirm', {n: ids.length}))) {
        if ($id('select-all').checked) {
          ContactList.clearAllMusics();
        } else {
          ids.forEach(function(item) {
            ContactList.removeMusic(item);
          });
        }
      }
    });


    $id('refresh-musics').addEventListener('click', function onclick_refreshMusics(event) {
      FFOSAssistant.getAndShowAllMusics();
    });

    $id('import-musics').addEventListener('click', function onclick_importMusics(event) {
      navigator.mozFFOSAssistant.readFromDisk(function (state, musicList){
        if(state) {
          var jsonMusicList = JSON.parse(musicList);
          jsonContactList.forEach(function(music) {
              CMD.Contacts.addContact(JSON.stringify(music), function onresponse_addcontact(message) {
              var contactsAdded = [];
              if (!message.result) {
                contactsAdded.push(JSON.parse(message.data));
              }
              ContactList.addContacts(contactsAdded);
              }, function onerror_addcontact(message) {
              alert('Error occurs when adding contacts: ' + JSON.stringify(message));
            });
          });
        }
      });
    });

    $id('export-contacts').addEventListener('click', function onclick_exportContacts(event) {
      var content = '';
      groupedList.getGroupedData().forEach(function(group) {
        group.dataList.forEach(function(contact) {
          var vcard = 'BEGIN:VCARD';
          vcard += '\nVERSION:3.0';
          vcard += '\nN:' + contact.familyName + ' ' + contact.givenName + ';;;;';
          vcard += '\nFN:' + contact.familyName + ' ' + contact.givenName;
          if (contact.org != '') {
            vcard += '\nORG:' + contact.org;
          }
          contact.tel.forEach(function(t) {
            vcard += '\nTEL;TYPE=' + t.type + ':' + t.value;
          });
          contact.email.forEach(function(e) {
            vcard += '\nEMAIL;TYPE=' + e.type + ':' + e.value;
          });
          contact.adr.forEach(function(adr) {
            vcard += '\nADR;TYPE=' + adr.type + ':;;' + adr.streetAddress + ';'
                                                     + adr.locality + ';'
                                                     + adr.region + ';'
                                                     + adr.postalCode + ';'
                                                     + adr.countryName;
          });
          vcard += '\nEND:VCARD';
          content += vcard + '\n';
        });
      });

      navigator.mozFFOSAssistant.saveToDisk(content, function(status) {
        if (status) {
          alert('Contacts have been save to disk.');
        }
      }, {
        title: 'Choose where to save',
        name: 'contacts.vcf',
        extension: 'vcf'
      });
    });
  });

  return {
    init:              initList,
    getMusic:        getMusic,
    selectAllMusics: selectAllMusics,
    removeMusic: removeMusic
  };
})();

