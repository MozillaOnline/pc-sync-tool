/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Given data list will be grouped like:
 * [{
 *   index: 'A',
 *   dataList: [item1, item2]
 * }, {
 *   index: 'B',
 *   dataList: [item3, item4]
 * }]
 *
 * Options:
 *   - dataList
 *     Data list that will be grouped and rendered.
 *   - dataIndexer
 *     Function to calc the index of given item.
 *   - indexSorter
 *     Function to sort item index. see more in Array.sort
 *   - dataIdentifier
 *     Function to return the identical string which will be used to judge if two object equals
 *   - renderFunc
 *     Function to render html node for the given item, usually, event listeners will be added.
 *   - container
 *     List container
 *   - ondatachange
 *     Function to be invoked if the data is added or removed
 */
var GroupedList = function(options) {
  this.initailize(options);
  this.DEFAULT_INDEX = '__DEF_INDEX__';
};

GroupedList.prototype = {
  initailize: function(options) {
    this.options = extend({
      dataList: null,
      dataIndexer: null,
      disableDataIndexer: false,
      indexSorter: this._dictSorter,
      dataIdentifier: this._identifyById,
      indexRender: this._renderIndex,
      renderFunc: null,
      container: document.body,
      ondatachange: function() {}
    }, options);

    if (!this.options.dataList || !this.options.dataIndexer || !this.options.renderFunc) {
      throw new Error('Init arguments are not complete.');
    }
  },

  _dictSorter: function gl_dictSorter(a, b) {
    if (a.index === b.index) {
      return 0;
    } else if (a.index < b.index) {
      return -1;
    }
    return 1;
  },

  _identifyById: function gl_identifyById(dataObj) {
    if (dataObj.id) {
      return dataObj.id;
    } else {
      return dataObj.toString();
    }
  },

  _getGroup: function gl_getGroup(index) {
    var position = this._getGroupPosition(index);
    if (position < 0) {
      return null;
    }

    return this._groupedData[position];
  },

  _getGroupPosition: function gl_getGroupPosition(index) {
    for (var i = 0; i < this._groupedData.length; i++) {
      if (String(this._groupedData[i].index) === String(index)) {
        return i;
      }
    }
    return -1;
  },

  _addToGroup: function gl_addToGroup(dataObj) {
    var self = this;
    var index = this.options.dataIndexer(dataObj);
    index = !index ? self.DEFAULT_INDEX : index;

    var group = this._getGroup(index);
    if (!group) {
      group = {};
      group.index = index;
      group.dataList = [];
      this._groupedData.push(group);
    }

    group.dataList.push(dataObj);

    return group;
  },

  /**
   * Remove data object, and return the contained group
   */
  _removeFromGroup: function gl_removeFromGroup(dataObj) {
    var self = this;
    var index = this.options.dataIndexer(dataObj);
    index = !index ? self.DEFAULT_INDEX : index;

    var group = this._getGroup(index);
    if (!group) {
      return null;
    }
    var newDataList = removeFromArray(function(obj) {
      return self.options.dataIdentifier(obj) === self.options.dataIdentifier(dataObj);
    }, group.dataList);

    group.dataList = newDataList;
    // Remove the empty group
    if (newDataList.length === 0) {
      removeFromArray(group, this._groupedData);
    }

    return group;
  },

  _sortGroup: function gl_sortGroup() {
    this._groupedData.sort(this.options.indexSorter);
  },

  _groupDataList: function gl_groupData() {
    this._groupedData = [];

    var self = this;

    this.options.dataList.forEach(function(dataObj) {
      self._addToGroup(dataObj);
    });

    this._sortGroup();
  },

  _renderIndex: function gl_renderIndex(index) {
    var div = document.createElement('div');
    div.className = 'data-index';
    div.textContent = index;
    return div;
  },

  _renderDataList: function gl_render() {
    var self = this;
    this._groupedData.forEach(function(group) {
      var groupElem = self._renderGroup(group);
      self.options.container.appendChild(groupElem);
    });
  },

  _renderGroup: function gl_renderGroup(group) {
    var groupElem = document.createElement('div');
    groupElem.id = this._getGroupElemId(group.index);
    if (this.options.disableDataIndexer == false) {
      groupElem.appendChild(this.options.indexRender(group.index));
    }
    var self = this;
    // Render data list
    group.dataList.forEach(function(dataObj) {
      var dataElem = self.options.renderFunc(dataObj);
      if (dataElem) {
        dataElem.dataset.dataIdentity = self.options.dataIdentifier(dataObj);
        groupElem.appendChild(dataElem);
      }
    });

    return groupElem;
  },

  _getGroupElemId: function gl_getGroupElemId(index) {
    return 'id-grouped-data-' + index;
  },

  _getGroupElem: function gl_getGroupElem(index) {
    return $id(this._getGroupElemId(index));
  },

  render: function gl_render() {
    this._groupDataList();
    this._renderDataList();
  },

  add: function gl_add(dataObj) {
    var group = this._addToGroup(dataObj);
    this._sortGroup();

    var groupElem = this._getGroupElem(group.index);
    if (groupElem) {
      // TODO sort data elements
      var elem = this.options.renderFunc(dataObj);
      if (elem) {
        elem.dataset.dataIdentity = this.options.dataIdentifier(dataObj);
        groupElem.appendChild(elem);
      }
      this.options.ondatachange();
      return;
    }

    // If group is newly created, then render the whole group
    groupElem = this._renderGroup(group);
    var position = this._getGroupPosition(group.index);
    if (position == this._groupedData.length - 1) {
      this.options.container.appendChild(groupElem);
    } else {
      var groupAfter = this._groupedData[position + 1];
      this.options.container.insertBefore(groupElem, this._getGroupElem(groupAfter.index));
    }
    this.options.ondatachange();
  },

  remove: function gl_remove(dataObj) {
    var group = this._removeFromGroup(dataObj);

    var groupElem = this._getGroupElem(group.index);

    // remove whole group
    if (group.dataList.length === 0) {
      groupElem.parentNode.removeChild(groupElem);
      this._groupedData.splice(this._groupedData.indexOf(group),1);
    } else {
      for (var i = 0; i < groupElem.childNodes.length; i++) {
        var child = groupElem.childNodes[i];
        if (child.dataset.dataIdentity == this.options.dataIdentifier(dataObj)) {
          child.parentNode.removeChild(child);
          break;
        }
      }
    }

    this.options.ondatachange();
  },

  getGroupedData: function gl_getGroupedData() {
    return this._groupedData;
  },

  count: function gl_count() {
    var count = 0;
    if (this._groupedData.length == 0) {
      return count;
    }
    this._groupedData.forEach(function(group) {
      count += group.dataList.length;
    });

    return count;
  }
};

