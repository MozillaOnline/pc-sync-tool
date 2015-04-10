var ContactView = (function() {
  var contactViewId = "contact-view";
  function init() {
  }
  function show() {
    $id(contactViewId).hidden = false;
  }

  function hide() {
    $id(contactViewId).hidden = true;
  }

  return {
    init: init,
    show: show,
    hide: hide
  };
})();
/*
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
      for (; index < contact.category.length; index++) {
        if ('favorite' == contact.category[index]) {
          break;
        }
      }
      if (index < contact.category.length) {
        contact.category.splice(index, 1);
      }
    }

    // Update contact
    var cmd = CMD.Contacts.updateContact(JSON.stringify(contact), null);
    socketsManager.send(cmd);
  }

  function createContactListItem(contact) {
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

    var searchInfo = getSearchString(contact);
    var escapedValue = escapeHTML(searchInfo.join(' '), true);
    //search key word
    var key = searchInput.value;
    elem.hidden = !escapedValue || escapedValue.indexOf(key) == -1;
    return elem;
  }

  function getSearchString(contact) {
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

  function updateUI() {
    var isEmpty = groupedList.count() == 0;
    $id('selectAll-contacts').dataset.disabled = isEmpty;
    $id('empty-contact-container').hidden = !isEmpty;
    $id('contact-list-container').hidden = isEmpty;
    updateControls();
    var searchInput = $id('search-contact-input');
    if (searchInput && searchInput.value.trim()) {
      var allContactData = groupedList.getGroupedData();
      allContactData.forEach(function(group) {
        var groupIndexItem = $id('id-grouped-data-' + group.index);
        if (groupIndexItem) {
          var child = groupIndexItem.childNodes[0];
          child.hidden = true;
        }
      });
    }
  }

  function init(viewData) {
    var loadingGroupId = animationLoading.start();
    ViewManager.showViews('contact-quick-add-view');
    selectAllContacts(false);
    var container = getListContainer();
    container.innerHTML = '';
    groupedList = null;
    var cmd = CMD.Contacts.getAllContacts();
    socketsManager.send(cmd);
    document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
      document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
      var result = evt.detail.result;
      if (result != RS_OK) {
        log('Error occurs when fetching all contacts.');
        animationLoading.stop(loadingGroupId);
        return;
      }

      // Make sure the 'select-all' box is not checked.
      var dataJSON = JSON.parse(array2String(evt.detail.data));
      initList(container, dataJSON, viewData);
      animationLoading.stop(loadingGroupId);
    });
  }

  function show(viewData) {
    var searchInput = $id('search-contact-input');
    searchInput.value = '';
    showSearchList(searchInput.value);
    var quickName = $id('fullName');
    var quickNumber = $id('mobile');
    if (quickName) {
      quickName.value = '';
    }
    if (quickNumber) {
      if (viewData && (viewData.type == 'add')) {
        quickNumber.value = viewData.number;
      } else {
        quickNumber.value = '';
      }
    }
    ViewManager.showViews('contact-quick-add-view');
    selectAllContacts(false);
  }

  function initList(container, contacts, viewData) {
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
    
    container.innerHTML = '';
    groupedList = null;

    groupedList = new GroupedList({
      dataList: contacts,
      dataIndexer: function getContactIndex(contact) {
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
      renderFunc: createContactListItem,
      container: container,
      ondatachange: updateUI
    });

    groupedList.render();
    updateUI();
    customEventElement.removeEventListener('dataChange', onMessage);
    customEventElement.addEventListener('dataChange', onMessage);
  }

  function removeContact(id) {
    var loadingGroupId = animationLoading.start();
    var cmd = CMD.Contacts.removeContact(id, null);
    socketsManager.send(cmd);
    document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
      document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
      animationLoading.stop(loadingGroupId);
    });
  }

  function selectAllContacts(select) {
    $expr('#contact-list-container .contact-list-item').forEach(function(elem) {
      elem.dataset.checked = elem.dataset.focused = select;
    });

    updateControls();
  }

  function contactItemClicked(elem) {
    $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(e) {
      if (e == elem) {
        return;
      }
      e.dataset.checked = e.dataset.focused = false;
    });

    elem.dataset.checked = elem.dataset.focused = true;
    updateControls();
    showContactInfo(JSON.parse(elem.dataset.contact));
  }

  function toggleContactItem(elem) {
    var select = elem.dataset.checked == 'false';
    elem.dataset.checked = elem.dataset.focused = select;
    updateControls();
    item = $expr('#contact-list-container .contact-list-item[data-checked="true"]');
    if (item.length == 0) {
      ViewManager.showViews('contact-quick-add-view');
    } else if (item.length == 1) {
      showContactInfo(JSON.parse(item[0].dataset.contact));
    } else {
      showMultiContactInfo();
    }
  }

  function updateControls() {
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
        ContactForm.editContact(contact);
      };
    }

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

    ViewManager.showViews('show-multi-contacts');
  }

  function addContact(contact) {
    if (!contact.id) {
      return;
    }
    groupedList.add(contact);
  }

  function updateContact(contact) {
    if (!contact.id) {
      return;
    }
    var existingContact = getContact(contact.id);
    var isChecked = false;
    var contactListItems = $expr('#contact-list-container .contact-list-item[data-checked="true"]');
    for (var i = 0; i < contactListItems.length; i++) {
      var item = JSON.parse(contactListItems[i].dataset.contact);
      if (item.id == contact.id) {
        isChecked = true;
        break;
      }
    }
    groupedList.remove(existingContact);
    groupedList.add(contact);

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
        showContactInfo(contact);
      }
      item.dataset.checked = item.dataset.focused = isChecked;
    }
  }

  function getContact(id) {
    var contactItem = $id('contact-' + id);

    if (!contactItem) {
      return null;
    }

    return JSON.parse(contactItem.dataset.contact);
  }

  function escapeHTML(str, escapeQuotes) {
    if (Array.isArray(str)) {
      return escapeHTML(str.join(' '), escapeQuotes);
    }

    if (!str || typeof str != 'string') return '';

    var escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (escapeQuotes) return escaped.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    return escaped;
  }

  function showSearchList (value) {
    var allContactData = groupedList.getGroupedData();
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
        var searchInfo = getSearchString(contact);
        var escapedValue = escapeHTML(searchInfo.join(' '), true).toLowerCase();
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

  function onMessage(e) {
    if (e.detail.type != 'contact') {
      return;
    }
    var changeEvent = e.detail.data;
    switch (changeEvent.reason) {
      case 'remove':
        var item = getContact(changeEvent.contactID);
        if (!item) {
          return;
        }
        groupedList.remove(item);
        break;
      case 'update':
        var cmd = CMD.Contacts.getContactById(changeEvent.contactID, null);
        socketsManager.send(cmd);
        document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
          document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
          var result = evt.detail.result;
          if (result != RS_OK) {
            return;
          }
          var data = array2String(evt.detail.data);
          if (data != '' && groupedList) {
            var contactData = JSON.parse(data);
            updateContact(contactData);
          }
        });
        break;
      case 'create':
        var cmd = CMD.Contacts.getContactById(changeEvent.contactID, null);
        socketsManager.send(cmd);
        document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
          document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
          var result = evt.detail.result;
          if (result != RS_OK) {
            return;
          }
          var data = array2String(evt.detail.data);
          if (data != '' && groupedList) {
            var contactData = JSON.parse(data);
            addContact(contactData);
          }
        });
        break;
      default:
        break;
    }
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-contacts').onclick = function selectAll_onclick(event) {
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
    };

    $id('search-contact-input').onkeyup = function onclick_searchContact(event) {
      showSearchList(this.value);
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
          ids.forEach(function(item) {
            removeContact(item);
          });
          ViewManager.showViews('contact-quick-add-view');
        }
      });
    };

    $id('add-new-contact').onclick = function onclick_addNewContact(event) {
      ContactForm.editContact();
    };

    $id('refresh-contacts').onclick = function onclick_refreshContacts(event) {
      init();
    };

    $id('import-contacts').onclick = function onclick_importContacts(event) {
      readFromDisk(function(state, data) {
        if (state) {
          var contacts = vCardConverter.importContacts(data);
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
  });

  return {
    init: init,
    show: show,
    getContact: getContact
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
            ContactForm.changeCount(1);
          }
          if(inputs[i].dataset.value == '' && inputs[i].dataset.changed == 'true') {
            ContactForm.changeCount(-1);
          }
        }
        this.parentNode.removeChild(this);
        ContactForm.changed();
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

var ContactForm = (function() {
  // Hold all the contact field that we add.
  var fields = {};
  var changedCount = 0;

  function changeCount(changed) {
    changedCount += changed;
  }

  function editContact(contact) {
    ViewManager.showViews('contact-edit-view');
    $id('save-contact').classList.add('button-disabled');
    $id('save-contact').dataset.disabled = true;
    changedCount = 0;

    var inputs = $expr('input', $id('contact-edit-view'));
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].dataset.changed = false;
    }

    // Mark form as adding new contact
    $id('contact-edit-view').dataset.addContact = !contact;

    var container = $expr('#contact-form ul')[0];
    container.innerHTML = '';
    fields = [];

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

    fields['tel'] = new ContactField({
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

    fields['adr'] = new ContactField({
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

    fields['email'] = new ContactField({
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

    fields['note'] = new ContactField({
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
      if (checkInputsEmpty(inputs))
        return;

      if (e.dataset.selectedIndex != e.selectedIndex && e.dataset.changed != 'true') {
        e.dataset.changed = 'true';
        changedCount++;
      }
      if (e.dataset.selectedIndex == e.selectedIndex && e.dataset.changed == 'true') {
        e.dataset.changed = 'false';
        changedCount--;
      }
      changeSaveButtonStatus();
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
        changedCount++;
        target.dataset.changed = 'true';
      }
      if (target.dataset.value == target.value && target.dataset.changed == 'true') {
        changedCount--;
        target.dataset.changed = 'false';
      }
    }
    changeSaveButtonStatus();
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
      ContactForm.changeCount(1);
      ContactForm.changed();
    }
  }

  function  checkInputsEmpty(inputs) {
    var ret = true;
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].value != '') {
        ret = false;
        break;
      }
    }
    return ret;
  }

  function changeSaveButtonStatus() {
    if (changedCount > 0) {
      $id('save-contact').classList.remove('button-disabled');
      $id('save-contact').dataset.disabled = false;
    } else {
      $id('save-contact').classList.add('button-disabled');
      $id('save-contact').dataset.disabled = true;
    }
  }

  function getFieldValue(id) {
    if (fields[id]) {
      return fields[id].getValues();
    } else if ($id(id) && $id(id).value.trim()) {
      return [$id(id).value];
    }

    return [];
  }

  function saveContact() {
    if ($id('save-contact').dataset.disabled == 'true') {
      return false;
    }
    var contactId = $id('contact-form-id').value;
    var updateContact = !! contactId;
    var contact = null;
    var loadingGroupId = animationLoading.start();

    if (updateContact) {
      // Update contact
      contact = ContactList.getContact(contactId);
    } else {
      // create a new one
      contact = {
        id: null,
        photo: [],
        name: [],
        honorificPrefix: [],
        givenName: [],
        familyName: [],
        additionalName: [],
        honorificSuffix: [],
        nickname: [],
        email: [],
        url: [],
        category: [],
        adr: [],
        tel: [],
        org: [],
        jobTitle: [],
        bday: null,
        note: [],
        impp: [],
        anniversary: null,
        sex: 'male',
        genderIdentity: null
      };
    }

    // Read modified fields
    contact.familyName = getFieldValue('familyName');
    contact.givenName = getFieldValue('givenName');
    // Concat given name with family name as the name
    contact.name = getFieldValue('givenName').concat(getFieldValue('familyName'));
    contact.tel = getFieldValue('tel');
    contact.adr = getFieldValue('adr');
    contact.email = getFieldValue('email');
    contact.org = getFieldValue('org');
    contact.note = getFieldValue('note');
    if ($id('avatar-add-edit').classList.contains('avatar-add-edit-default')) {
      contact.photo = [];
    } else {
      contact.photo = $id('avatar-add-edit').src;
    }

    if (updateContact) {
      // Save to device
      var cmd = CMD.Contacts.updateContact(JSON.stringify(contact), null);
      socketsManager.send(cmd);
      document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
        document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
        animationLoading.stop(loadingGroupId);
      });
    } else {
      // Create new contact
      var cmd = CMD.Contacts.addContact(JSON.stringify(contact), null);
      socketsManager.send(cmd);
      document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
        document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
        animationLoading.stop(loadingGroupId);
      });
    }
    return true;
  }

  function quickSaveContact() {
    var fullName = $id('fullName').value.trim();
    var mobile = $id('mobile').value.trim();
    if (fullName == '') {
      new AlertDialog({
        message: _('EmptyName')
      });
      return;
    }
    var loadingGroupId = animationLoading.start();
    contact = {
      id: null,
      photo: [],
      name: [],
      honorificPrefix: [],
      givenName: [],
      familyName: [],
      additionalName: [],
      honorificSuffix: [],
      nickname: [],
      email: [],
      url: [],
      category: [],
      adr: [],
      tel: [],
      org: [],
      jobTitle: [],
      bday: null,
      note: [],
      impp: [],
      anniversary: null,
      sex: 'male',
      genderIdentity: null
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
    var cmd = CMD.Contacts.addContact(JSON.stringify(contact), null);
    socketsManager.send(cmd);
    document.addEventListener(cmd.cmd.title.id + '_onData', function _onData(evt) {
      document.removeEventListener(cmd.cmd.title.id + '_onData', _onData);
      var result = evt.detail.result;
      if (result != RS_OK) {
        animationLoading.stop(loadingGroupId);
        return;
      }
      $id('fullName').value = '';
      $id('mobile').value = '';
      animationLoading.stop(loadingGroupId);
    });
  }

  window.addEventListener('load', function onload(event) {
    window.removeEventListener('load', onload);



    $id('save-contact').onclick = function() {
      if (saveContact()) {
        var selectedItem = $expr('#contact-list-container .contact-list-item[data-checked="true"]').length;
        if (selectedItem === 0) {
          ViewManager.showViews('contact-quick-add-view');
        } else if (selectedItem === 1) {
          ViewManager.showViews('show-contact-view');
        } else {
          ViewManager.showViews('show-multi-contacts');
        }
      }
    };

    $id('cancel-edit-contact').onclick = function() {
      var selectedItem = $expr('#contact-list-container .contact-list-item[data-checked="true"]').length;
      if (selectedItem === 0) {
        ViewManager.showViews('contact-quick-add-view');
      } else if (selectedItem === 1) {
        ViewManager.showViews('show-contact-view');
      } else {
        ViewManager.showViews('show-multi-contacts');
      }
    };

    $id('quick-save-contact').onclick = function() {
      quickSaveContact();
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
        ContactForm.changeCount(1);
        ContactForm.changed();
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
            ContactForm.changeCount(1);
            ContactForm.changed();
          };
        }, 'image/jpeg');
      };
    };
  });

  return {
    // If contact object is not given, perform adding a new contact
    editContact: editContact,
    changed: changed,
    custom: custom,
    changeCount: changeCount
  };
})();
*/