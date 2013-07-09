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
      return self.options.dataIdentifier(obj) ===
               self.options.dataIdentifier(dataObj);
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
    if(this.options.disableDataIndexer == false){
      groupElem.appendChild(this.options.indexRender(group.index));
    }
    var self = this;
    // Render data list
    group.dataList.forEach(function(dataObj) {
      var dataElem = self.options.renderFunc(dataObj);
      if(dataElem){
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
      if(elem){
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
      this.options.container.insertBefore(groupElem,
        this._getGroupElem(groupAfter.index));
    }
    this.options.ondatachange();
  },

  remove: function gl_remove(dataObj) {
    var group = this._removeFromGroup(dataObj);

    var groupElem = this._getGroupElem(group.index);

    // remove whole group
    if (group.dataList.length === 0) {
      groupElem.parentNode.removeChild(groupElem);
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

function ModalDialog(options) {
  this.initailize(options);
}

ModalDialog.closeAll = function() {
  var evt = document.createEvent('Event');
  evt.initEvent('ModalDialog:show', true, true);
  document.dispatchEvent(evt);
};

ModalDialog.prototype = {
  initailize: function(options) {
    this.options = extend({
      title: 'Modal Title',
      titleL10n: null,
      bodyElement: null,
      bodyText: null,
      bodyTextL10n: null,
      cancelable: true,
      onclose: emptyFunction
    }, options);

    if (!this.options.bodyElement && !this.options.bodyText) {
      throw Error('bodyElement or bodyText should be specified');
    }

    this._modalElement = null;
    this._mask = null;
    this._build();
  },

  _build: function() {
    this._mask = document.createElement('div');
    this._mask.className = 'modal-mask';
    document.body.appendChild(this._mask);

    // TODO using template
    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    this._modalElement.innerHTML = '<div class="modal-container">'
      + '  <div class="modal-close-btn" hidden="true">X</div>'
      + '  <div class="modal-title">'
      + this.options.title
      + '  </div>'
      + '  <div class="modal-body">'
      + '  </div>'
      + '  <div class="modal-btn-container">'
      + '    <input hidden="true" class="modal-btn modal-btn-ok" type="button" data-l10n-id="OK" value="OK" />'
      + '  </div>'
      + '</div>';

    var titleElem = $expr('.modal-title', this._modalElement)[0];
    if (this.options.titleL10n) {
      titleElem.dataset.l10nId = this.options.titleL10n;
    }

    var bodyContainer = $expr('.modal-body', this._modalElement)[0];
    if (this.options.bodyElement) {
      bodyContainer.appendChild(this.options.bodyElement);
    } else {
      bodyContainer.textContent = this.options.bodyText;
      if (this.options.bodyTextL10n) {
        bodyContainer.dataset.l10nId = this.options.bodyTextL10n;
      }
    }

    document.body.appendChild(this._modalElement);
    this._adjustModalPosition();

    if (this.options.cancelable) {
      this._makeDialogCancelable();
    }

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
    document.addEventListener('ModalDialog:show', this._onModalDialogShown);

    // Make sure other modal dialog has a chance to close itself.
    this._fireEvent('ModalDialog:show');

    // Tweak modal dialog position when resizing.
    this._onWindowResize = function(event) {
      self._adjustModalPosition();
    };
    window.addEventListener('resize', this._onWindowResize);
  },

  _makeDialogCancelable: function() {
   var closeBtn = $expr('.modal-close-btn', this._modalElement)[0];

   closeBtn.hidden = false;
   closeBtn.addEventListener('click', this.close.bind(this));

   var okBtn = $expr('.modal-btn-ok', this._modalElement)[0];
   okBtn.hidden = false;
   okBtn.addEventListener('click', this.close.bind(this));

   var self = this;
   okBtn.addEventListener('keydown', function(event) {
     if (event.keyCode == 27) {
       self.close();
     }
   });

   // Make sure we can close the dialog by hitting ENTER or ESC
   okBtn.focus();

   // Close modal dialog when mousedown on the realestate outside.
   this._modalElement.addEventListener('mousedown', this.close.bind(this));
   var container = $expr('.modal-container', this._modalElement)[0];
   container.addEventListener('mousedown', function(event) {
     event.stopPropagation();
   }, true); 
  },

  _adjustModalPosition: function() {
    var container = $expr('.modal-container', this._modalElement)[0];
    var documentHeight = document.documentElement.clientHeight;
    var containerHeight = container.clientHeight;
    container.style.top = (documentHeight > containerHeight ?
      (documentHeight - containerHeight) / 2 : 0) + 'px';
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

    document.removeEventListener('ModalDialog:show', this._onModalDialogShown);
    window.removeEventListener('resize', this._onWindowResize)

    this.options.onclose();
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
    this._mask = document.createElement('div');
    this._mask.className = 'modal-mask';
    document.body.appendChild(this._mask);

    // TODO using template
    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    this._modalElement.innerHTML = '<div class="w-ui-window draggable">'
	+ '<header class="w-ui-window-header drag-handel">'
	+ '<div class="w-ui-window-header-title" data-l10n-id="w-send-sms"></div>'
	+ '<div class="w-ui-window-header-x" style=""></div>'
	+ '</header>'
	+ '<div class="w-ui-window-body">'
	+ '<div class="w-message-sender-window">'
	+ '<div class="header">'
	+ '<label data-l10n-id="w-send-address" class="cf" for="address"></label>'
	+ '<div class="address">'
	+ '<input id="address" type="text" class="input-contact searchbox">'
	+ '</div>'
	+ '<button data-l10n-id="w-add-contact" class="w-icon-btn button-add-contact">'
	+ '<span class="icon add-grey"></span>'
	+ '</button>'
	+ '</div>'
	+ '<div class="body">'
	+ '<label data-l10n-id="w-send-content" class="cf" for="content"></label>'
	+ '<textarea id="content" class="input-content" autofocus="true"></textarea>'
	+ '</div>'
	+ '<div class="monitor text-secondary">'
	+ '<span id="text-count" class="content-count"></span>'
	+ '<span id="sender-count" class="contacts-count"></span>'
	+ '</div>'
	+ '</div>'
	+ '</div>'
	+ '<footer class="w-ui-window-footer" style="">'
	+ '<div class="w-ui-window-footer-monitor"></div>'
	+ '<div class="w-ui-window-footer-button-ctn">'
	+ '<button data-l10n-id="w-send-button" class="button-send primary"></button>'
	+ '<button data-l10n-id="cancel" class="button-cancel primary"></button>'
	+ '</div>'
	+ '</footer>'
        + '</div>';

    var titleElem = $expr('.input-contact', this._modalElement)[0];
    if (this.options.number) {
      titleElem.value = this.options.number;
    }

    var bodyContainer = $expr('.input-content', this._modalElement)[0];
    if (this.options.bodyText) {
      bodyContainer.textContent = this.options.bodyText;
    }
    document.body.appendChild(this._modalElement);
    this._adjustModalPosition();
    this._makeDialogCancelable();

    var header = _('text-sms-count', {
      n: 0
    });
    $id('text-count').innerHTML = header;
    header = _('send-sms-count', {
      n: 0
    });
    $id('sender-count').innerHTML = header;
   
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
   var closeBtn = $expr('.w-ui-window-header-x', this._modalElement)[0];
   closeBtn.hidden = false;
   closeBtn.addEventListener('click', this.close.bind(this));

   var okBtn = $expr('.button-send', this._modalElement)[0];
   okBtn.hidden = false;
   okBtn.addEventListener('click', this.send.bind(this));
   var self = this;
   okBtn.addEventListener('keydown', function(event) {
     if (event.keyCode == 27) {
       self.close();
     }
   });

   var cancelBtn = $expr('.button-cancel', this._modalElement)[0];
   cancelBtn.hidden = false;
   cancelBtn.addEventListener('click', this.close.bind(this));

   var self = this;
   var selectBtn = $expr('.button-add-contact', this._modalElement)[0];
   selectBtn.hidden = false;
   selectBtn.addEventListener('click', function(event) {
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

   $id('content').addEventListener('keyup', function onclick_addNewSms(event) {
      var header = _('text-sms-count', {
        n: this.value.length
      });
      $id('text-count').innerHTML = header;
    });

   $id('address').addEventListener('keydown', function onclick_addNewSms(event) {
      var senders = this.value.split(';');
      var senderNum = senders.length;
      for(var i=0;i<senders.length;i++){
        if(senders[i] == ""){
          senderNum--;
        }
      }
      var header = _('send-sms-count', {
        n: senderNum
      });
      $id('sender-count').innerHTML = header;
    });
   // Make sure we can close the dialog by hitting ENTER or ESC
   okBtn.focus();

   // Close modal dialog when mousedown on the realestate outside.
/*   this._modalElement.addEventListener('mousedown', this.close.bind(this));
   var container = $expr('.modal-container', this._modalElement)[0];
   container.addEventListener('mousedown', function(event) {
     event.stopPropagation();
   }, true); */
  },

  _adjustModalPosition: function() {
/*    var container = $expr('.modal-container', this._modalElement)[0];
    var documentHeight = document.documentElement.clientHeight;
    var containerHeight = container.clientHeight;
    container.style.top = (documentHeight > containerHeight ?
      (documentHeight - containerHeight) / 2 : 0) + 'px';*/
  },

  _selectContacts: function(data) {
    var titleElem = $expr('.input-contact', this._modalElement)[0];
    if((titleElem.value.length > 0) && (titleElem.value[titleElem.value.length-1] != ";")){
      titleElem.value += ';';
      //titleElem.value = titleElem.value.replace(/[ ]/g,"")
    }
    for( var i=0;i<data.length;i++){
      var contact = JSON.parse(data[i]);
      var sendStr = contact.name + "(" + contact.tel[0].value + ");";
      var searchStr = contact.tel[0].value+";";
      if(titleElem.value.indexOf(searchStr) >= 0){
        titleElem.value = titleElem.value.replace(searchStr, sendStr);
      }else{
        if(titleElem.value.indexOf("("+contact.tel[0].value+")") < 0 ){
          titleElem.value += sendStr;
        }
      }
    }
    var senders = titleElem.value.split(';');
    var senderNum = senders.length;
    for(var i=0;i<senders.length;i++){
      if(senders[i] == ""){
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
  send: function() {
    var number = $id('address').value.split(';');
    var message = $id('content').value;
    var sender = [];
    var self=this;
    number.forEach(function(item) {
      var start = item.indexOf("(");
      var end = item.indexOf(")");
      if(start >= 0 &&  end > 0){
        sender.push(item.slice(start+1,end));
      }else if(item != ""){
        sender.push(item);
      }
    });
    CMD.SMS.sendMessages(JSON.stringify({number:sender, message: message}),
      function onSuccess_sendSms(event) {
        if(!event.result) {
          self._mask.parentNode.removeChild(self._mask);
          self._modalElement.parentNode.removeChild(self._modalElement);
          self._mask = null;
          self._modalElement = null;
          document.removeEventListener('SendSMSDialog:show', self._onModalDialogShown);
          window.removeEventListener('resize', self._onWindowResize)
          self.options.onclose();
        }
      }, function onError_sendSms(e) {
        alert(e);
      });
  }
};

function SendSMSToSingle(options) {
  this.initailize(options);
}

SendSMSToSingle.closeAll = function() {
  var evt = document.createEvent('Event');
  evt.initEvent('SendSMSToSingle:show', true, true);
  document.dispatchEvent(evt);
};

SendSMSToSingle.prototype = {
  initailize: function(options) {
    this.options = extend({
      onclose: emptyFunction
    }, options);
    this._modalElement = null;
    this._mask = null;
    this._build();
  },

  _build: function() {
    this._mask = document.createElement('div');
    this._mask.className = 'modal-mask';
    document.body.appendChild(this._mask);
    // TODO using template
    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    this._modalElement.innerHTML = '<div class="w-ui-window draggable">'
	+ '<header class="w-ui-window-header drag-handel">'
	+ '<div class="w-ui-window-header-title" data-l10n-id="w-send-sms"></div>'
	+ '<div class="w-ui-window-header-x" style=""></div>'
	+ '</header>'
	+ '<div class="w-ui-window-body">'
	+ '<div class="w-message-sender-window">'
	+ '<div class="header" id="select-contact-tel-header">'
	+ '<label data-l10n-id="w-send-address" class="cf" for="address"></label>'
	+ '<button class="w-ui-button w-ui-menubutton" id="select-contact-tel-button">'
	+ '<div class="label wc" id="selected-contact-tel">111111</div>'
	+ '<div class="arrow-ctn hbox">'
	+ '<div class="arrow"></div>'
	+ '</div>'
	+ '</button>'
	+ '</div>'
	+ '<div class="body">'
	+ '<label data-l10n-id="w-send-content" class="cf" for="content"></label>'
	+ '<textarea id="content" class="input-content" autofocus="true"></textarea>'
	+ '</div>'
	+ '<div class="monitor text-secondary">'
	+ '<span id="text-count" class="content-count"></span>'
	+ '<span id="sender-count" class="contacts-count"></span>'
	+ '</div>'
	+ '</div>'
	+ '</div>'
	+ '<footer class="w-ui-window-footer" style="">'
	+ '<div class="w-ui-window-footer-monitor"></div>'
	+ '<div class="w-ui-window-footer-button-ctn">'
	+ '<button data-l10n-id="w-send-button" class="button-send primary"></button>'
	+ '<button data-l10n-id="cancel" class="button-cancel primary"></button>'
	+ '</div>'
	+ '</footer>'
        + '</div>';

    var titleElem = $expr('.label', this._modalElement)[0];
    if (this.options.number && this.options.number.length > 0) {
      titleElem.innerHTML = this.options.number[0].value;
    }
    document.body.appendChild(this._modalElement);
    this._makeDialogCancelable();
    var header = _('only-text-sms-count', {
      n: 0
    });
    $id('text-count').innerHTML = header;
   
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
    document.addEventListener('SendSMSToSingle:show', this._onModalDialogShown);

    // Make sure other modal dialog has a chance to close itself.
    this._fireEvent('SendSMSToSingle:show');
    window.addEventListener('resize', this._onWindowResize);
    
    $id('select-contact-tel-button').addEventListener('click', function onclick_selectContactTel(event) {
      var titleElem = $id('select-contact-tel-header');
      var div = document.createElement('div');
      var html = '';
      html += '<menu class="w-ui-menu">';
      html += '<li>';
      html += '<label class="wc">';
      html += '<input type="radio" name="383" value="15116943768">';
      html += '<span>15116943768</span>';
      html += '</label>';
      html += '</li>';
      html += '<li>';
      html += '<label class="wc">';
      html += '<input type="radio" name="383" value="13801366783">';
      html += '<span>13801366783</span>';
      html += '</label>';
      html += '</li>';
      html += '</menu>';
      div.innerHTML = html;
      titleElem.appendChild(div);
    });
  },

  _makeDialogCancelable: function() {
   var closeBtn = $expr('.w-ui-window-header-x', this._modalElement)[0];
   closeBtn.hidden = false;
   closeBtn.addEventListener('click', this.close.bind(this));
   var okBtn = $expr('.button-send', this._modalElement)[0];
   okBtn.hidden = false;
   okBtn.addEventListener('click', this.send.bind(this));
   var self = this;
   okBtn.addEventListener('keydown', function(event) {
     if (event.keyCode == 27) {
       self.close();
     }
   });
   var cancelBtn = $expr('.button-cancel', this._modalElement)[0];
   cancelBtn.hidden = false;
   cancelBtn.addEventListener('click', this.close.bind(this));

   $id('content').addEventListener('keyup', function onclick_addNewSms(event) {
      var header = _('only-text-sms-count', {
        n: this.value.length
      });
      $id('text-count').innerHTML = header;
    });
   okBtn.focus();
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
    document.removeEventListener('SendSMSToSingle:show', this._onModalDialogShown);
    window.removeEventListener('resize', this._onWindowResize)
    this.options.onclose();
  },
  send: function() {
    var number = $id('address').value.split(';');
    var message = $id('content').value;
    var sender = [];
    var self=this;
    number.forEach(function(item) {
      var start = item.indexOf("(");
      var end = item.indexOf(")");
      if(start >= 0 &&  end > 0){
        sender.push(item.slice(start+1,end));
      }else if(item != ""){
        sender.push(item);
      }
    });
    CMD.SMS.sendMessages(JSON.stringify({number:sender, message: message}),
      function onSuccess_sendSms(event) {
        if(!event.result) {
          self._mask.parentNode.removeChild(self._mask);
          self._modalElement.parentNode.removeChild(self._modalElement);
          self._mask = null;
          self._modalElement = null;
          document.removeEventListener('SendSMSToSingle:show', self._onModalDialogShown);
          window.removeEventListener('resize', self._onWindowResize)
          self.options.onclose();
        }
      }, function onError_sendSms(e) {
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
    // TODO using template
    this._modalElement = document.createElement('div');
    this._modalElement.className = 'modal-dialog';
    var html = '<div class="w-ui-window-contact">'
	+ '<header class="w-ui-window-header">'
	+ '<div data-l10n-id="w-add-contact" class="w-ui-window-header-title"></div>'
	+ '<div class="w-ui-window-header-x" style=""></div>'
	+ '</header>'
	+ '<div class="w-ui-window-body">'
	+ '<div class="w-message-contact-selector-body">'
	+ '<div class="list-ctn">'
	+ '<div class="w-ui-smartlist" id="w-ui-smartlist-container">'
        + '</div>'
        + '</div>'
	+ '</div>'
	+ '<footer class="w-ui-window-footer" style="">'
	+ '<div class="w-ui-window-footer-monitor">'
	+ '<div>'
	+ '<span id="select-contact-count" class="text-secondary count"></span>'
	+ '</div>'
	+ '</div>'
	+ '<div class="w-ui-window-footer-button-ctn">'
	+ '<button data-l10n-id="OK" class="button-send primary"></button>'
	+ '<button data-l10n-id="cancel" class="button-cancel"></button>'
	+ '</div>'
	+ '</footer>'
	+ '</div>'
	+ '</div>';
    this._modalElement.innerHTML = html;
    document.body.appendChild(this._modalElement);
    var closeBtn = $expr('.w-ui-window-header-x', this._modalElement)[0];
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
    
    var contactSmallListContainer = $id('w-ui-smartlist-container');
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
      group.dataList.forEach( function (contact) {
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
          alert('get contactSmallList getContactProfilePic error:' + e);
        });
      });
    });
    var itemNum = $expr('#w-ui-smartlist-container .contact-list-item[data-checked="true"]').length;
    var header = _('contacts-selected', {
      n: itemNum
    });
    $id('select-contact-count').innerHTML = header;
  },

  _createContactListItem: function(contact) {
    var html = '';
    html += '<div>';
    html += '  <label class="unchecked"></label>';
    html += '    <img class="avatar avatar-default"></img>';
    html += '      <div class="contact-info">';
    html += '        <div class="name">';
    if (contact.name) {
      html += contact.name.join(' ');
    }
    html += '</div>';
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
      var itemNum;
      var header;
      if (target instanceof HTMLLabelElement) {
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
        itemNum = $expr('#w-ui-smartlist-container .contact-list-item[data-checked="true"]').length;
        header = _('contacts-selected', {
          n: itemNum
        });
        $id('select-contact-count').innerHTML = header;
      } else {
        item = $expr('label.unchecked', elem)[0];
        if (item) {
          item.classList.add('checked');
        }
        elem.dataset.checked = true;
        elem.dataset.focused = true;
        itemNum = $expr('#w-ui-smartlist-container .contact-list-item[data-checked="true"]').length;
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
    $expr('#w-ui-smartlist-container .contact-list-item[data-checked="true"]').forEach(function(item) {
      ids.push(item.dataset.contact);
    });
    this.options.onok(ids);
    this.close();
  }
};