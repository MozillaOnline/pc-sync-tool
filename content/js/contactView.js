var ContactView = (function() {
  var contactViewId = "contact-view";
  var isFirstShow = true;
  var groupedList = null;
  // Hold all the contact field that we add.
  var fields = {};
  var changedCount = 0;
  function init() {
    ContactView.isFirstShow = true;
    document.addEventListener(AppManager.CHANGE_SELECTED_VIEW, function(e) {
      if (e.detail != "side-view") {
        return;
      }
      ContactView.isFirstShow = true;
      _showSubView('contact-quick-add-view');
      _selectAllContacts(false);
      var container = _getListContainer();
      container.innerHTML = '';
      ContactView.fields = {};
      ContactView.changedCount = 0;
      ContactView.groupedList = null;
      var searchInput = $id('search-contact-input');
      if (searchInput) {
        searchInput.value = '';
      }
    });
    document.addEventListener(CMD_ID.listen_contact_create, function(e) {
      if (!e.detail) {
        return;
      }
      var sendData = {
        cmd: {
          id: SocketManager.commandId ++,
          flag: CMD_TYPE.contact_getById,
          datalength: 0
        },
        dataArray: e.detail
      };
      SocketManager.send(sendData);

      document.addEventListener(sendData.cmd.id, function _onData(evt) {
        document.removeEventListener(sendData.cmd.id, _onData);
        if (!evt.detail) {
          return;
        }
        var recvLength = evt.detail.byteLength !== undefined ? evt.detail.byteLength : evt.detail.length;
        if (recvLength == 4) {
          return;
        }
        var data = array2String(evt.detail);
        if (data != '' && ContactView.groupedList) {
          var contactData = JSON.parse(data);
          _addContact(contactData);
        }
      });
    });
    document.addEventListener(CMD_ID.listen_contact_delete, function(e) {
      if (!e.detail) {
        return;
      }
      var item = _getContact(array2String(e.detail));
      if (!item) {
        return;
      }
      ContactView.groupedList.remove(item);
    });
    document.addEventListener(CMD_ID.listen_contact_update, function(e) {
      if (!e.detail) {
        return;
      }
      var sendData = {
        cmd: {
          id: SocketManager.commandId ++,
          flag: CMD_TYPE.contact_getById,
          datalength: 0
        },
        dataArray: e.detail
      };
      SocketManager.send(sendData);

      document.addEventListener(sendData.cmd.id, function _onData(evt) {
        document.removeEventListener(sendData.cmd.id, _onData);
        if (!evt.detail) {
          return;
        }
        var recvLength = evt.detail.byteLength !== undefined ? evt.detail.byteLength : evt.detail.length;
        if (recvLength == 4) {
          return;
        }
        var data = array2String(evt.detail);
        if (data != '' && ContactView.groupedList) {
          var contactData = JSON.parse(data);
          _updateContact(contactData);
        }
      });
    });

    $id('selectAll-contacts').onclick = function selectAll_onclick(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      if (this.dataset.checked == "false") {
        _selectAllContacts(true);
        if ($expr('#contact-list-container .contact-list-item[data-checked="true"]').length == 1) {
          _showContactInfo(JSON.parse(elem.dataset.contact));
        }
        if ($expr('#contact-list-container .contact-list-item[data-checked="true"]').length > 1) {
          _showMultiContactInfo();
        }
      } else {
        _selectAllContacts(false);
        _showSubView('contact-quick-add-view');
      }
    };

    $id('search-contact-input').onkeyup = function onclick_searchContact(event) {
      _showSearchList(this.value);
    };
    $id('search-contact-input').onkeydown = function onclick_searchContact(event) {
      if(event.keyCode == 13) {
        event.preventDefault();
      }
    };

    $id('remove-contacts').onclick = function onclick_removeContact(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var ids = [];
      $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(item) {
        ids.push(item.dataset.contactId);
      });

      new AlertDialog({
        message: _('delete-contacts-confirm', {
          n: ids.length
        }),
        showCancelButton: true,
        okCallback: function() {
          if ($id('selectAll-contacts').dataset.checked == "true") {
            $id('selectAll-contacts').dataset.checked = false;
          }
          _removeContact(ids);
          _showSubView('contact-quick-add-view');
        }
      });
    };

    $id('add-new-contact').onclick = function onclick_addNewContact(event) {
      _editContact();
    };

    $id('refresh-contacts').onclick = function onclick_refreshContacts(event) {
      ContactView.isFirstShow = true;
      ContactView.show();
    };

    $id('import-contacts').onclick = function onclick_importContacts(event) {
      readFromDisk(function(state, data) {
        if (state) {
          AppManager.animationLoadingDialog.startAnimation();
          var contacts = vCardConverter.importContacts(data);
          if (!contacts || contacts.length == 0) {
            AppManager.animationLoadingDialog.stopAnimation();
            return;
          }
          var index = 0;
          for (var i=0; i<contacts.length; i++) {
            var sendData = {
              cmd: {
                id: SocketManager.commandId ++,
                flag: CMD_TYPE.contact_add,
                datalength: 0
              },
              dataArray: string2Array(contacts[i])
            };
            SocketManager.send(sendData);
            document.addEventListener(sendData.cmd.id, function _onData(evt) {
              document.removeEventListener(sendData.cmd.id, _onData);
              index ++;
              if (index >= contacts.length) {
                AppManager.animationLoadingDialog.stopAnimation();
              }
            });
          }
        }
      });
    };

    $id('export-contacts').onclick = function onclick_exportContacts(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var content = '';
      $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(item) {
        var contact = JSON.parse(item.dataset.contact);
        var vcard = vCardConverter.exportContact(contact);
        content += vcard + '\n';
      });

      saveToDisk(content, function(status) {
        if (status) {
          new AlertDialog({
            message: _('export-contacts-success')
          });
        }
      }, {
        title: _('export-contacts-title'),
        name: 'contacts.vcf',
        extension: 'vcf'
      });
    };

    $id('save-contact').onclick = function() {
      if (_saveContact()) {
        var selectedItem = $expr('#contact-list-container .contact-list-item[data-checked="true"]').length;
        if (selectedItem === 0) {
          _showSubView('contact-quick-add-view');
        } else if (selectedItem === 1) {
          _showSubView('show-contact-view');
        } else {
          _showSubView('show-multi-contacts');
        }
      }
    };

    $id('cancel-edit-contact').onclick = function() {
      var selectedItem = $expr('#contact-list-container .contact-list-item[data-checked="true"]').length;
      if (selectedItem === 0) {
        _showSubView('contact-quick-add-view');
      } else if (selectedItem === 1) {
        _showSubView('show-contact-view');
      } else {
        _showSubView('show-multi-contacts');
      }
    };

    $id('quick-save-contact').onclick = function() {
      _quickSaveContact();
    };

    $id('avatar-add-edit').onclick = function() {
      $id('avatar-input').click();
    };

    $id('avatar-label').onclick = function() {
      if (this.dataset.isAdd == 'true') {
        $id('avatar-input').click();
      } else {
        $id('avatar-add-edit').removeAttribute('src');
        $id('avatar-add-edit').classList.add('avatar-add-edit-default');
        this.dataset.isAdd = true;
        this.textContent = _('avatar-label');
        this.setAttribute('data-l10n-id', 'avatar-label');
        ContactView.changeCount(1);
        ContactView.changed();
      }
    };

    $id('avatar-input').onchange = function() {
      var MAX_WIDTH = 320;
      var MAX_HEIGHT = 320;
      var pic = $id('avatar-add-edit');

      var offscreenImage = document.createElement('img');
      var url = URL.createObjectURL(this.files[0]);
      offscreenImage.src = url;

      offscreenImage.onerror = function() {
        URL.revokeObjectURL(url);
      };

      offscreenImage.onload = function() {
        var image_width = offscreenImage.width;
        var image_height = offscreenImage.height;
        var scalex = image_width / MAX_WIDTH;
        var scaley = image_height / MAX_HEIGHT;
        var scale = Math.min(scalex, scaley);

        var w = MAX_WIDTH * scale;
        var h = MAX_HEIGHT * scale;
        var x = (image_width - w) / 2;
        var y = (image_height - h) / 2;

        var canvas = document.createElement('canvas');
        canvas.width = MAX_WIDTH;
        canvas.height = MAX_HEIGHT;
        var context = canvas.getContext('2d');
        context.drawImage(offscreenImage, x, y, w, h, 0, 0, MAX_WIDTH, MAX_HEIGHT);
        URL.revokeObjectURL(url);
        canvas.toBlob(function(blob) {
          var fr = new FileReader();
          fr.readAsDataURL(blob);
          fr.onload = function(e) {
            pic.src = e.target.result;
            pic.classList.remove('avatar-add-edit-default');
            $id('avatar-label').dataset.isAdd = false;
            $id('avatar-label').textContent = _('avatar-remove');
            $id('avatar-label').setAttribute('data-l10n-id', 'avatar-remove');
            ContactView.changeCount(1);
            ContactView.changed();
          };
        }, 'image/jpeg');
      };
    };
  }

  function show() {
    $id(contactViewId).hidden = false;
    if (ContactView.isFirstShow) {
      ContactView.isFirstShow = false;
      _showSubView('contact-quick-add-view');
      _selectAllContacts(false);
      var container = _getListContainer();
      container.innerHTML = '';
      ContactView.groupedList = null;

      var sendData = {
        cmd: {
          id: SocketManager.commandId ++,
          flag: CMD_TYPE.contact_getAll,
          datalength: 0
        },
        dataArray: null
      };
      AppManager.animationLoadingDialog.startAnimation();
      SocketManager.send(sendData);
      document.addEventListener(sendData.cmd.id, function _onData(evt) {
        document.removeEventListener(sendData.cmd.id, _onData);
        var dataJSON = [];
        if (evt.detail) {
        var recvLength = evt.detail.byteLength !== undefined ? evt.detail.byteLength : evt.detail.length;
          if (recvLength > 4) {
            dataJSON = JSON.parse(array2String(evt.detail));
          }
        }
        _initList(container, dataJSON, null);
        AppManager.animationLoadingDialog.stopAnimation();
      });
    }
  }

  function hide() {
    $id(contactViewId).hidden = true;
  }

  function _getListContainer() {
    return $id('contact-list-container');
  }

  function _showSubView(viewId) {
    var subViewList = ["contact-quick-add-view",
                       "contact-edit-view",
                       "show-contact-view",
                       "show-multi-contacts"];
    for (var i=0; i<subViewList.length; i++) {
      if (subViewList[i] == viewId) {
        $id(subViewList[i]).hidden = false;
      } else {
        $id(subViewList[i]).hidden = true;
      }
    }
  }

  function _toggleFavorite(item) {
    var favorite = item.classList.toggle('favorite');
    var contact = _getContact(item.dataset.contactId);

    if (favorite) {
      contact.category.push('favorite');
    } else {
      var index = 0;
      for (; index < contact.category.length; index++) {
        if ('favorite' == contact.category[index]) {
          break;
        }
      }
      if (index < contact.category.length) {
        contact.category.splice(index, 1);
      }
    }

    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.contact_updateById,
        datalength: 0
      },
      dataArray: string2Array(JSON.stringify(contact))
    };
    SocketManager.send(sendData);
  }

  function _createContactListItem(contact) {
    var elem = document.createElement('ul');
    elem.classList.add('contact-list-item');

    if (contact.category && contact.category.indexOf('favorite') > -1) {
      elem.classList.add('favorite');
    }

    var templateData = {
      fullName: contact.name ? contact.name.join(' ') : '',
      tel: '',
      img: null,
    };

    if (contact.tel) {
      contact.tel.forEach(function(value, index) {
        templateData.tel += (index == 0 ? '' : ',') + value.value;
      });
    }
    elem.dataset.avatar = '';
    if (contact.photo && contact.photo.length > 0) {
      templateData.img = contact.photo;
      elem.dataset.avatar = contact.photo;
    }
    elem.innerHTML = tmpl('tmpl_contact_list_item', templateData);

    elem.dataset.contact = JSON.stringify(contact);
    elem.dataset.contactId = contact.id;
    elem.id = 'contact-' + contact.id;
    elem.dataset.checked = false;

    elem.onclick = function onclick_contact_list(event) {
      var target = event.target;
      if (target instanceof HTMLLabelElement) {
        _toggleContactItem(elem);
      } else if (target.classList.contains('bookmark')) {
        _toggleFavorite(elem);
      } else {
        _contactItemClicked(elem);
      }
    };

    var searchInput = $id('search-contact-input');
    if (!searchInput || searchInput.value.trim().length == 0) {
      elem.hidden = false;
      return elem;
    }

    var searchInfo = _getSearchString(contact);
    var escapedValue = _escapeHTML(searchInfo.join(' '), true).toLowerCase();
    //search key word
    var key = searchInput.value;
    elem.hidden = (!escapedValue || escapedValue.indexOf(key.toLowerCase()) == -1);
    return elem;
  }

  function _getSearchString(contact) {
    var searchString = [];
    var searchTable = ['givenName', 'familyName', 'org', 'tel', 'email'];
    searchTable.forEach(function(field) {
      if (!contact[field] || contact[field].length <= 0) {
        return;
      }
      for (var i = contact[field].length - 1; i >= 0; i--) {
        var current = contact[field][i];
        if (!current) {
          continue;
        }
        if (field == 'tel' || field == 'email') {
          searchString.push(current.value);
        } else {
          var value = String(current).trim();
          if (value.length > 0) {
            searchString.push(value);
          }
        }
      }
    });
    return searchString;
  }

  function _updateUI() {
    var isEmpty = ContactView.groupedList.count() == 0;
    $id('selectAll-contacts').dataset.disabled = isEmpty;
    $id('empty-contact-container').hidden = !isEmpty;
    $id('contact-list-container').hidden = isEmpty;
    _updateControls();
    var searchInput = $id('search-contact-input');
    if (searchInput && searchInput.value.trim()) {
      var allContactData = ContactView.groupedList.getGroupedData();
      allContactData.forEach(function(group) {
        var groupIndexItem = $id('id-grouped-data-' + group.index);
        if (groupIndexItem) {
          var child = groupIndexItem.childNodes[0];
          child.hidden = true;
        }
      });
    }
  }

  function _initList(container, contacts, viewData) {
    var searchInput = $id('search-contact-input');
    if (searchInput) {
      searchInput.value = '';
    }

    var quickName = $id('fullName');
    var quickNumber = $id('mobile');

    _showSubView('contact-quick-add-view');
    if (quickName) {
      quickName.value = '';
    }
    if (quickNumber) {
      quickNumber.value = '';
    }

    if (viewData && (viewData.type == 'add')) {
      if (quickNumber) {
        quickNumber.value = viewData.number;
      }
    }
    
    container.innerHTML = '';
    ContactView.groupedList = null;

    ContactView.groupedList = new GroupedList({
      dataList: contacts,
      dataIndexer: function _getContactIndex(contact) {
        // TODO
        // - index family name for Chinese name
        // - filter the special chars
        if (!contact.name[0] || contact.name[0].length == 0) {
          return '#';
        }
        var firstChar = contact.name[0].charAt(0).toUpperCase();
        var pinyin = makePy(firstChar);

        // Sometimes no pinyin found, like: ºì
        if (pinyin.length == 0) {
          return '#';
        }

        return pinyin[0].toUpperCase();
      },
      dataSorterName: 'name',
      renderFunc: _createContactListItem,
      container: container,
      ondatachange: _updateUI
    });

    ContactView.groupedList.render();
    _updateUI();
  }

  function _removeContact(ids) {
    if (!ids || ids.length == 0) {
      return;
    }
    AppManager.animationLoadingDialog.startAnimation();
    var index = 0;
    for (var i=0; i<ids.length; i++) {
      var sendData = {
        cmd: {
          id: SocketManager.commandId ++,
          flag: CMD_TYPE.contact_removeById,
          datalength: 0
        },
        dataArray: string2Array(ids[i])
      };
      SocketManager.send(sendData);

      document.addEventListener(sendData.cmd.id, function _onData(evt) {
        document.removeEventListener(sendData.cmd.id, _onData);
        index ++;
        if (index >= ids.length) {
          AppManager.animationLoadingDialog.stopAnimation();
        }
      });
    }
  }

  function _selectAllContacts(select) {
    $expr('#contact-list-container .contact-list-item').forEach(function(elem) {
      elem.dataset.checked = elem.dataset.focused = select;
    });

    _updateControls();
  }

  function _contactItemClicked(elem) {
    $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(e) {
      if (e == elem) {
        return;
      }
      e.dataset.checked = e.dataset.focused = false;
    });

    elem.dataset.checked = elem.dataset.focused = true;
    _updateControls();
    _showContactInfo(JSON.parse(elem.dataset.contact));
  }

  function _toggleContactItem(elem) {
    var select = elem.dataset.checked == 'false';
    elem.dataset.checked = elem.dataset.focused = select;
    _updateControls();
    item = $expr('#contact-list-container .contact-list-item[data-checked="true"]');
    if (item.length == 0) {
      _showSubView('contact-quick-add-view');
    } else if (item.length == 1) {
      _showContactInfo(JSON.parse(item[0].dataset.contact));
    } else {
      _showMultiContactInfo();
    }
  }

  function _showContactInfo(contact) {
    $id('show-contact-full-name').innerHTML = contact && contact.name ? contact.name.join(' ') : '';
    $id('show-contact-company').innerHTML = contact && contact.org ? contact.org.join(' ') : '';
    var container = $id('show-contact-content');
    container.innerHTML = '';
    if (contact.tel && contact.tel.length > 0) {
      contact.tel.forEach(function(item) {
        var div = document.createElement('div');
        div.innerHTML = tmpl('tmpl_contact_tel_digest', {
          type: item.type[0],
          value: item.value
        });

        div.classList.add('contact-item');
        container.appendChild(div);
        navigator.mozL10n.translate(div);
      });
    }

    if (contact.email && contact.email.length > 0) {
      contact.email.forEach(function(item) {
        var div = document.createElement('div');
        var obj ={};
        obj.value = item.value;
        if (item.type && item.type[0]) {
          obj.type = item.type[0];
        } else {
          obj.type = 'other';
        }
        div.innerHTML = tmpl('tmpl_contact_email_digest', obj);

        div.classList.add('contact-item');
        navigator.mozL10n.translate(div);
        container.appendChild(div);
      });
    }

    if (contact.category && contact.category.indexOf('facebook') != -1) {
      $id('edit-contact').disabled = true;
      $id('edit-contact').classList.add('button-disabled');
    } else {
      $id('edit-contact').disabled = false;
      $id('edit-contact').classList.remove('button-disabled');
      $id('edit-contact').onclick = function doEditContact() {
        _editContact(contact);
      };
    }

    _showSubView('show-contact-view');
    var item = $id('contact-' + contact.id);

    if (item.dataset.avatar) {
      $id('show-avatar').src = item.dataset.avatar;
      $id('show-avatar').classList.remove('avatar-show-default');
    } else {
      $id('show-avatar').removeAttribute('src');
      $id('show-avatar').classList.add('avatar-show-default');
    }
  }

  function _updateControls() {
    if ($expr('#contact-list-container .contact-list-item').length == 0) {
      $id('selectAll-contacts').dataset.checked = false;
      $id('selectAll-contacts').dataset.disabled = true;
    } else {
      $id('selectAll-contacts').dataset.checked =
      $expr('#contact-list-container .contact-list-item').length === $expr('#contact-list-container .contact-list-item[data-checked="true"]').length;
      $id('selectAll-contacts').dataset.disabled = false;
    }
    $id('remove-contacts').dataset.disabled =
    $expr('#contact-list-container .contact-list-item[data-checked="true"]').length === 0;
    $id('export-contacts').dataset.disabled =
    $expr('#contact-list-container .contact-list-item[data-checked="true"]').length === 0;
  }

  function _showMultiContactInfo() {
    var num = "";
    var selectedContacts = $expr('#contact-list-container .contact-list-item[data-checked="true"]');
    var container = $id('show-contacts-container');
    container.innerHTML = '';
    $id('show-contacts-header').innerHTML = selectedContacts.length;
    selectedContacts.forEach(function(item) {
      var contact = JSON.parse(item.dataset.contact);
      var templateData = {
        avatar: item.dataset.avatar,
        name: contact.name.join(' '),
        tel: contact.tel && contact.tel.length > 0 ? contact.tel[0].value : ''
      };

      var div = document.createElement('div');
      div.innerHTML = tmpl('tmpl_contact_vcard_multi_info', templateData);

      div.classList.add('show-contacts-item');
      container.appendChild(div);

      if (contact.tel && contact.tel.length > 0) {
        num += contact.name + "(" + contact.tel[0].value + ");";
      }
    });

    _showSubView('show-multi-contacts');
  }

  function _addContact(contact) {
    if (!contact.id) {
      return;
    }
    ContactView.groupedList.add(contact);
  }

  function _updateContact(contact) {
    if (!contact.id) {
      return;
    }
    var existingContact = _getContact(contact.id);
    var isChecked = false;
    var contactListItems = $expr('#contact-list-container .contact-list-item[data-checked="true"]');
    for (var i = 0; i < contactListItems.length; i++) {
      var item = JSON.parse(contactListItems[i].dataset.contact);
      if (item.id == contact.id) {
        isChecked = true;
        break;
      }
    }
    ContactView.groupedList.remove(existingContact);
    ContactView.groupedList.add(contact);
    var item = $id('contact-' + contact.id);
    if (!item) {
      return;
    }
    var img = item.getElementsByTagName('img')[0];
    if (!contact.photo || (contact.photo.length == 0)) {
      img.src = '';
      item.dataset.avatar = '';
      img.removeAttribute('src');
      img.classList.add('avatar-default');
    } else {
      img.src = contact.photo;
      item.dataset.avatar = contact.photo;
      img.classList.remove('avatar-default');
    }
    if (isChecked) {
      if (contactListItems.length == 1) {
        _showContactInfo(contact);
      }
      item.dataset.checked = item.dataset.focused = isChecked;
    }
    _updateUI();
  }

  function _getContact(id) {
    var contactItem = $id('contact-' + id);

    if (!contactItem) {
      return null;
    }

    return JSON.parse(contactItem.dataset.contact);
  }

  function _escapeHTML(str, escapeQuotes) {
    if (Array.isArray(str)) {
      return _escapeHTML(str.join(' '), escapeQuotes);
    }

    if (!str || typeof str != 'string') return '';

    var escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (escapeQuotes) return escaped.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    return escaped;
  }

  function _showSearchList (value) {
    var allContactData = ContactView.groupedList.getGroupedData();
    allContactData.forEach(function(group) {
      var groupIndexItem = $id('id-grouped-data-' + group.index);

      if (groupIndexItem) {
        var child = groupIndexItem.childNodes[0];
        child.hidden = value.length > 0;
      }

      group.dataList.forEach(function(contact) {
        var contactItem = $id('contact-' + contact.id);
        if (!contactItem || (value.length <= 0)) {
          contactItem.hidden = false;
          return;
        }
        var searchInfo = _getSearchString(contact);
        var escapedValue = _escapeHTML(searchInfo.join(' '), true).toLowerCase();
        // search key words
        var search = value;
        if ((escapedValue.length > 0) && (escapedValue.indexOf(search.toLowerCase()) >= 0)) {
          contactItem.hidden = false;
        } else {
          contactItem.hidden = true;
        }
      });
    });
  }

  function changeCount(changed) {
    ContactView.changedCount += changed;
  }

  function _editContact(contact) {
    _showSubView('contact-edit-view');
    $id('save-contact').classList.add('button-disabled');
    $id('save-contact').dataset.disabled = true;
    ContactView.changedCount = 0;

    var inputs = $expr('input', $id('contact-edit-view'));
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].dataset.changed = false;
    }

    // Mark form as adding new contact
    $id('contact-edit-view').dataset.addContact = !contact;

    var container = $expr('#contact-form ul')[0];
    container.innerHTML = '';
    ContactView.fields = [];

    $id('contact-form-id').value = contact ? contact.id : '';

    if (contact) {
      if ($id('contact-' + contact.id).dataset.avatar) {
        $id('avatar-add-edit').src = $id('contact-' + contact.id).dataset.avatar;
        $id('avatar-add-edit').classList.remove('avatar-add-edit-default');
        $id('avatar-label').dataset.isAdd = false;
        $id('avatar-label').textContent = _('avatar-remove');
        $id('avatar-label').setAttribute('data-l10n-id', 'avatar-remove');
      } else {
        $id('avatar-add-edit').removeAttribute('src');
        $id('avatar-add-edit').classList.add('avatar-add-edit-default');
        $id('avatar-label').dataset.isAdd = true;
        $id('avatar-label').textContent = _('avatar-label');
        $id('avatar-label').setAttribute('data-l10n-id', 'avatar-label');
      }
    } else {
      $id('avatar-add-edit').removeAttribute('src');
      $id('avatar-add-edit').classList.add('avatar-add-edit-default');
      $id('avatar-label').dataset.isAdd = true;
      $id('avatar-label').textContent = _('avatar-label');
      $id('avatar-label').setAttribute('data-l10n-id', 'avatar-label');
    }

    $id('givenName').dataset.value = $id('givenName').value = contact && contact.givenName && contact.givenName.length > 0 ? contact.givenName[0] : '';
    $id('givenName').oninput = changed;
    $id('familyName').dataset.value = $id('familyName').value = contact && contact.familyName && contact.familyName.length > 0 ? contact.familyName[0] : '';
    $id('familyName').oninput = changed;
    $id('org').dataset.value = $id('org').value = contact && contact.org ? contact.org.join(' ') : '';
    $id('org').oninput = changed;
    $id('givenName').focus();

    ContactView.fields['tel'] = new ContactField({
      id: 'tel',
      needCustom: true,
      typeList: ['mobile', 'home', 'work', 'personal', 'faxHome', 'faxOffice', 'faxOther', 'another', 'custom'],
      fields: [{
        name: 'value',
        l10nId: 'phone',
        type: 'tel'
      }, {
        name: 'carrier',
        l10nId: 'carrier-name',
        type: 'text'
      }],
      initValues: contact && contact.tel ? contact.tel : [],
      container: container,
      addButtonLabel: 'add-new-phone'
    }).render();

    ContactView.fields['adr'] = new ContactField({
      id: 'address',
      needCustom: true,
      typeList: ['home', 'work', 'custom'],
      fields: [{
        name: 'streetAddress',
        l10nId: 'street',
        type: 'text'
      }, {
        name: 'postalCode',
        l10nId: 'zipcode',
        type: 'number'
      }, {
        name: 'locality',
        l10nId: 'city',
        type: 'text'
      }, {
        name: 'countryName',
        l10nId: 'country',
        type: 'text'
      }],
      initValues: contact && contact.adr ? contact.adr : [],
      container: container,
      addButtonLabel: 'add-new-address'
    }).render();

    ContactView.fields['email'] = new ContactField({
      id: 'email',
      needCustom: true,
      typeList: ['personal', 'work', 'home', 'custom'],
      fields: [{
        name: 'value',
        l10nId: 'email',
        type: 'text'
      }],
      initValues: contact && contact.email ? contact.email : [],
      container: container,
      addButtonLabel: 'add-new-email'
    }).render();

    ContactView.fields['note'] = new ContactField({
      id: 'note',
      // Default is ContactField
      fieldType: 'string',
      fields: [{
        l10nId: 'comment',
        type: 'text'
      }],
      initValues: contact && contact.note ? contact.note : [],
      container: container,
      addButtonLabel: 'add-new-comment'
    }).render();
  }

  function changed(e) {
    if (e instanceof HTMLSelectElement) {
      var inputs = $expr('input', e.parentNode.parentNode);
      if (_checkInputsEmpty(inputs))
        return;

      if (e.dataset.selectedIndex != e.selectedIndex && e.dataset.changed != 'true') {
        e.dataset.changed = 'true';
        ContactView.changedCount++;
      }
      if (e.dataset.selectedIndex == e.selectedIndex && e.dataset.changed == 'true') {
        e.dataset.changed = 'false';
        ContactView.changedCount--;
      }
      _changeSaveButtonStatus();
      return;
    }

    var target;
    if (e instanceof Event) {
      target = e.target;
    } else {
      target = e;
    }
    if (target) {
      if (target.dataset.value != target.value && target.dataset.changed != 'true') {
        ContactView.changedCount++;
        target.dataset.changed = 'true';
      }
      if (target.dataset.value == target.value && target.dataset.changed == 'true') {
        ContactView.changedCount--;
        target.dataset.changed = 'false';
      }
    }
    _changeSaveButtonStatus();
  }

  function custom(e) {
    var target;
    if (e instanceof Event) {
      target = e.target;
    } else {
      target = e;
    }
    var customString = prompt(_('custom-title'), target.value);
    if(customString && customString != '' && customString != target.value) {
      target.value = customString;
      e.textContent = customString;
      e.setAttribute('data-l10n-id', customString);
      ContactView.changeCount(1);
      ContactView.changed();
    }
  }

  function  _checkInputsEmpty(inputs) {
    var ret = true;
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].value != '') {
        ret = false;
        break;
      }
    }
    return ret;
  }

  function _changeSaveButtonStatus() {
    if (ContactView.changedCount > 0) {
      $id('save-contact').classList.remove('button-disabled');
      $id('save-contact').dataset.disabled = false;
    } else {
      $id('save-contact').classList.add('button-disabled');
      $id('save-contact').dataset.disabled = true;
    }
  }

  function _getFieldValue(id) {
    if (ContactView.fields[id]) {
      return ContactView.fields[id].getValues();
    } else if ($id(id) && $id(id).value.trim()) {
      return [$id(id).value];
    }

    return [];
  }

  function _saveContact() {
    if ($id('save-contact').dataset.disabled == 'true') {
      return false;
    }
    var contactId = $id('contact-form-id').value;
    var updateContact = !! contactId;
    var contact = null;

    AppManager.animationLoadingDialog.startAnimation();
    if (updateContact) {
      // Update contact
      contact = _getContact(contactId);
    } else {
      // create a new one
      contact = {
        id: null,
        photo: [],
        name: [],
        givenName: [],
        familyName: [],
        additionalName: [],
        nickname: [],
        email: [],
        url: [],
        category: [],
        adr: [],
        tel: [],
        org: [],
        jobTitle: [],
        note: [],
        sex: 'male'
      };
    }

    // Read modified fields
    contact.familyName = _getFieldValue('familyName');
    contact.givenName = _getFieldValue('givenName');
    // Concat given name with family name as the name
    contact.name = _getFieldValue('givenName').concat(_getFieldValue('familyName'));
    contact.tel = _getFieldValue('tel');
    contact.adr = _getFieldValue('adr');
    contact.email = _getFieldValue('email');
    contact.org = _getFieldValue('org');
    contact.note = _getFieldValue('note');
    if ($id('avatar-add-edit').classList.contains('avatar-add-edit-default')) {
      contact.photo = [];
    } else {
      contact.photo = $id('avatar-add-edit').src;
    }
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.contact_add,
        datalength: 0
      },
      dataArray: string2Array(JSON.stringify(contact))
    };
    if (updateContact) {
      // Save to device
      sendData.cmd.flag = CMD_TYPE.contact_updateById;
    }
    SocketManager.send(sendData);
    document.addEventListener(sendData.cmd.id, function _onData(evt) {
      document.removeEventListener(sendData.cmd.id, _onData);
      AppManager.animationLoadingDialog.stopAnimation();
    });
    return true;
  }

  function _quickSaveContact() {
    var fullName = $id('fullName').value.trim();
    var mobile = $id('mobile').value.trim();
    if (fullName == '') {
      new AlertDialog({
        message: _('EmptyName')
      });
      return;
    }
    AppManager.animationLoadingDialog.startAnimation();
    contact = {
      id: null,
      photo: [],
      name: [],
      givenName: [],
      familyName: [],
      additionalName: [],
      nickname: [],
      email: [],
      url: [],
      category: [],
      adr: [],
      tel: [],
      org: [],
      jobTitle: [],
      note: [],
      sex: 'male'
    };
    var index = fullName.lastIndexOf(' ');
    if (index != -1) {
      contact.familyName = [fullName.substr(index + 1, fullName.length)];
      contact.givenName = [fullName.substr(0, index)];
      contact.name = contact.givenName.concat(contact.familyName);
    } else {
      contact.familyName = [];
      contact.givenName = [fullName];
      contact.name = contact.givenName;
    }
    contact.tel = [{
      "type": ["Mobile"],
      "value": mobile,
      "carrier": ""
    }];
    var sendData = {
      cmd: {
        id: SocketManager.commandId ++,
        flag: CMD_TYPE.contact_add,
        datalength: 0
      },
      dataArray: string2Array(JSON.stringify(contact))
    };
    SocketManager.send(sendData);
    document.addEventListener(sendData.cmd.id, function _onData(evt) {
      document.removeEventListener(sendData.cmd.id, _onData);
      AppManager.animationLoadingDialog.stopAnimation();
      if (!evt.detail) {
        return;
      }
      var recvLength = evt.detail.byteLength !== undefined ? evt.detail.byteLength : evt.detail.length;
      if (recvLength == 4 && array2Int(evt.detail) != RS_OK) {
        return;
      }
      $id('fullName').value = '';
      $id('mobile').value = '';
    });
  }

  return {
    init: init,
    show: show,
    hide: hide,
    changeCount: changeCount,
    changed: changed,
    custom: custom,
    isFirstShow: isFirstShow,
    groupedList: groupedList,
    fields: fields,
    changedCount: changedCount
  };
})();