function SendSMSDialog(options) {
  this.initailize(options);
}

SendSMSDialog.closeAll = function() {
  var evt = document.createEvent('Event');
  evt.initEvent('SendSMSDialog:show', true, true);
  document.dispatchEvent(evt);
};

SendSMSDialog.prototype = {
  initailize: function(options) {
    this.options = extend({
      onclose: emptyFunction
    }, options);

    this._modalElement = null;
    this._mask = null;
    this._build();
  },

  _build: function() {
    var self = this;
    this._mask = document.createElement('div');
    this._mask.className = 'modal-mask';
    document.body.appendChild(this._mask);
    var templateData = {
      type: this.options.type,
      number: [],
      body: '',
      textCount: '',
      senderCount: ''
    };
    var defaultName = '';
    if (this.options.type == 'single') {
      if (this.options.name && this.options.name.length > 0) {
        defaultName = this.options.name[0];
      }
      if (this.options.number && this.options.number.length > 0) {
        defaultName += '(' + this.options.number[0].value + ')';
      }
      templateData.number.push(defaultName);
    } else {
      if (this.options.number) {
        templateData.number.push(this.options.number);
      }
      var senderNum = 0;
      if (this.options.number) {
        var senders = this.options.number.split(';');
        senderNum = senders.length;
        for (var i = 0; i < senders.length; i++) {
          if (senders[i] == "") {
            senderNum--;
          }
        }
      }
      header = _('send-sms-count', {
        n: senderNum
      });
      templateData.senderCount = header;
    }
    var header = _('text-sms-count', {
      n: 0
    });
    templateData.textCount = header;
    if (this.options.bodyText) {
      templateData.body = this.options.bodyText;
    }

    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    this._modalElement.innerHTML = tmpl('tmpl_sendSms_dialog', templateData);
    document.body.appendChild(this._modalElement);

    this._adjustModalPosition();
    this._makeDialogCancelable();

    // Translate l10n value
    navigator.mozL10n.translate(this._modalElement);

    // Only one modal dialog is shown at a time.
    this._onModalDialogShown = function(event) {
      // Show a popup dialog at a time.
      if (event.targetElement == self._modalElement) {
        return;
      }
      self.close();
    }
    document.addEventListener('SendSMSDialog:show', this._onModalDialogShown);
    // Make sure other modal dialog has a chance to close itself.
    this._fireEvent('SendSMSDialog:show');
    // Tweak modal dialog position when resizing.
    this._onWindowResize = function(event) {
      self._adjustModalPosition();
    };
    window.addEventListener('resize', this._onWindowResize);
  },

  _makeDialogCancelable: function() {
    var self = this;
    var closeBtn = $expr('.sendSms-dialog-header-x', self._modalElement)[0];
    closeBtn.hidden = false;
    closeBtn.addEventListener('click', self.close.bind(self));
    var okBtn = $expr('.button-send', self._modalElement)[0];
    okBtn.hidden = false;
    if (self.options.type == 'single') {
      okBtn.addEventListener('click', self.sendSingle.bind(self));
    } else {
      okBtn.addEventListener('click', self.send.bind(self));
    }

    okBtn.addEventListener('keydown', function(event) {
      if (event.keyCode == 27) {
        self.close();
      }
    });
    var cancelBtn = $expr('.button-cancel', self._modalElement)[0];
    cancelBtn.hidden = false;
    cancelBtn.addEventListener('click', self.close.bind(self));

    $id('content').addEventListener('keyup', function onclick_addNewSms(event) {
      var header = _('text-sms-count', {
        n: this.value.length
      });
      $id('text-count').innerHTML = header;
    });

    if (self.options.type == 'single') {
      if (self.options.number.length > 1) {
        $id('select-contact-tel-button').addEventListener('click', function onclick_selectContactTel(event) {
          var titleElem = $id('select-contact-tel-header');
          var elem = document.createElement('div');
          var templateData = {
            name: '',
            number: self.options.number
          };
          if (self.options.name && self.options.name.length > 0) {
            templateData.name = self.options.name[0];
          }
          try {
            elem.innerHTML = tmpl('tmpl_select_contact', templateData);
          } catch (e) {
            alert(e);
          }
          elem.onclick = function onclick_sms_list(event) {
            var target = event.target;
            if (target.textContent != '') {
              var titleElem = $expr('.label', self._modalElement)[0];
              if ( !! titleElem) {
                titleElem.innerHTML = target.textContent;
              }
              titleElem = $id('select-contact-tel-header');
              var child = titleElem.childNodes[5];
              if (child) {
                child.parentNode.removeChild(child);
              }
            }
          };
          titleElem.appendChild(elem);
        });
      }
    } else {
      $id('address').addEventListener('keydown', function onclick_addNewSms(event) {
        var senders = this.value.split(';');
        var senderNum = senders.length;
        for (var i = 0; i < senders.length; i++) {
          if (senders[i] == "") {
            senderNum--;
          }
        }
        var header = _('send-sms-count', {
          n: senderNum
        });
        $id('sender-count').innerHTML = header;
      });
      $id('button-add-contact').addEventListener('click', function(event) {
        CMD.Contacts.getAllContacts(function onresponse_getAllContacts(message) {
          var dataJSON = JSON.parse(message.data);
          new SelectContactsDialog({
            contactList: dataJSON,
            onok: self._selectContacts
          });
        }, function onerror_getAllContacts(message) {
          log('Error occurs when fetching all contacts.');
        });
      });
    }
    // Make sure we can close the dialog by hitting ENTER or ESC
    okBtn.focus();
  },

  _adjustModalPosition: function() {
    var container = $expr('.sendSms-dialog', this._modalElement)[0];
    var documentHeight = document.documentElement.clientHeight;
    var containerHeight = container.clientHeight;
    container.style.top = (documentHeight > containerHeight ? (documentHeight - containerHeight) / 2 : 0) + 'px';
  },

  _selectContacts: function(data) {
    var titleElem = $expr('.input-contact', this._modalElement)[0];
    if ((titleElem.value.length > 0) && (titleElem.value[titleElem.value.length - 1] != ";")) {
      titleElem.value += ';';
    }
    for (var i = 0; i < data.length; i++) {
      var contact = JSON.parse(data[i]);
      if (contact.tel && contact.tel.length > 0) {
        var sendStr = contact.name + "(" + contact.tel[0].value + ");";
        var searchStr = contact.tel[0].value + ";";
        if (titleElem.value.contains(searchStr)) {
          titleElem.value = titleElem.value.replace(searchStr, sendStr);
        } else {
          if (!titleElem.value.contains("(" + contact.tel[0].value + ")")) {
            titleElem.value += sendStr;
          }
        }
      }
    }
    var senders = titleElem.value.split(';');
    var senderNum = senders.length;
    for (var i = 0; i < senders.length; i++) {
      if (senders[i] == "") {
        senderNum--;
      }
    }
    var header = _('send-sms-count', {
      n: senderNum
    });
    $id('sender-count').innerHTML = header;
  },

  _fireEvent: function(name, data) {
    var evt = document.createEvent('Event');
    evt.initEvent(name, true, true);
    evt.data = data;
    evt.targetElement = this._modalElement;
    document.dispatchEvent(evt);
  },

  close: function() {
    this._mask.parentNode.removeChild(this._mask);
    this._modalElement.parentNode.removeChild(this._modalElement);
    this._mask = null;
    this._modalElement = null;
    document.removeEventListener('SendSMSDialog:show', this._onModalDialogShown);
    window.removeEventListener('resize', this._onWindowResize)
    this.options.onclose();
  },

  sendSingle: function() {
    var loadingGroupId = animationLoading.start();
    var tel = $id('selected-contact-tel');
    var message = $id('content');
    var sender = [tel.textContent];
    var self = this;
    message.readOnly = true;
    CMD.SMS.sendSMS(JSON.stringify({
      number: sender,
      message: message.value
    }), function onSuccess_sendSms(event) {
      if (!event.result) {
        self._mask.parentNode.removeChild(self._mask);
        self._modalElement.parentNode.removeChild(self._modalElement);
        self._mask = null;
        self._modalElement = null;
        document.removeEventListener('SendSMSDialog:show', self._onModalDialogShown);
        window.removeEventListener('resize', self._onWindowResize);
        animationLoading.stop(loadingGroupId);
        self.options.onclose();
      }
    }, function onError_sendSms(e) {
      alert(e);
    });
  },

  send: function() {
    var loadingGroupId = animationLoading.start();
    var number = $id('address').value.split(';');
    var message = $id('content');
    var sender = [];
    var self = this;
    message.readOnly = true;
    number.forEach(function(item) {
      var start = item.indexOf("(");
      var end = item.indexOf(")");
      if (start >= 0 && end > 0) {
        sender.push(item.slice(start + 1, end));
      } else if (item != "") {
        sender.push(item);
      }
    });
    CMD.SMS.sendSMS(JSON.stringify({
      number: sender,
      message: message.value
    }), function onSuccess_sendSms(event) {
      if (!event.result) {
        self._mask.parentNode.removeChild(self._mask);
        self._modalElement.parentNode.removeChild(self._modalElement);
        self._mask = null;
        self._modalElement = null;
        document.removeEventListener('SendSMSDialog:show', self._onModalDialogShown);
        window.removeEventListener('resize', self._onWindowResize);
        animationLoading.stop(loadingGroupId);
        self.options.onclose();
      }
    }, function onError_sendSms(e) {
      animationLoading.stop(loadingGroupId);
      alert(e);
    });
  }
};

