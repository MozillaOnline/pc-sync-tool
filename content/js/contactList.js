var ContactList = (function() {
  var groupedList = null;

  function getListContainer() {
    return $id('contact-list-container');
  }

  function toggleFavorite(item) {
    var favorite = item.classList.toggle('favorite');
    var contact = getContact(item.dataset.contactId);

    if (favorite) {
      contact.category.push('favorite');
    } else {
      var index = 0;
      for(; index < contact.category.length; index++) {
        if ('favorite' == contact.category[index]) {
          break;
        }
      }
      if (index < contact.category.length) {
        contact.category.splice(index, 1);
      }
    }

    // Update contact
    CMD.Contacts.updateContact(JSON.stringify(contact), function onresponse_updatecontact(message) {}, function onerror_updateContact() {});
  }

  function createContactListItem(contact) {
    var elem = document.createElement('ul');
    elem.classList.add('contact-list-item');

    if (contact.category && contact.category.indexOf('favorite') > -1) {
      elem.classList.add('favorite');
    }

    var templateData = {
      fullName: contact.name ? contact.name.join(' ') : '',
      tel: ''
    };

    if (contact.tel) {
      contact.tel.forEach(function(value, index) {
        templateData.tel += (index == 0 ? '' : ',') + value.value;
      });
    }

    elem.innerHTML = tmpl('tmpl_contact_list_item', templateData);

    elem.dataset.contact = JSON.stringify(contact);
    elem.dataset.contactId = contact.id;
    elem.id = 'contact-' + contact.id;
    elem.dataset.avatar = '';
    elem.dataset.checked = false;

    elem.onclick = function onclick_contact_list(event) {
      var target = event.target;
      if (target instanceof HTMLLabelElement) {
        toggleContactItem(elem);
      } else if (target.classList.contains('bookmark')) {
        toggleFavorite(elem);
      } else {
        contactItemClicked(elem);
      }
    };

    var searchInput = $id('search-contact-input');
    if (!searchInput || searchInput.value.trim().length == 0) {
      elem.hidden = false;
      return elem;
    }

    var searchInfo = [];
    var searchTable = ['givenName', 'familyName', 'org'];
    searchTable.forEach(function(field) {
      if (contact[field] && contact[field][0]) {
        var value = String(contact[field][0]).trim();
        if (value.length > 0) {
          searchInfo.push(value);
        }
      }
    });

    if (contact.tel && contact.tel.length > 0) {
      for (var i = contact.tel.length - 1; i >= 0; i--) {
        var current = contact.tel[i];
        searchInfo.push(current.value);
      }
    }

    if (contact.email && contact.email.length > 0) {
      for (var i = contact.email.length - 1; i >= 0; i--) {
        var current = contact.email[i];
        searchInfo.push(current.value);
      }
    }

    var escapedValue = Text_escapeHTML(searchInfo.join(' '), true);
    //search key word
    var key = searchInput.value;

    elem.hidden = !escapedValue || escapedValue.indexOf(key) == -1;

    return elem;
  }

  function checkIfContactListEmpty() {
    var isEmpty = groupedList.count() == 0;
    $id('selectAll-contacts').dataset.disabled = isEmpty;
    $id('empty-contact-container').hidden = !isEmpty;

    var searchInput = $id('search-contact-input');
    if (searchInput && searchInput.value.trim()) {
      var allContactData = groupedList.getGroupedData();
      allContactData.forEach(function(group) {
        var groupIndexItem = $id('id-grouped-data-' + group.index);
        if (groupIndexItem) {
          var child = groupIndexItem.childNodes[0];
          if (child.length > 0) {
            child.style.display = 'block';
          } else {
            child.style.display = 'none';
          }
        }
      });
    }
  }

  function updateAllAvatars() {
    groupedList.getGroupedData().forEach(function(group) {
      group.dataList.forEach(function(contact) {
        updateAvatar(contact);
      });
    });
  }

  function updateAvatar(contact) {
    if (!contact.photo || (contact.photo.length == 0)) {
      return;
    }

    var item = $id('contact-' + contact.id);
    if (!item) {
      return;
    }

    var img = item.getElementsByTagName('img')[0];
    img.src = contact.photo;
    item.dataset.avatar = contact.photo;
    img.classList.remove('avatar-default');
  }

  function init(viewData) {
    ViewManager.showViews('contact-quick-add-view');
    CMD.Contacts.getAllContacts(function onresponse_getAllContacts(message) {
      // Make sure the 'select-all' box is not checked.
      selectAllContacts(false);
      var dataJSON = JSON.parse(message.data);
      initList(dataJSON, viewData);
    }, function onerror_getAllContacts(message) {
      log('Error occurs when fetching all contacts.');
    });
  }

  function initList(contacts, viewData) {
    var container = getListContainer();
    container.innerHTML = '';
    var searchInput = $id('search-contact-input');
    if (searchInput) {
      searchInput.value = '';
    }

    var quickName = $id('fullName');
    var quickNumber = $id('mobile');

    ViewManager.showViews('contact-quick-add-view');
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

    groupedList = new GroupedList({
      dataList: contacts,
      dataIndexer: function getContactIndex(contact) {
        // TODO
        // - index family name for Chinese name
        // - filter the special chars
        var firstChar = contact.name[0].charAt(0).toUpperCase();
        var pinyin = makePy(firstChar);

        // Sometimes no pinyin found, like: 红
        if (pinyin.length == 0) {
          return '#';
        }

        return pinyin[0].toUpperCase();
      },
      dataSorterName: 'name',
      renderFunc: createContactListItem,
      container: container,
      ondatachange: checkIfContactListEmpty
    });

    groupedList.render();
    updateAllAvatars();
    checkIfContactListEmpty();
    ViewManager.removeViewEventListener('contact', 'onMessage', onMessage);
    ViewManager.addViewEventListener('contact', 'onMessage', onMessage);
  }

  /**
   * Remove contact from device
   * when success, onMessage will remove the item
   */
  function removeContact(id) {
    var loadingGroupId = animationLoading.start();
    CMD.Contacts.removeContact(id, function onresponse_removeContact(message) {
      animationLoading.stop(loadingGroupId);
    }, function onerror_removeContact(message) {
      animationLoading.stop(loadingGroupId);
    });
  }

  function selectAllContacts(select) {
    $expr('#contact-list-container .contact-list-item').forEach(function(elem) {
      var item = $expr('label', elem)[0];
      if (!item) {
        return;
      }
      item.dataset.checked = elem.dataset.checked = elem.dataset.focused = select;
    });

    opStateChanged();
  }

  function contactItemClicked(elem) {
    // Uncheck all the other items
    $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(e) {
      if (e == elem) {
        return;
      }
      e.dataset.checked = e.dataset.focused = false;
      var item = $expr('label', e)[0];
      if (item) {
        item.dataset.checked = false;
      }
    });

    // Check the clicked item
    item = $expr('label', elem)[0];
    if (item) {
      item.dataset.checked = true;
    }
    elem.dataset.checked = elem.dataset.focused = true;
    opStateChanged();
    showContactInfo(JSON.parse(elem.dataset.contact));
  }

  function toggleContactItem(elem) {
    var item = $expr('label', elem)[0];
    if (!item) {
      return;
    }
    var select = item.dataset.checked == 'false';

    elem.dataset.checked = elem.dataset.focused = item.dataset.checked = select;
    opStateChanged();
    item = $expr('#contact-list-container .contact-list-item[data-checked="true"]');
    if (item.length == 0) {
      ViewManager.showViews('contact-quick-add-view');
    } else if (item.length == 1) {
      showContactInfo(JSON.parse(item[0].dataset.contact));
    } else {
      showMultiContactInfo();
    }
  }

  function opStateChanged() {
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

  function showContactInfo(contact) {
    $id('show-contact-full-name').innerHTML = contact.name.join(' ');
    $id('show-contact-company').innerHTML = contact.org.join(' ');
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
      $id('sms-send-incontact').hidden = false;
    } else {
      $id('sms-send-incontact').hidden = true;
    }

    if (contact.email && contact.email.length > 0) {
      contact.email.forEach(function(item) {
        var div = document.createElement('div');
        div.innerHTML = tmpl('tmpl_contact_email_digest', {
          type: item.type[0],
          value: item.value
        });

        div.classList.add('contact-item');
        navigator.mozL10n.translate(div);
        container.appendChild(div);
      });
    }

    $id('edit-contact').onclick = function doEditContact() {
      ContactForm.editContact(contact);
    };

    $id('sms-send-incontact').onclick = function doSendInContact() {
      if (!contact.tel || !contact.tel.trim()) {
        return;
      }
      new SendSMSDialog({
        type: 'single',
        name: contact.name,
        tel: contact.tel
      });
    };

    ViewManager.showViews('show-contact-view');
    var item = $id('contact-' + contact.id);

    if (item.dataset.avatar) {
      $id('show-avatar').src = item.dataset.avatar;
      $id('show-avatar').classList.remove('avatar-show-default');
    } else {
      $id('show-avatar').removeAttribute('src');
      $id('show-avatar').classList.add('avatar-show-default');
    }
  }

  function showMultiContactInfo() {
    var num = "";
    var selectedContacts = $expr('#contact-list-container .contact-list-item[data-checked="true"]');
    var container = $id('show-contacts-container');
    container.innerHTML = '';
    var header = _('contacts-selected', {
      n: selectedContacts.length
    });
    $id('show-contacts-header').innerHTML = header;
    selectedContacts.forEach(function(item) {
      var contact = JSON.parse(item.dataset.contact);
      var templateData = {
        avatar: item.dataset.avatar,
        name: contact.name.join(' '),
        tel: contact.tel.length > 0 ? contact.tel[0].value : ''
      };

      var div = document.createElement('div');
      div.innerHTML = tmpl('tmpl_contact_vcard_multi_info', templateData);

      div.classList.add('show-contacts-item');
      container.appendChild(div);

      if (contact.tel && contact.tel.length > 0) {
        num += contact.name + "(" + contact.tel[0].value + ");";
      }
    });

    var btn = $id('sms-send-inmulticontact');

    btn.onclick = function() {
      new SendSMSDialog({
        type: 'multi',
        number: [num],
        bodyText: null
      });
    };

    ViewManager.showViews('show-multi-contacts');
  }

  /**
   * Add contact lists.
   */
  function addContact(contact) {
    if (!contact.id) {
      return;
    }
    groupedList.add(contact);
  }

  /**
   * Update contact lists.
   */
  function updateContact(contact) {
    if (!contact.id) {
      return;
    }
    var existingContact = getContact(contact.id);
    groupedList.remove(existingContact);
    groupedList.add(contact);

    if (!contact.photo || (contact.photo.length == 0)) {
      return;
    }

    var item = $id('contact-' + contact.id);
    if (!item) {
      return;
    }

    var img = item.getElementsByTagName('img')[0];
    img.src = contact.photo;
    item.dataset.avatar = contact.photo;
    img.classList.remove('avatar-default');
  }

  /**
   * Get contact object by contact id
   */
  function getContact(id) {
    var contactItem = $id('contact-' + id);

    if (!contactItem) {
      throw 'No contact item is found!';
    }

    return JSON.parse(contactItem.dataset.contact);
  }

  function Text_escapeHTML(str, escapeQuotes) {
    if (Array.isArray(str)) {
      return Text_escapeHTML(str.join(' '), escapeQuotes);
    }

    if (!str || typeof str != 'string') return '';

    var escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (escapeQuotes) return escaped.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    return escaped;
  }

  function onMessage(changeEvent) {
    switch (changeEvent.reason) {
    case 'remove':
      {
        var item = getContact(changeEvent.contactID);
        if (!item) {
          return;
        }
        groupedList.remove(item);
        break;
      }
    case 'update':
      {
        CMD.Contacts.getContactById(changeEvent.contactID, function(result) {
          if (result.data != '' && groupedList) {
            var contactData = JSON.parse(result.data);
            updateContact(contactData);
            showContactInfo(contactData);
            updateAvatar(contactData);
          }
        }, null);
        break;
      }
    case 'create':
      {
        CMD.Contacts.getContactById(changeEvent.contactID, function(result) {
          if (result.data != '' && groupedList) {
            var contactData = JSON.parse(result.data);
            addContact(contactData);
          }
        }, null);
        break;
      }
    default:
      break;
    }
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-contacts').addEventListener('click', function selectAll_onclick(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      if (this.dataset.checked == "false") {
        selectAllContacts(true);
        if ($expr('#contact-list-container .contact-list-item[data-checked="true"]').length == 1) {
          showContactInfo(JSON.parse(elem.dataset.contact));
        }
        if ($expr('#contact-list-container .contact-list-item[data-checked="true"]').length > 1) {
          showMultiContactInfo();
        }
      } else {
        selectAllContacts(false);
        ViewManager.showViews('contact-quick-add-view');
      }
    });

    $id('search-contact-input').addEventListener('keyup', function onclick_searchContact(event) {
      var self = this;
      var allContactData = groupedList.getGroupedData();
      allContactData.forEach(function(group) {
        var groupIndexItem = $id('id-grouped-data-' + group.index);

        if (groupIndexItem) {
          var child = groupIndexItem.childNodes[0];
          child.hidden = self.value.length > 0;
        }

        group.dataList.forEach(function(contact) {
          var contactItem = $id('contact-' + contact.id);
          if (!contactItem || (self.value.length <= 0)) {
            contactItem.hidden = false;
            return;
          }
          var searchInfo = [];
          var searchTable = ['givenName', 'familyName', 'org'];
          searchTable.forEach(function(field) {
            if (contact[field] && contact[field][0]) {
              var value = String(contact[field][0]).trim();
              if (value.length > 0) {
                searchInfo.push(value);
              }
            }
          });

          if (contact.tel && contact.tel.length > 0) {
            for (var i = contact.tel.length - 1; i >= 0; i--) {
              var current = contact.tel[i];
              searchInfo.push(current.value);
            }
          }

          if (contact.email && contact.email.length > 0) {
            for (var i = contact.email.length - 1; i >= 0; i--) {
              var current = contact.email[i];
              searchInfo.push(current.value);
            }
          }

          var escapedValue = Text_escapeHTML(searchInfo.join(' '), true).toLowerCase();
          // search key words
          var search = self.value;
          if ((escapedValue.length > 0) && (escapedValue.indexOf(search.toLowerCase()) >= 0)) {
            contactItem.hidden = false;
          } else {
            contactItem.hidden = true;
          }
        });
      });
    });

    $id('remove-contacts').addEventListener('click', function onclick_removeContact(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var ids = [];
      $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(item) {
        ids.push(item.dataset.contactId);
      });

      new AlertDialog(_('delete-contacts-confirm', {
          n: ids.length
        }), true, function (returnBtn) {
        if(returnBtn) {
          if ($id('selectAll-contacts').dataset.checked == "true") {
            $id('selectAll-contacts').dataset.checked = false;
          }
          ids.forEach(function(item) {
            removeContact(item);
          });
          ViewManager.showViews('contact-quick-add-view');
        }
      });
    });

    $id('add-new-contact').addEventListener('click', function onclick_addNewContact(event) {
      ContactForm.editContact();
    });

    $id('refresh-contacts').addEventListener('click', function onclick_refreshContacts(event) {
      init();
    });

    $id('import-contacts').addEventListener('click', function onclick_importContacts(event) {
      navigator.mozFFOSAssistant.readFromDisk(function(state, data) {
        if (state) {
          vCardConverter.importContacts(data);
        }
      });
    });

    $id('export-contacts').addEventListener('click', function onclick_exportContacts(event) {
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

      navigator.mozFFOSAssistant.saveToDisk(content, function(status) {
        if (status) {
          new AlertDialog(_('export-contacts-success'));
        }
      }, {
        title: _('export-contacts-title'),
        name: 'contacts.vcf',
        extension: 'vcf'
      });
    });
  });

  return {
    init: init,
    getContact: getContact
  };
})();
