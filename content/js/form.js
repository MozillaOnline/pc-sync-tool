/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function ContactField(options) {
  this.initialize(options);
}

ContactField.prototype = {
  initialize: function(options) {
    // FIXME l10n
    this.options = extend({
      id: null,
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
      throw "Options is not valid.";
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
      throw "Field " + this.options.id + " is duplicated.";
    }

    // FIXME escape
    this.elem = document.createElement('li');
    this.elem.id = this._getElemId();
    this.elem.innerHTML = '<button class="add-new-button" data-l10n-id="' + 
                          this.options.addButtonLabel + '">' +
                          _(this.options.addButtonLabel) + '</button>';

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
    this._getAddNewButton().addEventListener('click', function onclick_addNewButton(event) {
      if (self.options.fieldType == 'string') {
        self.addNewField([]);
      } else {
        self.addNewField({});
      }
    });

    return this;
  },

  addNewField: function cf_addNewField(initValue) {
    var section = document.createElement('section');
    var self = this;

    // Fetch attribute, and return empty str if it's undefined.
    function _f(obj, key) {
      if (!obj)
        return '';
      return obj[key] ? obj[key] : '';
    }

    var html = '';
    html += '  <div>';
    html += '    <fieldset class="form-row">';

    // Show legend only when typeList is defined.
    if (this.options.typeList && this.options.typeList.length > 0) {
      html += '      <legend class="action">';
      html += '        <select name="type">';
      this.options.typeList.forEach(function(type) {
        html += '        <option value="' + type + '" data-l10n-id="' + type + '">';
        html += _(type);
        html += '        </option>';
      });
      html += '        </select>';
      html += '      </legend>';
    }

    html += '      <section>';
    this.options.fields.forEach(function(f) {
      html += '      <p>';
      if (self.options.fieldType == 'string') {
        html += '      <input placeholder="' + f.placeholder + '" type="' + f.type +'" value="' + initValue + '"></input>';
      } else {
        html += '      <input data-name="' + f.name + '" type="' + f.type +'" placeholder="' + f.placeholder + '" value="' + _f(initValue, f.name) + '"></input>';
      }
      html += '      </p>';
    });

    html += '      <section>';
    html += '    </fieldset>';
    html += '    <div class="action-delete"></div>';
    html += '  </div>';

    section.innerHTML = html;

    this.elem.insertBefore(section, this._getAddNewButton());

    // Remove self when clicking on the delete button.
    section.addEventListener('click', function onclick_deleteButton(event) {
      var elem = event.target;
      if (elem instanceof HTMLDivElement && elem.className == 'action-delete') {
        this.parentNode.removeChild(this);
      }
    });
  },

  getValues: function cf_getValues() {
    var values = [];
    var formRows = $expr('fieldset.form-row', this.elem);
    var self = this;

    if (this.options.fieldType == 'string') {
      formRows.forEach(function(row) {
        var value =  $expr('input', row)[0].value.trim();
        if (value) {
          values.push(value);
        }
      });
    } else {
      formRows.forEach(function(row) {
        var value = {
          type: $expr('select', row)[0].value,
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
        } });
    }

    return values;
  }
};

var ContactForm = (function() {
  // Hold all the contact field that we add.
  var fields = {};

  /**
   * Edit the given contact in the form.
   * If the given contact is null, then adding contact is performed.
   */
  function editContact(contact) {
    ViewManager.showCardView('contact-edit-view');

    var container = $expr('#contact-form ul')[0];
    container.innerHTML = '';
    fields = [];

    $id('contact-form-id').value = contact ? contact.id : '';
    $id('givenName').value       = contact ? contact.givenName.join(' ') : '';
    $id('familyName').value      = contact ? contact.familyName.join(' ') : '';
    $id('org').value             = contact ? contact.org.join(' ') : '';
    $id('givenName').focus();

    fields['tel']   = new ContactField({
      id: 'tel',
      typeList: ['mobile', 'home', 'work', 'personal', 'faxHome', 'faxOffice', 'faxOther', 'other'],
      fields: [{
        name: 'value',
        placeholder: 'Phone',
        type: 'tel'
      }, {
        name: 'carrier',
        placeholder: 'Carrier Name',
        type: 'text'
      }],
      initValues: contact && contact.tel ? contact.tel : [],
      container: container,
      addButtonLabel: 'add-new-phone'
    }).render();

    fields['adr']   = new ContactField({
      id: 'address',
      typeList: ['home', 'work'],
      fields: [{
        name: 'streetAddress',
        placeholder: 'Street',
        type: 'text'
      }, {
        name: 'postalCode',
        placeholder: 'Zip code',
        type: 'number'
      }, {
        name: 'region',
        placeholder: 'City',
        type: 'text'
      }, {
        name: 'countryName',
        placeholder: 'Country',
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
        placeholder: 'Email',
        type: 'email'
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
        placeholder: 'Comment',
        type: 'text'
      }],
      initValues: contact && contact.note ? contact.note : [],
      container: container,
      addButtonLabel: 'add-new-comment'
    }).render();
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
    var contactId = $id('contact-form-id').value;
    var updateContact = !!contactId;
    var contact = null;

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
        photo: [],
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
      }
    }

    // Read modified fields
    contact.familyName = getFieldValue('familyName');
    contact.givenName  = getFieldValue('givenName');
    // Concat given name with family name as the name
    contact.name       = getFieldValue('givenName').concat(getFieldValue('familyName'));
    contact.tel        = getFieldValue('tel');
    contact.email      = getFieldValue('email');
    contact.org        = getFieldValue('org');
    contact.note       = getFieldValue('note');

    if (contact.givenName.length == 0 || contact.familyName.length == 0) {
      alert('Please input the givenName and familyName!');
      return;
    }

    if (updateContact) {
      // Save to device
      var CMD_UPDATE_CONTACTS = 'updateContacts';
      FFOSAssistor.sendRequest({
        target: 'contact',
        command: CMD_UPDATE_CONTACTS,
        data: [contact]
      }, function onresponse_updatecontact(message) {
        var contactsUpdated = [];
        message.data.forEach(function(m) {
          if (m.status == 200) {
            contactsUpdated.push(m.data);
          }
        });
        ContactList.updateContacts(contactsUpdated);
      }, function onerror_updatecontact(message) {
        alert('Error occurs when updating contacts: ' + JSON.stringify(message));
      });
    } else {
      // Create new contact
      var CMD_ADD_CONTACTS = 'addContacts';
      FFOSAssistor.sendRequest({
        target: 'contact',
        command: CMD_ADD_CONTACTS,
        data: [contact]
      }, function onresponse_addcontact(message) {
        var contactsAdded = [];
        message.data.forEach(function(m) {
          if (m.status == 200) {
            contactsAdded.push(m.data);
          }
        });
        ContactList.updateContacts(contactsAdded);
      }, function onerror_addcontact(message) {
        alert('Error occurs when adding contacts: ' + JSON.stringify(message));
      });
    }
  }

  window.addEventListener('load', function onload(event) {
    window.removeEventListener('load', onload);
    $id('save-contact').addEventListener('click', function onclick_saveContact(evt) {
      saveContact();
    });
    $id('cancel-edit-contact').addEventListener('click', function onclick_cancel(evt) {
      ViewManager.showCardView('contact-vcard-view');
    });
  });

  return {
    // If contact object is not given, perform adding a new contact
    editContact: editContact
  };
})();