function SelectContactsDialog(options) {
  this.initailize(options);
}

SelectContactsDialog.prototype = {
  initailize: function(options) {
    this.options = extend({
      contactList: null,
      onok: emptyFunction
    }, options);
    this._modalElement = null;
    this._mask = null;
    this._build();
  },

  _build: function() {
    this._mask = document.createElement('div');
    this._mask.className = 'modal-mask';
    document.body.appendChild(this._mask);
    var templateData = {};
    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    try {
      this._modalElement.innerHTML = tmpl('tmpl_select_contact_dialog', templateData);
    } catch (e) {
      alert(e);
    }

    document.body.appendChild(this._modalElement);
    var closeBtn = $expr('.sendSms-dialog-header-x', this._modalElement)[0];
    closeBtn.hidden = false;
    closeBtn.addEventListener('click', this.close.bind(this));

    var cancelBtn = $expr('.button-cancel', this._modalElement)[0];
    cancelBtn.hidden = false;
    cancelBtn.addEventListener('click', this.close.bind(this));

    var okBtn = $expr('.button-send', this._modalElement)[0];
    okBtn.hidden = false;
    okBtn.addEventListener('click', this.select.bind(this));
    var self = this;
    okBtn.addEventListener('keydown', function(event) {
      if (event.keyCode == 27) {
        self.close();
      }
    });
    // Translate l10n value
    navigator.mozL10n.translate(this._modalElement);
    // Only one modal dialog is shown at a time.
    var self = this;
    this._onModalDialogShown = function(event) {
      // Show a popup dialog at a time.
      if (event.targetElement == self._modalElement) {
        return;
      }
      self.close();
    }
    document.addEventListener('SelectContactsDialog:show', this._onModalDialogShown);
    // Make sure other modal dialog has a chance to close itself.
    this._fireEvent('SelectContactsDialog:show');

    var contactSmallListContainer = $id('sendSms-smartlist-container');
    contactSmallListContainer.innerHTML = '';
    contactSmallList = new GroupedList({
      dataList: this.options.contactList,
      dataIndexer: function getContactIndex(contact) {
        var firstChar = contact.name[0].charAt(0).toUpperCase();
        var pinyin = makePy(firstChar);
        if (pinyin.length == 0) {
          return '#';
        }
        return pinyin[0].toUpperCase();
      },
      renderFunc: this._createContactListItem,
      container: contactSmallListContainer,
    });
    contactSmallList.render();
    contactSmallList.getGroupedData().forEach(function(group) {
      group.dataList.forEach(function(contact) {
        if (( !! contact.photo) && (contact.photo.length > 0)) {
          var item = $id('smartlist-contact-' + contact.id);
          if ( !! item) {
            var img = item.getElementsByTagName('img')[0];
            img.src = contact.photo;
            item.dataset.avatar = contact.photo;
            img.classList.remove('avatar-default');
          }
        }
      });
    });
    var itemNum = $expr('#sendSms-smartlist-container .contact-list-item[data-checked="true"]').length;
    var header = _('contacts-selected', {
      n: itemNum
    });
    $id('select-contact-count').innerHTML = header;
  },

  _createContactListItem: function(contact) {
    var templateData = {
      name: '',
      tel: ''
    };
    if (contact.name) {
      templateData.name = contact.name.join(' ');
    }
    if (contact.tel && contact.tel.length > 0) {
      templateData.tel = contact.tel[0].value;
    }
    var elem = document.createElement('div');
    elem.classList.add('contact-list-item');
    if (contact.category && contact.category.indexOf('favorite') > -1) {
      elem.classList.add('favorite');
    }
    elem.innerHTML = tmpl('tmpl_select_contact_item', templateData);
    elem.dataset.contact = JSON.stringify(contact);
    elem.dataset.contactId = contact.id;
    elem.id = 'smartlist-contact-' + contact.id;
    elem.dataset.avatar = '';
    elem.dataset.checked = false;
    elem.onclick = function onclick_contact_list(event) {
      var target = event.target;
      var itemNum;
      var header;
      if (target instanceof HTMLLabelElement) {
        var item = $expr('label', elem)[0];
        var select = false;
        if (item.dataset.checked == 'false') {
          select = true;
        }
        elem.dataset.checked = elem.dataset.focused = item.dataset.checked = select;
        itemNum = $expr('#sendSms-smartlist-container .contact-list-item[data-checked="true"]').length;
        header = _('contacts-selected', {
          n: itemNum
        });
        $id('select-contact-count').innerHTML = header;
      } else {
        item = $expr('label', elem)[0];
        if (item) {
          item.dataset.checked = true;
        }
        elem.dataset.checked = elem.dataset.focused = true;
        itemNum = $expr('#sendSms-smartlist-container .contact-list-item[data-checked="true"]').length;
        header = _('contacts-selected', {
          n: itemNum
        });
        $id('select-contact-count').innerHTML = header;
      }
    };

    return elem;
  },

  _fireEvent: function(name, data) {
    var evt = document.createEvent('Event');
    evt.initEvent(name, true, true);
    evt.data = data;
    evt.targetElement = this._modalElement;
    document.dispatchEvent(evt);
  },

  close: function() {
    this._mask.parentNode.removeChild(this._mask);
    this._modalElement.parentNode.removeChild(this._modalElement);
    this._mask = null;
    this._modalElement = null;
    document.removeEventListener('SelectContactsDialog:show', this._onModalDialogShown);
  },
  select: function() {
    var ids = [];
    $expr('#sendSms-smartlist-container .contact-list-item[data-checked="true"]').forEach(function(item) {
      ids.push(item.dataset.contact);
    });
    this.options.onok(ids);
    this.close();
  }
};