function ContactField(options) {
  this.initialize(options);
}

ContactField.prototype = {
  initialize: function(options) {
    // FIXME l10n
    this.options = extend({
      id: null,
      needCustom: false,
      typeList: [],
      fields: [],
      initValues: [],
      container: document.body,
      addButtonLabel: 'add'
    }, options);

    if (!this.options.initValues) {
      this.options.initValues = []
    }

    if (!this.options.id || this.options.fields.length == 0) {
      throw new Error("Options is not valid.");
    }
  },

  _getElemId: function cf_getElemId() {
    return 'field-' + this.options.id;
  },

  _getAddNewButton: function cf_getAddNewButton() {
    return $expr('button.add-new-button', this.elem)[0];
  },

  render: function cf_render() {
    if ($id(this._getElemId())) {
      throw new Error("Field " + this.options.id + " is duplicated.");
    }

    // FIXME escape
    this.elem = document.createElement('li');
    this.elem.id = this._getElemId();
    var templateData = {
      addButtonLabel: this.options.addButtonLabel
    };
    this.elem.innerHTML = tmpl('tmpl_contact_add_new_button', templateData);

    navigator.mozL10n.translate(this.elem);
    // Create input fields and fill it with init values.
    var self = this;
    if (this.options.initValues.length == 0) {
      if (this.options.fieldType == 'string') {
        this.options.initValues.push('');
      } else {
        this.options.initValues.push({});
      }
    }

    this.options.initValues.forEach(function(initValue) {
      self.addNewField(initValue);
    });

    this.options.container.appendChild(this.elem);

    // Register click event handler to add new button
    var self = this;
    this._getAddNewButton().onclick = function onclick_addNewButton(event) {
      if (self.options.fieldType == 'string') {
        self.addNewField([]);
      } else {
        self.addNewField({});
      }
    };

    return this;
  },

  addNewField: function cf_addNewField(initValue) {
    var section = document.createElement('section');
    var templateData = {
      needCustom: this.options.needCustom,
      typeList: this.options.typeList,
      fieldType: this.options.fieldType,
      fields: this.options.fields,
      initValue: initValue,
      selectedIndex: -1
    };
    for (var i = 0; i < this.options.typeList.length; i++) {
      if (initValue && initValue.type && this.options.typeList[i].toLowerCase() === initValue.type[0].toLowerCase()) {
        templateData.selectedIndex = i;
        break;
      }
    }
    if (initValue && initValue.type && templateData.selectedIndex == -1 && this.options.typeList.length > 0) {
      templateData.selectedIndex = this.options.typeList.length - 1;
      if (this.options.needCustom) {
        templateData.typeList[this.options.typeList.length - 1] = initValue.type[0];
      } else {
        templateData.typeList.push(initValue.type[0]);
      }
    }
    section.innerHTML = tmpl('tmpl_contact_add_item', templateData);

    this.elem.insertBefore(section, this._getAddNewButton());
    // Translate the fields
    navigator.mozL10n.translate(section);

    // Remove self when clicking on the delete button.
    section.onclick = function onclick_deleteButton(event) {
      var elem = event.target;
      if (elem instanceof HTMLDivElement && elem.className == 'action-delete') {
        var inputs = $expr('input', elem.parentNode);
        for (var i = 0; i < inputs.length; i++) {
          if(inputs[i].dataset.value != '' && inputs[i].dataset.changed != 'true') {
            ContactView.changeCount(1);
          }
          if(inputs[i].dataset.value == '' && inputs[i].dataset.changed == 'true') {
            ContactView.changeCount(-1);
          }
        }
        this.parentNode.removeChild(this);
        ContactView.changed();
      }
    };
  },

  getValues: function cf_getValues() {
    var values = [];
    var formRows = $expr('fieldset.form-row', this.elem);
    var self = this;

    if (this.options.fieldType == 'string') {
      formRows.forEach(function(row) {
        var value = $expr('input', row)[0].value.trim();
        if (value) {
          values.push(value);
        }
      });
    } else {
      formRows.forEach(function(row) {
        var value = {
          type: [$expr('select', row)[0].value],
        };
        var hasValue = false;

        $expr('input', row).forEach(function(input) {
          value[input.dataset.name] = input.value.trim();
          if (!hasValue && input.value.trim() != '') {
            hasValue = true;
          }
        });

        if (hasValue) {
          values.push(value);
        }
      });
    }

    return values;
  }
};
