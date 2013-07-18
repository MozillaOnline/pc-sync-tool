/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var ContactList = (function() {
  var groupedList = null;
  
  function getListContainer() {
    return $id('contact-list-container');
  }

  function toggleFavorite(item) {
    var favorite = item.classList.toggle('favorite');
    var contact = getContact(item.dataset.contactId);
    contact.category = [];

    if (favorite) {
      contact.category.push('favorite');
    }

    // Update contact
    CMD.Contacts.updateContact(JSON.stringify(contact), function onresponse_updatecontact(message) {
      if (message.result) {
        item.classList.toggle('favorite');
      }
    }, function onerror_updateContact() {
      alert('Error occurs when updating contact.');
    });
  }

  function createContactListItem(contact) {
    var html = '';
    html += '<div>';
    //html += '  <input id="checkbox-' + contact.id + '"';
    //html += '  class="checkbox" type="checkbox"></input>';
    //html += '  <label class="selectAll" for="checkbox-' + contact.id + '"></label>';
    //html += '  <input class="checkbox" type="checkbox"></input>';
    html += '  <label class="unchecked"></label>';
    html += '    <div class="bookmark"></div>';
    html += '    <img class="avatar avatar-default"></img>';
    html += '      <div class="contact-info">';
    html += '        <div class="name">';

    if (contact.name) {
      html += contact.name.join(' ');
    }

    html += '</div>';
    // Only show the first phone number
    if (contact.tel && contact.tel.length > 0) {
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
    elem.dataset.avatar = '';
    elem.dataset.checked = false;

    elem.onclick = function onclick_contact_list(event) {
      var target = event.target;
      if (target instanceof HTMLLabelElement) {
        toggleContactItem(elem);
      } else if(target.classList.contains('bookmark')) {
        toggleFavorite(elem);
      } else {
        contactItemClicked(elem);
      }
    };
    var searchContent = $id('search-contact-input');
    if((searchContent)&&(searchContent.value.length>0)){
      var searchInfo = [];
      var searchable = ['givenName', 'familyName', 'org'];
      searchable.forEach(function(field) {
        if (contact[field] && contact[field][0]) {
          var value = String(contact[field][0]).trim();
          if (value.length > 0) {
            searchInfo.push(value);
          }
        }
      });
      if (contact.tel && contact.tel.length) {
        for (var i = contact.tel.length - 1; i >= 0; i--) {
          var current = contact.tel[i];
          searchInfo.push(current.value);
        }
      }
      if (contact.email && contact.email.length) {
        for (var i = contact.email.length - 1; i >= 0; i--) {
          var current = contact.email[i];
          searchInfo.push(current.value);
        }
      }
      var escapedValue = Text_escapeHTML(searchInfo.join(' '), true);
      //定义要搜索的字符
      var search=searchContent.value;
      if((escapedValue.length>0)&&(escapedValue.indexOf(search) >= 0)){
        elem.style.display = 'block';
      }else{
        elem.style.display = 'none';
      }
    }else{
      elem.style.display = 'block';
    }
    return elem;
  }

  /**
   * Show the contact info in the contact card view
   */
  function showVcardInView(contact) {
    // Set focused dataset which means it's shown in the vcard view.
    $expr('.contact-list-item[data-focused=true]').forEach(function(item) {
      delete item.dataset.focused;
    });
    $id('contact-' + contact.id).dataset.focused = true;

    ViewManager.showCardView('contact-vcard-view');
    $id('contact-vcard-view').dataset.contactId = contact.id;

    if ($id('contact-' + contact.id).dataset.avatar != '' &&
        $id('contact-' + contact.id).dataset.avatar != DEFAULT_AVATAR) {
      $id('avatar-s').src = $id('contact-' + contact.id).dataset.avatar;
    } else {
      CMD.Contacts.getContactProfilePic(contact.id, function(result) {
        if (result.data == '') {
          $id('avatar-s').src = DEFAULT_AVATAR;//'style/images/avatar.jpeg';
          $id('contact-' + contact.id).dataset.avatar = DEFAULT_AVATAR;
        } else {
          $id('avatar-s').src = result.data;
          $id('contact-' + contact.id).dataset.avatar = result.data;
        }
      }, function(e) {
        alert('get contact avatar error:' + e);
      });
    }
    $expr('#vcard-basic-info-box .name')[0].textContent = contact.name.join(' ');
    $expr('#vcard-basic-info-box .company')[0].textContent
      = (contact.org && contact.org.length) > 0 ? contact.org[0] : 'unknown';
    var editButton = $expr('#vcard-basic-info-box .edit')[0];
    editButton.dataset.contactId = contact.id;
    editButton.onclick = function(event) {
      var contact = ContactList.getContact(this.dataset.contactId);
      contact.photo = [$id('avatar-s').src];
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

    if (contact.tel) {
      contact.tel.forEach(function(t) {
        infoTable.appendChild(_createInfoElem(t.type, t.value));
      });
    }

    if (contact.email) {
      contact.email.forEach(function(e) {
        infoTable.appendChild(_createInfoElem(e.type, e.value));
      });
    }
  }

  function checkIfContactListEmpty() {
    var isEmpty = groupedList.count() == 0;
    if (isEmpty) {
      $id('selectAll-contacts').dataset.disabled = true;
      showEmptyContacts();
    } else {
      hideEmptyContacts();
      $id('selectAll-contacts').dataset.disabled = false;
    }
    var searchContent = $id('search-contact-input');
    if((searchContent)&&(searchContent.value.length>0)){
      var allContactData = groupedList.getGroupedData();
      allContactData.forEach(function(group) {
        var groupIndexItem = $id('id-grouped-data-' + group.index);
        if(groupIndexItem){
          var child = groupIndexItem.childNodes[0];
          if(searchContent.value.length>0){
            child.style.display = 'none';
          }else{
            child.style.display = 'block';
          }
        }
      });
    }
  }

  function updateAvatar() {
    groupedList.getGroupedData().forEach(function(group) {
      group.dataList.forEach( function (contact) {
        updateContactAvatar(contact);
      });
    });
  }

  function updateContactAvatar(contact) {
    CMD.Contacts.getContactProfilePic(contact.id, function(result) {
      if (result.data != '') {
        var item = $id('contact-' + contact.id);
        if(item != null){
          var img = item.getElementsByTagName('img')[0];
          img.src = result.data;
          item.dataset.avatar = result.data;
          if (img.classList.contains('avatar-default')) {
            img.classList.remove('avatar-default');
          }
        }
      }
    }, function(e) {
      alert('get contact avatar error:' + e);
    });
  }

  function initList(contacts,viewData) {
    var container = getListContainer();
    container.innerHTML = '';
    var searchContent = $id('search-contact-input');
    if((searchContent)&&(searchContent.value.length>0)){
      searchContent.value = '';
    }
    /*
    if (contacts.length == 0 ) {
      showEmptyContacts(container);
      ViewManager.showViews('contact-quick-add-view');
      return;
    } */
    var quickName = $id('fullName');
    var quickNumber = $id('mobile');
    if(viewData){
      if(viewData.type == 'add'){
        ViewManager.showViews('contact-quick-add-view');
        if(quickName){
          quickName.value = '';
        }
        if(quickNumber){
          quickNumber.value = viewData.number;
        }
      }
    }else{
      ViewManager.showViews('contact-quick-add-view');
      if(quickName){
        quickName.value = '';
      }
      if(quickNumber){
        quickNumber.value = '';
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
      renderFunc: createContactListItem,
      container: container,
      ondatachange: checkIfContactListEmpty
    });

    groupedList.render();
    updateAvatar();
    checkIfContactListEmpty();
  }

  function hideEmptyContacts() {
    $id('empty-contact-container').style.display = 'none';
  }

  function showEmptyContacts() {
    $id('empty-contact-container').style.display = 'block';
    /*
    getListContainer().innerHTML = '';
    var div = document.createElement('div');
    div.classList.add('empty-contacts');
    getListContainer().appendChild(div);
    div = document.createElement('div');
    html = '<label data-l10n-id="empty-contacts"> </label>';
    div.innerHTML = html;
    div.classList.add('empty-contacts-prompt');
    navigator.mozL10n.translate(div)
    getListContainer().appendChild(div);
    */
  }
  /**
   * Clear all contacts
   */
  function clearAllContacts() {
    CMD.Contacts.clearAllContacts(function onresponse_clearAllContacts(message) {
      if (message.result) {
        alert(message.result);
        return;
      }
      var ids = [];
      $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(item) {
        ids.push(item.dataset.contactId);
      });
      ids.forEach(function(id){
        var existingContact = getContact(id);
        groupedList.remove(existingContact);
        });

      // Make sure the 'select-all' box is not checked.
      ContactList.selectAllContacts(false);

      //showEmptyContacts();
      ViewManager.showViews('contact-quick-add-view');
    }, function onerror_clearAllContacts(message) {
      alert('Error occurs when removing contacts!');
    });
  }

  /**
   * Remove contacts
   */
  function removeContact(id) {
    CMD.Contacts.removeContact(id, function onresponse_removeContact(message) {
      // Make sure the 'select-all' box is not checked.
      ContactList.selectAllContacts(false);
      //var keepVcardView = true;
      //var vcardView = $id('contact-vcard-view');
      if (message.result) {
        return;
      }

      // Check if contact exists in the list.
      var item = $id('contact-' + id);
      if (!item) {
        return;
      }

      // Remove contact from grouped list
      groupedList.remove(getContact(id));

      //if (vcardView.dataset.contactId == id) {
      //  keepVcardView = false;
      //}
      /*
      if (!keepVcardView) {
        // Pick a contact to show
        var availableContacts = $expr('#contact-list-container .contact-list-item');
        if (availableContacts.length == 0) {
          vcardView.hidden = true;
        } else {
          showVcardInView(JSON.parse(availableContacts[0].dataset.contact));
        }
      }*/
    }, function onerror_removeContact(message) {
      alert('Error occurs when removing contacts!');
    });
  }

  function selectAllContacts(select) {
    $expr('#contact-list-container .contact-list-item').forEach(function(item) {
      selectContactItem(item, select);
    });

    opStateChanged();
  }

  function contactItemClicked(elem) {
    $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(e) {
      if (e != elem) {
        e.dataset.checked = false;
        e.dataset.focused = false;
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
    elem.dataset.focused = true;
    if ($expr('#contact-list-container .contact-list-item').length === 1) {
      $id('selectAll-contacts').dataset.checked = true;
    } else {
      $id('selectAll-contacts').dataset.checked = false;
    }
    $id('remove-contacts').dataset.disabled = false;
    $id('export-contacts').dataset.disabled = false;

    showContactInfo(JSON.parse(elem.dataset.contact));
  }

  function selectContactItem(elem, selected) {
    var item = $expr('label.unchecked', elem)[0];
    if (item) {
      if (selected) {
        item.classList.add('checked');
        elem.dataset.checked = true;
        elem.dataset.focused = true;
      } else {
        item.classList.remove('checked');
        elem.dataset.checked = false;
        elem.dataset.focused = false;
      }
    }
  }

  function toggleContactItem(elem) {
    var item = $expr('label.unchecked', elem)[0];
    if (item) {
      item.classList.toggle('checked');
    }
    if (item.classList.contains('checked')) {
      elem.dataset.checked = true;
      elem.dataset.focused = true;
    } else {
      elem.dataset.checked = false;
      elem.dataset.focused = false;
    }
    opStateChanged();
    if ($expr('#contact-list-container .contact-list-item[data-checked="true"]').length == 0) {
      ViewManager.showViews('contact-quick-add-view');
    }
    if ($expr('#contact-list-container .contact-list-item[data-checked="true"]').length == 1) {
      showContactInfo(JSON.parse(elem.dataset.contact));
    }
    if ($expr('#contact-list-container .contact-list-item[data-checked="true"]').length > 1) {
      showMultiContactInfo();
    }
  }

  function opStateChanged() {
    if ($expr('#contact-list-container .contact-list-item').length == 0) {
      $id('selectAll-contacts').dataset.checked = false;
      $id('selectAll-contacts').dataset.disabled = true;
    } else {
      $id('selectAll-contacts').dataset.checked =
        $expr('#contact-list-container .contact-list-item').length ===
          $expr('#contact-list-container .contact-list-item[data-checked="true"]').length;
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
        switch (item.type[0]) {
          case 'Mobile':
            div.innerHTML = '<div class="title"><label data-l10n-id="MobileTel"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'Home':
            div.innerHTML = '<div class="title"><label data-l10n-id="HomeTel"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'Work':
            div.innerHTML = '<div class="title"><label data-l10n-id="WorkTel"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'Personal':
            div.innerHTML = '<div class="title"><label data-l10n-id="PersonalTel"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'FaxHome':
            div.innerHTML = '<div class="title"><label data-l10n-id="FaxHome"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'FaxOffice':
            div.innerHTML = '<div class="title"><label data-l10n-id="FaxOffice"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'FaxOther':
            div.innerHTML = '<div class="title"><label data-l10n-id="FaxOther"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'Another':
            div.innerHTML = '<div class="title"><label data-l10n-id="Other"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          default:
            div.innerHTML = '<div class="title"><label>' + item.type[0] + '</label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
        }
        div.classList.add('contact-item');
        //navigator.mozL10n.translate(div);
        container.appendChild(div);
        navigator.mozL10n.translate(div);
      });
    }
    if (contact.email && contact.email.length > 0) {
      contact.email.forEach(function(item) {
        var div = document.createElement('div');
        switch (item.type[0]) {
          case 'Personal':
            div.innerHTML = '<div class="title"><label data-l10n-id="PersonalEmail"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'Work':
            div.innerHTML = '<div class="title"><label data-l10n-id="WorkEmail"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          case 'Home':
            div.innerHTML = '<div class="title"><label data-l10n-id="HomeEmail"></label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
          default:
            div.innerHTML = '<div class="title"><label>' + item.type[0] + '</label></div><div class="value"><label>' + item.value + '</label></div>';
            break;
        }
        div.classList.add('contact-item');
        navigator.mozL10n.translate(div);
        container.appendChild(div);
      });
    }
    $id('edit-contact').addEventListener ('click', function edit_contact() {
      ContactForm.editContact(contact);
    });
    $id('sms-send-incontact').addEventListener ('click', function sms_send_incontact() {
      if (contact.tel && contact.tel.length > 0) {
        new SendSMSToSingle({
        number: contact.tel
      });
      }
    });
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
    var header = _('contacts-selected', {n:selectedContacts.length});
    $id('show-contacts-header').innerHTML = header;
    selectedContacts.forEach(function(item) {
      var contact = JSON.parse(item.dataset.contact);
      var div = document.createElement('div');
      var html = '';
      if (item.dataset.avatar) {
        html = '<img class="multi-avatar-show" src= ';
        html += item.dataset.avatar;
        html += '></img>';
      } else {
        html = '<img class="multi-avatar-show multi-avatar-show-default"></img>';
      }
      html += '<div class="show-multi-contact-content">';
      html += '  <div class="name">';
      html += contact.name.join(' ');
      html += '  </div>';
      html += '  <div class="tel">';
      if (contact.tel.length > 0) {
        html += contact.tel[0].value;
      } else {
        html += '';
      }
      html += '  </div>';
      html += '</div>';
      div.innerHTML = html;
      div.classList.add('show-contacts-item');
      container.appendChild(div);
      if (contact.tel && contact.tel.length > 0) {
        num += contact.tel[0].value;
        num += ';';
      }
    });
    $id('sms-send-inmulticontact').addEventListener ('click', function sms_send_incontact() {
      new SendSMSDialog({
        number: num,
        bodyText: null
      });
    });
    ViewManager.showViews('show-multi-contacts');
  }
  /**
   * Add contact lists.
   */
  function addContacts(contacts) {
    contacts.forEach(function(contact) {
      if (!contact.id) {
        return;
      }
      if (groupedList.count() == 0) {
        getListContainer().innerHTML = '';
      }
      groupedList.add(contact);
      //showVcardInView(contact);
    });
  }

  /**
   * Update contact lists.
   */
  function updateContacts(contacts) {
    contacts.forEach(function(contact) {
      if (!contact.id) {
        return;
      }
      $id('selectAll-contacts').dataset.checked = false;
      var existingContact = getContact(contact.id);
      groupedList.remove(existingContact);
      groupedList.add(contact);
      updateContactAvatar(contact);
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
  
  function Text_escapeHTML(str, escapeQuotes) {
    if (Array.isArray(str)) {
      return Text_escapeHTML(str.join(' '), escapeQuotes);
    }
    if (!str || typeof str != 'string')
      return '';
    var escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;');
    if (escapeQuotes)
      return escaped.replace(/"/g, '&quot;').replace(/'/g, '&#x27;'); //"
    return escaped;
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
        if(groupIndexItem){
          var child = groupIndexItem.childNodes[0];
          if(self.value.length>0){
            child.style.display = 'none';
          }else{
            child.style.display = 'block';
          }
        }
        group.dataList.forEach( function (contact) {
          var contactItem = $id('contact-' + contact.id);
          if((contactItem)&&(self.value.length>0)){
            var searchInfo = [];
            var searchable = ['givenName', 'familyName', 'org'];
            searchable.forEach(function(field) {
              if (contact[field] && contact[field][0]) {
                var value = String(contact[field][0]).trim();
                if (value.length > 0) {
                  searchInfo.push(value);
                }
              }
            });
            if (contact.tel && contact.tel.length) {
              for (var i = contact.tel.length - 1; i >= 0; i--) {
                var current = contact.tel[i];
                searchInfo.push(current.value);
              }
            }
            if (contact.email && contact.email.length) {
              for (var i = contact.email.length - 1; i >= 0; i--) {
                var current = contact.email[i];
                searchInfo.push(current.value);
              }
            }
            var escapedValue = Text_escapeHTML(searchInfo.join(' '), true);
            //定义要搜索的字符
            var search=self.value;
            if((escapedValue.length>0)&&(escapedValue.indexOf(search) >= 0)){
              contactItem.style.display = 'block';
            }else{
              contactItem.style.display = 'none';
            }
          }else{
            contactItem.style.display = 'block';
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
      
      if (window.confirm(_('delete-contacts-confirm', {n: ids.length}))) {
        if ($id('selectAll-contacts').dataset.checked == "true") {
          ContactList.clearAllContacts();
        } else {
          ids.forEach(function(item) {
            ContactList.removeContact(item);
          });
          ViewManager.showViews('contact-quick-add-view');
        }
      }
    });

    $id('add-new-contact').addEventListener('click', function onclick_addNewContact(event) {
      ContactForm.editContact();
    });

    $id('refresh-contacts').addEventListener('click', function onclick_refreshContacts(event) {
      FFOSAssistant.getAndShowAllContacts();
    });

    $id('import-contacts').addEventListener('click', function onclick_importContacts(event) {
      //navigator.mozFFOSAssistant.readFromDisk({title:'*.vcf', filter:'*.vcf'},function (state, data){
      navigator.mozFFOSAssistant.readFromDisk(function (state, data){
        if(state) {
          var items = vCard.initialize(data);
          items.forEach(function(item) {
            var contact = {"name":[],"honorificPrefix":[],"givenName":[],"additionalName":[],
                           "familyName":[],"honorificSuffix":[],"nickname":[],"email":[],"photo":[],
                           "category":[],"adr":[],"tel":[],"org":[""],"jobTitle":[],"bday":null,"note":[],
                           "impp":null,"url":null,"anniversary":null,"sex":null,"genderIdentity":null};
            if (item.prodid) {
              //contacts exported from Apple
              if (item.prodid.indexOf('Apple') != -1) {
                if (item.fn != '') {
                  var fullName = item.fn;
                  var index = fullName.indexOf(' ');
                  if (index > 0) {
                    contact.familyName = fullName.substr(index + 1, fullName.length);
                    contact.givenName = fullName.substr(0, index);
                    contact.name = [fullName];
                  }else {
                    contact.name = [fullName];
                  }
                }
                if (item.org != '') {
                  contact.org = item.org.split(';');
                }
                if (item.email) {
                  for (var e in item.email) {
                    if (e.indexOf('type=home') != -1) {
                      item.email[e].forEach(function(email) {
                        contact.email.push({'type':['home'], 'value':email});
                      });
                    }
                    if (e.indexOf('type=work') != -1) {
                      item.email[e].forEach(function(email) {
                        contact.email.push({'type':['work'], 'value':email});
                      });
                    }
                    if (e.indexOf('type=home') == -1 && e.indexOf('type=work') == -1) {
                      item.email[e].forEach(function(email) {
                        contact.email.push({'type':['other'], 'value':email});
                      });
                    }
                  }
                }
                if (item.tel) {
                  for (var e in item.tel) {
                    if (e.indexOf('type=voice') != -1) {
                      if (e.indexOf('type=cell') != -1 && e.indexOf('type=iphone') == -1) {
                        item.tel[e].forEach(function(t) {
                          contact.tel.push({'type':['mobile'], 'value':t});
                        });
                      }
                      if (e.indexOf('type=cell') != -1 && e.indexOf('type=iphone') != -1) {
                        item.tel[e].forEach(function(t) {
                          contact.tel.push({'type':['personal'], 'value':t});
                        });
                      }
                      if (e.indexOf('type=home') != -1) {
                        item.tel[e].forEach(function(t) {
                          contact.tel.push({'type':['home'], 'value':t});
                        });
                      }
                      if (e.indexOf('type=work') != -1) {
                        item.tel[e].forEach(function(t) {
                          contact.tel.push({'type':['work'], 'value':t});
                        });
                      }
                      if (e.indexOf('type=other') != -1) {
                        item.tel[e].forEach(function(t) {
                          contact.tel.push({'type':['another'], 'value':t});
                        });
                      }
                    }
                    if (e.indexOf('type=main') != -1) {
                      item.tel[e].forEach(function(t) {
                        contact.tel.push({'type':['personal'], 'value':t.replace(/-/g,'')});
                      });
                    }
                    if (e.indexOf('type=fax') != -1) {
                      if (e.indexOf('type=home') != -1) {
                        item.tel[e].forEach(function(t) {
                          contact.tel.push({'type':['faxHome'], 'value':t});
                        });
                      }
                      if (e.indexOf('type=work') != -1) {
                        item.tel[e].forEach(function(t) {
                          contact.tel.push({'type':['faxOffice'], 'value':t});
                        });
                      }
                      if (e.indexOf('type=other') != -1) {
                        item.tel[e].forEach(function(t) {
                          contact.tel.push({'type':['faxOther'], 'value':t});
                        });
                      }
                    }
                  }
                  if (item.adr) {
                    for (var e in item.adr) {
                      if (e.indexOf('type=home') != -1) {
                        item.adr[e].forEach(function(adr) {
                          var length = adr.length;
                          var address = adr[length-5].replace('\\n','');
                          contact.adr.push({"type":["Home"],"streetAddress":address,"locality":adr[length-3],"postalCode":adr[length-2],"countryName":adr[length-1]});
                        });
                      }
                      if (e.indexOf('type=work') != -1) {
                        item.adr[e].forEach(function(adr) {
                          var length = adr.length;
                          var address = adr[length-5].replace('\\n','');
                          contact.adr.push({"type":["Work"],"streetAddress":address,"locality":adr[length-3],"postalCode":adr[length-2],"countryName":adr[length-1]});
                        });
                      }
                      if (e.indexOf('type=home') == -1 && e.indexOf('type=work') == -1) {
                        var type = /type=(.+);?/;
                        if (type.test(e)) {
                          var results = e.match(type);
                          item.adr[e].forEach(function(adr) {
                            var length = adr.length;
                            var address = adr[length-5].replace('\\n','');
                            contact.adr.push({"type":[results[1]],"streetAddress":address,"locality":adr[length-3],"postalCode":adr[length-2],"countryName":adr[length-1]});
                          });
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (item.fn != '') {
                var fullName = item.fn;
                var index = fullName.indexOf(' ');
                if (index > 0) {
                  contact.familyName = fullName.substr(index + 1, fullName.length);
                  contact.givenName = fullName.substr(0, index);
                  contact.name = [fullName];
                }else {
                  contact.name = [fullName];
                }
              }
              if (item.org != '') {
                contact.org = item.org.split(';');
              }
              if (item.email) {
                for (var e in item.email) {
                  if (e.indexOf('type=cell') != -1) {
                    item.email[e].forEach(function(email) {
                      contact.email.push({'type':['personal'], 'value':email});
                    });
                  }
                  if (e.indexOf('type=home') != -1) {
                    item.email[e].forEach(function(email) {
                      contact.email.push({'type':['home'], 'value':email});
                    });
                  }
                  if (e.indexOf('type=work') != -1) {
                    item.email[e].forEach(function(email) {
                      contact.email.push({'type':['work'], 'value':email});
                    });
                  }
                }
              }
              if (item.tel) {
                for (var e in item.tel) {
                  if (e.indexOf('type=cell') != -1) {
                    item.tel[e].forEach(function(t) {
                      contact.tel.push({'type':['mobile'], 'value':t});
                    });
                  }
                  if (e.indexOf('type=home') != -1) {
                    item.tel[e].forEach(function(t) {
                      contact.tel.push({'type':['home'], 'value':t});
                    });
                  }
                  if (e.indexOf('type=pref') != -1) {
                    item.tel[e].forEach(function(t) {
                      contact.tel.push({'type':['personal'], 'value':t});
                    });
                  }
                  if (e.indexOf('type=voice') != -1) {
                    item.tel[e].forEach(function(t) {
                      contact.tel.push({'type':['personal'], 'value':t});
                    });
                  }
                  if (e.indexOf('type=work') != -1) {
                    item.tel[e].forEach(function(t) {
                      contact.tel.push({'type':['work'], 'value':t});
                    });
                  }
                }
              }
              if (item.adr) {
                for (var e in item.adr) {
                  if (e.indexOf('type=home') != -1) {
                    item.adr[e].forEach(function(adr) {
                      var length = adr.length;
                      var address = adr[length-5].replace('\\n','');
                      contact.adr.push({"type":["Home"],"streetAddress":address,"locality":adr[length-3],"postalCode":adr[length-2],"countryName":adr[length-1]});
                    });
                  }
                  if (e.indexOf('type=work') != -1) {
                    item.adr[e].forEach(function(adr) {
                      var length = adr.length;
                      var address = adr[length-5].replace('\\n','');
                      contact.adr.push({"type":["Work"],"streetAddress":address,"locality":adr[length-3],"postalCode":adr[length-2],"countryName":adr[length-1]});
                    });
                  }
                }
              }
            }
            CMD.Contacts.addContact(JSON.stringify(contact), function onresponse_addcontact(message) {
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
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var content = '';
      $expr('#contact-list-container .contact-list-item[data-checked="true"]').forEach(function(item) {
        var contact = JSON.parse(item.dataset.contact);
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
    clearAllContacts:  clearAllContacts,
    removeContact:     removeContact,
    updateContacts:    updateContacts,
    addContacts:       addContacts,
    getContact:        getContact,
    showContactInfo:   showVcardInView,
    selectAllContacts: selectAllContacts
  };
})();