function FilesOPDialog(options) {
  this.initailize(options);
}

FilesOPDialog.prototype = {
  initailize: function(options) {
    this.options = extend({
      onclose: emptyFunction,
      title_l10n_id: '',
      processbar_l10n_id: ''
    }, options);

    this._modalElement = null;
    this._mask = null;
    this._build();
  },

  closeAll: function() {
    var evt = document.createEvent('Event');
    evt.initEvent('FilesOPDialog:show', true, true);
    document.dispatchEvent(evt);
  },

  _build: function() {
    this._mask = document.createElement('div');
    this._mask.className = 'modal-mask';
    document.body.appendChild(this._mask);

    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    var templateData = {
      title_l10n_id: '',
      processbar_l10n_id: ''
    };
    if (this.options.title_l10n_id != '') {
      templateData.title_l10n_id = this.options.title_l10n_id;
    }
    if (this.options.processbar_l10n_id != '') {
      templateData.processbar_l10n_id = this.options.processbar_l10n_id;
    }

    try {
      this._modalElement.innerHTML = tmpl('tmpl_fileOP_dialog', templateData);
    } catch (e) {
      alert(e);
    }

    document.body.appendChild(this._modalElement);
    this._adjustModalPosition();
    this._makeDialogCancelable();

    // Translate l10n value
    navigator.mozL10n.translate(this._modalElement);

    // Only one modal dialog is shown at a time.
    var self = this;
    this._onModalDialogShown = function(event) {
      // Show a popup dialog at a time.
      if (event.targetElement == self._modalElement) {
        return;
      }

      self.close();
    }
    document.addEventListener('FilesOPDialog:show', this._onModalDialogShown);

    // Make sure other modal dialog has a chance to close itself.
    this._fireEvent('FilesOPDialog:show');

    // Tweak modal dialog position when resizing.
    this._onWindowResize = function(event) {
      self._adjustModalPosition();
    };
    window.addEventListener('resize', this._onWindowResize);
  },

  _makeDialogCancelable: function() {
    var closeBtn = $expr('.select-multi-files-dialog-header-x', this._modalElement)[0];
    closeBtn.hidden = false;
    closeBtn.addEventListener('click', this.close.bind(this));

    var cancelBtn = $expr('.button-cancel', this._modalElement)[0];
    cancelBtn.hidden = false;
    cancelBtn.addEventListener('click', this.close.bind(this));

    var self = this;
  },

  _adjustModalPosition: function() {
    var container = $expr('.modal-container', this._modalElement)[0];
    var documentHeight = document.documentElement.clientHeight;
    var containerHeight = container.clientHeight;
    container.style.top = (documentHeight > containerHeight ? (documentHeight - containerHeight) / 2 : 0) + 'px';
  },

  _fireEvent: function(name, data) {
    var evt = document.createEvent('Event');
    evt.initEvent(name, true, true);
    evt.data = data;
    evt.targetElement = this._modalElement;
    document.dispatchEvent(evt);
  },

  close: function() {
    this._mask.parentNode.removeChild(this._mask);
    this._modalElement.parentNode.removeChild(this._modalElement);
    this._mask = null;
    this._modalElement = null;
    document.removeEventListener('FilesOPDialog:show', this._onModalDialogShown);
    window.removeEventListener('resize', this._onWindowResize)
    this.options.onclose();
  }
};

