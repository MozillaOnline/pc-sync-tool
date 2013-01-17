/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var ContactList = (function() {
  var CMD_REMOVE_CONTACTS = 'removeContacts';

  function getListContainer() {
    return $id('contact-list-container');
  }

  function toggleFavorite(item) {
    var favorite = item.classList.toggle('favorite');
    var contact = getContact(item.dataset.contactId);
    if (!contact.category) {
      contact.category = [];
    }

    if (favorite) {
      contact.category.push('favorite');
    } else {
      contact.category = contact.category.filter(function(cat) {
        return cat != 'favorite';
      });
    }

    // Update contact
    var CMD_UPDATE_CONTACTS = 'updateContacts';
    FFOSAssistor.sendRequest({
      target: 'contact',
      command: CMD_UPDATE_CONTACTS,
      data: [contact]
    }, function onresponse_updatecontact(message) {
      // Update failed
      if (!message.data || message.data.length == 0) {
        item.classList.toggle('favorite');
      }
      // TODO double check if the category is updated.
    }, function onerror_updateContact() {
      alert('Error occurs when updating contact.');
    });
  }

  function createContactListItem(contact) {
    var html = '';
    html += '<div>';
    html += '  <input type="checkbox"></input>';
    html += '    <div class="bookmark"></div>';
    html += '    <div class="avatar-small"></div>';
    html += '      <div class="contact-info">';
    html += '        <div class="name">' + contact.name.join(' ') + '</div>';
    // Only show the first phone number
    if (contact.tel.length > 0) {
      html += '        <div class="tel">' + contact.tel[0].value +  '</div>';
    }
    html += '      </div>';
    html += '    </div>';

    var elem = document.createElement('div');
    elem.classList.add('contact-list-item');
    if (contact.category && contact.category.indexOf('favorite') > -1) {
      elem.classList.add('favorite');
    }
    elem.innerHTML = html;

    elem.dataset.contact = JSON.stringify(contact);
    elem.dataset.contactId = contact.id;
    elem.id = 'contact-' + contact.id;

    elem.onclick = function onclick_contact_list(event) {
      var target = event.target;
      if (target instanceof HTMLInputElement) {
        if (target.checked) {
          elem.classList.add('selected');
        } else {
          elem.classList.remove('selected');
        }
      } else if(target.classList.contains('bookmark')) {
        toggleFavorite(elem);
      } else {
        showVcardInView(getContact(this.dataset.contactId));
      }
    };

    return elem;
  }

  /**
   * Show the contact info in the contact card view
   */
  function showVcardInView(contact) {
    ViewManager.showCardView('contact-vcard-view');
    $id('contact-vcard-view').dataset.contactId = contact.id;

    $expr('#vcard-basic-info-box .name')[0].textContent = contact.name.join(' ');
    $expr('#vcard-basic-info-box .company')[0].textContent
      = contact.org.length > 0 ? contact.org[0] : 'unknown';
    var editButton = $expr('#vcard-basic-info-box .edit')[0];
    editButton.dataset.contactId = contact.id;
    editButton.onclick = function(event) {
      var contact = ContactList.getContact(this.dataset.contactId);
      ContactForm.editContact(contact);
    };

    function _createInfoElem(type, value) {
      var elem = document.createElement('div');
      var html = '';
      html += '  <div class="contact-way-name" data-l10n-id="' + type + '">' + _(type) + '</div>';
      html += '  <div>' + value + '</div>';
      elem.innerHTML = html;
      return elem;
    }

    var infoTable = $expr('#vcard-contact-ways .info-table')[0];
    infoTable.innerHTML = '';

    contact.tel.forEach(function(t) {
      infoTable.appendChild(_createInfoElem(t.type, t.value));
    });

    contact.email.forEach(function(e) {
      infoTable.appendChild(_createInfoElem(e.type, e.value));
    });
  }

  function initList(contacts) {
    var container = getListContainer();
    container.innerHTML = '';

    var contactIndex = document.createElement('div');
    contactIndex.className = 'contact-index';
    contactIndex.textContent = 'P';

    container.appendChild(contactIndex);

    contacts.forEach(function(contact) {
      var elem = createContactListItem(contact);
      container.appendChild(elem);
    });
  }

  /**
   * Remove contacts
   */
  function removeContacts(ids) {
    socket.sendRequest({
      target: 'contact',
      command: CMD_REMOVE_CONTACTS,
      data: ids
    }, function onresponse_removeContacts(message) {
      var keepVcardView = true;
      var vcardView = $id('contact-vcard-view');

      // Remove list item
      message.data.forEach(function(m) {
        if (m.status != 200) {
          return;
        }

        var id = m.data;
        var item = $id('contact-' + id);
        if (!item) {
          return;
        }
        item.parentNode.removeChild(item);
        if (vcardView.dataset.contactId == id) {
          keepVcardView = false;
        }
      });

      if (!keepVcardView) {
        // Pick a contact to show
        var availableContacts = $expr('#contact-list-container .contact-list-item');
        if (availableContacts.length == 0) {
          vcardView.hidden = true;
        } else {
          showVcardInView(JSON.parse(availableContacts[0].dataset.contact));
        }
      }
    }, function onerror_removeContacts(message) {
      alert('Error occurs when removing contacts!');
    });
  }

  function addContact(contact) {

  }

  /**
   * Update contact lists.
   */
  function updateContacts(contacts) {
    contacts.forEach(function(contact) {
      if (!contact.id) {
        return;
      }

      contacts.forEach(function(contact) {
        var contactItem = $id('contact-' + contact.id);
        if (!contactItem) {
          var newItem = createContactListItem(contact);
          getListContainer().appendChild(newItem);
        } else {
          var newItem = createContactListItem(contact);
          contactItem.parentNode.insertBefore(newItem, contactItem);
          contactItem.parentNode.removeChild(contactItem);
        }
        showVcardInView(contact);
      });
    });
  }

  /**
   * Get contact object by give contact id
   */
  function getContact(id) {
    var contactItem = $id('contact-' + id);
    if (!contactItem) {
      throw 'No contact item is found!';
    }
    return JSON.parse(contactItem.dataset.contact);
  }

  return {
    init: initList,
    removeContacts: removeContacts,
    updateContacts: updateContacts,
    getContact: getContact,
    showContactInfo: showVcardInView
  };
})();

