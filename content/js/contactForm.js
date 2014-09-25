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

  /**
   * Edit the given contact in the form.
   * If the given contact is null, then adding contact is performed.
   */
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
      typeList: ['home', 'work'],
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
      typeList: ['personal', 'work', 'home'],
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
    if(customString && customString != '') {
      target.value = customString;
      var item = $id('custom-type');
      if (item) {
        item.textContent = customString;
        item.setAttribute('data-l10n-id', customString);
      }
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
      CMD.Contacts.updateContact(JSON.stringify(contact), function onresponse_updatecontact(message) {
        animationLoading.stop(loadingGroupId);
      }, function onerror_updatecontact(message) {
        animationLoading.stop(loadingGroupId);
      });
    } else {
      // Create new contact
      CMD.Contacts.addContact(JSON.stringify(contact), function onresponse_addcontact(message) {
        animationLoading.stop(loadingGroupId);
      }, function onerror_addcontact(message) {
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
    CMD.Contacts.addContact(JSON.stringify(contact), function onresponse_addcontact(message) {
      $id('fullName').value = '';
      $id('mobile').value = '';
      animationLoading.stop(loadingGroupId);
    }, function onerror_addcontact(message) {
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