function ImageViewer(options) {
  this.initailize(options);
}

ImageViewer.prototype = {
  initailize: function(options) {
    this.options = extend({
      onclose: emptyFunction,
      count: 0,
      currentIndex: 0,
      getPictureAt: emptyFunction
    }, options);

    if (this.options.count <= 0) {
      alert("Gallery is empty");
      return;
    }
    this._modalElement = null;
    this._mask = null;
    this._build();
  },

  closeAll: function() {
    var evt = document.createEvent('Event');
    evt.initEvent('ImageViewer:show', true, true);
    document.dispatchEvent(evt);
  },

  _build: function() {
    this.options.getPictureAt(this.options.currentIndex, function(bCached, cachedUrl) {
      if (!bCached) {
        alert('Cache picture failed');
        return;
      }

      this._mask = document.createElement('div');
      this._mask.className = 'mask';
      var container = document.getElementById('modal-container');
      container.appendChild(this._mask);

      this._modalElement = document.createElement('div');
      this._modalElement.className = 'dialog';

      var templateData = {
        cachedUrl: cachedUrl
      };

      try {
        this._modalElement.innerHTML = tmpl('tmpl_img_viewer', templateData);
      } catch (e) {
        alert(e);
      }
      container.appendChild(this._modalElement);
      this._addListeners();

      var self = this;
      document.addEventListener('keypress', function(e) {
        self._fireEvent('ImageViewer:show', e.keyCode);
      });

      this._onImageViewerShown = function(event) {
        if (event.data && event.data == 37) {
          if ($id('gallery-view').dataset.shown == 'true') {
            self._showPreviousPic();
          }
          return;
        }
        if (event.data && event.data == 39) {
          if ($id('gallery-view').dataset.shown == 'true') {
            self._showNextPic();
          }
          return;
        }
        if (event.targetElement == self._modalElement) {
          return;
        }
      }
      document.addEventListener('ImageViewer:show', this._onImageViewerShown);

      this._fireEvent('ImageViewer:show');
    }.bind(this));
  },

  _showPreviousPic: function() {
    this.options.currentIndex -= 1;
    if (this.options.currentIndex < 0) {
      this.options.currentIndex += this.options.count;
    }
    this.options.getPictureAt(this.options.currentIndex, function(bCached, cachedUrl) {
      if (!bCached) {
        $id('pic-content').setAttribute('src', '');
        alert('Cache picture failed');
        return;
      }
      $id('pic-content').setAttribute('src', cachedUrl);
    });
  },

  _showNextPic: function() {
    this.options.currentIndex += 1;
    if (this.options.currentIndex >= this.options.count) {
      this.options.currentIndex -= this.options.count;
    }
    this.options.getPictureAt(this.options.currentIndex, function(bCached, cachedUrl) {
      if (!bCached) {
        $id('pic-content').setAttribute('src', '');
        alert('Cache picture failed');
        return;
      }
      $id('pic-content').setAttribute('src', cachedUrl);;
    });
  },

  _addListeners: function() {
    var closeBtn = $expr('.closeX', this._modalElement)[0];
    closeBtn.hidden = false;
    closeBtn.addEventListener('click', this.close.bind(this));
    $id('gallery-left-arrow').addEventListener('click', this._showPreviousPic.bind(this));
    $id('gallery-right-arrow').addEventListener('click', this._showNextPic.bind(this));
  },

  _fireEvent: function(name, data) {
    var evt = document.createEvent('Event');
    evt.initEvent(name, true, true);
    evt.data = data;
    evt.targetElement = this._modalElement;
    document.dispatchEvent(evt);
  },

  close: function() {
    this._mask.parentNode.removeChild(this._mask);
    this._modalElement.parentNode.removeChild(this._modalElement);
    this._mask = null;
    this._modalElement = null;
    document.removeEventListener('ImageViewer:show', this._onModalDialogShown);
    this.options.onclose();
  }
};

function WifiModePromptDialog(options) {
  this.initailize(options);
}

WifiModePromptDialog.prototype = {
  initailize: function(options) {
    this.options = extend({
      onclose: emptyFunction,
      title_l10n_id: '',
      prompt_l10n_id: ''
    }, options);

    this._modalElement = null;
    this._mask = null;
    this._build();
  },

  closeAll: function() {
    var evt = document.createEvent('Event');
    evt.initEvent('WifiModePromptDialog:show', true, true);
    document.dispatchEvent(evt);
  },

  _build: function() {
    this._mask = document.createElement('div');
    this._mask.className = 'modal-mask';
    document.body.appendChild(this._mask);

    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    var templateData = {
      title_l10n_id: '',
      prompt_l10n_id: ''
    };
    if (this.options.title_l10n_id != '') {
      templateData.title_l10n_id = this.options.title_l10n_id;
    }
    if (this.options.prompt_l10n_id != '') {
      templateData.prompt_l10n_id = this.options.prompt_l10n_id;
    }
    try {
      this._modalElement.innerHTML = tmpl('tmpl_wifiMode_dialog', templateData);
    } catch (e) {
      alert(e);
    }
    document.body.appendChild(this._modalElement);
    this._adjustModalPosition();
    this._makeDialogCancelable();

    // Translate l10n value
    navigator.mozL10n.translate(this._modalElement);

    // Only one modal dialog is shown at a time.
    var self = this;
    this._onModalDialogShown = function(event) {
      // Show a popup dialog at a time.
      if (event.targetElement == self._modalElement) {
        return;
      }

      self.close();
    }
    document.addEventListener('WifiModePromptDialog:show', this._onModalDialogShown);

    // Make sure other modal dialog has a chance to close itself.
    this._fireEvent('WifiModePromptDialog:show');

    // Tweak modal dialog position when resizing.
    this._onWindowResize = function(event) {
      self._adjustModalPosition();
    };
    window.addEventListener('resize', this._onWindowResize);
  },

  _makeDialogCancelable: function() {
    var closeBtn = $expr('.select-multi-files-dialog-header-x', this._modalElement)[0];
    closeBtn.hidden = false;
    closeBtn.addEventListener('click', this.close.bind(this));

    var cancelBtn = $expr('.button-cancel', this._modalElement)[0];
    cancelBtn.hidden = false;
    cancelBtn.addEventListener('click', this.close.bind(this));

    var self = this;
  },

  _adjustModalPosition: function() {
    var container = $expr('.modal-container', this._modalElement)[0];
    var documentHeight = document.documentElement.clientHeight;
    var containerHeight = container.clientHeight;
    container.style.top = (documentHeight > containerHeight ? (documentHeight - containerHeight) / 2 : 0) + 'px';
  },

  _fireEvent: function(name, data) {
    var evt = document.createEvent('Event');
    evt.initEvent(name, true, true);
    evt.data = data;
    evt.targetElement = this._modalElement;
    document.dispatchEvent(evt);
  },

  close: function() {
    this._mask.parentNode.removeChild(this._mask);
    this._modalElement.parentNode.removeChild(this._modalElement);
    this._mask = null;
    this._modalElement = null;
    document.removeEventListener('WifiModePromptDialog:show', this._onModalDialogShown);
    window.removeEventListener('resize', this._onWindowResize)
    this.options.onclose();
  }
};

var animationLoadingDialog = function() {
  this.groupId = 0;
  this.startNum = 0;
  this._modalElement = document.createElement('div');
  this._modalElement.className = 'loading-dialog';
  var templateData = {};
  this._modalElement.innerHTML = tmpl('tmpl_loading_dialog', templateData);
};

animationLoadingDialog.prototype = {
  start: function() {
    this.startNum++;
    if (this.startNum > 1) {
      return this.groupId;
    }
    var containerHeight = $id('container').clientHeight;
    var documentHeight = document.documentElement.clientHeight;
    var loading = $expr('.loading', this._modalElement)[0];
    loading.style.top = (documentHeight > containerHeight ? (containerHeight - loading.clientHeight) / 2 : (documentHeight - loading.clientHeight) / 2) + 'px';
    document.body.appendChild(this._modalElement);
    return this.groupId;
  },

  stop: function(groupId) {
    if ((this.startNum <= 0) || (groupId != this.groupId)) {
      return;
    }
    this.startNum--;
    if (this.startNum == 0) {
      this._modalElement.parentNode.removeChild(this._modalElement);
    }
  },

  reset: function() {
    if (this.startNum > 0) {
      this.startNum = 0;
      this.groupId++;
      this._modalElement.parentNode.removeChild(this._modalElement);
    }
  },
};