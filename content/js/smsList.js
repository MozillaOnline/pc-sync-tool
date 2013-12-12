var SmsList = (function() {
  var threadList = null;
  var messageList = null;
  var allMessagesList = {};

  function resetView() {
    var inputSms = $id('sender-ctn-input');
    if (inputSms) {
      inputSms.value = '';
    }
    selectAllSms(false);
    ViewManager.showViews('sms-send-view');
  }

  function init() {
    var loadingGroupId = animationLoading.start();
    resetView();
    $id('threads-list-container').innerHTML = '';
    $id('show-sms-container').innerHTML = '';
    $id('message-list-container').innerHTML = '';
    CMD.SMS.getThreads(function onresponse_getThreads(messages) {
      var dataJSON = JSON.parse(messages.data);
      for (var i=0; i<dataJSON.length; i++) {
        allMessagesList[dataJSON[i].id] = [];
      }
      threadList = new GroupedList({
        dataList: dataJSON,
        dataIndexer: function getIndex(smsThread) {
          return smsThread.timestamp;
        },
        indexSorter: function dictSorter(a, b) {
          if (a.index === b.index) {
            return 0;
          } else if (a.index > b.index) {
            return -1;
          }
          return 1;
        },
        disableDataIndexer: true,
        renderFunc: createGroupThreadList,
        container: $id('threads-list-container')
      });
      CMD.SMS.getAllMessages(function onresponse(messages) {
        var allMessages = JSON.parse(messages.data);
        for (var i=0; i<allMessages.length; i++) {
          var threadMessage = allMessages[i];
          allMessagesList[threadMessage.threadId].push(threadMessage);
        }
        threadList.render();
        updateAvatar();
        showThreadList();
        customEventElement.removeEventListener('dataChange', onMessage);
        customEventElement.addEventListener('dataChange', onMessage);
        animationLoading.stop(loadingGroupId);
      }, function onerror(messages) {
        log('Error occurs when fetching all messages' + messages.message);
        animationLoading.stop(loadingGroupId);
      });
    }, function onerror_getThreads(messages) {
      log('Error occurs when fetching all messages' + messages.message);
      animationLoading.stop(loadingGroupId);
    });
  }

  function getMessagesByThreadId(id) {
    return allMessagesList[id];
  }

  function updateAvatar() {
    if (!threadList) {
      return;
    }
    threadList.getGroupedData().forEach(function(thread) {
      thread.dataList.forEach(function(item) {
        updateThreadAvatarFromPhone(item);
      });
    });
  }

  function updateThreadAvatarFromPhone(item) {
    var threadInfo = item;
    var phoneNum = item.participants[0];
    var reg = /\((\d+)\)/;
    var result = reg.exec(phoneNum);
    if (result) {
      phoneNum = result[1];
    }

    CMD.Contacts.getContactByPhoneNumber(phoneNum, function(result) {
      if (!result.data) {
        return;
      }
      var contactData = JSON.parse(result.data);
      var threadItem = $id('id-threads-data-' + threadInfo.id);
      var name = threadItem.getElementsByTagName('div')[2];
      name.childNodes[0].type = 'contact';
      name.childNodes[0].nodeValue = contactData.name.join(' ');
      if ( !!contactData.photo && contactData.photo.length > 0) {
        var threadItem = $id('id-threads-data-' + threadInfo.id);
        var img = threadItem.getElementsByTagName('img')[0];
        img.src = contactData.photo;
        threadItem.dataset.avatar = contactData.photo;
        img.classList.remove('avatar-default');
      }
      var ids = [];
      $expr('#threads-list-container .threads-list-item[data-checked="true"]').forEach(function(item) {
        ids.push(item.dataset.threadIndex);
      });
      if (ids.length == 1 && ids[0] == threadInfo.id && !$id('sms-thread-view').hidden) {
        var messageViewName = $id('sms-thread-header-name');
        if (messageViewName) {
          messageViewName.textContent = contactData.name.join(' ');
          var titleElem = $id('add-to-contact-' + threadInfo.id);
          if (titleElem) {
            titleElem.hidden = true;
          }
        }
        var headerButton = $id('sms-thread-header-button');
        if (headerButton) {
          headerButton.hidden = true;
        }
        if ( !!contactData.photo && contactData.photo.length > 0) {
          var messageViewimg = $id('sms-thread-header-img');
          if ( !!messageViewimg) {
            messageViewimg.src = contactData.photo;
            messageViewimg.classList.remove('avatar-show-default');
          }
        }
      } else if (ids.length > 1 && ids.indexOf(threadInfo.id) && !$id('sms-select-view').hidden) {
        var selectViewName = $id('show-multi-sms-content-number-' + threadInfo.id);
        if (selectViewName) {
          selectViewName.childNodes[0].nodeValue = contactData.name.join(' ');
        }
        if ( !!contactData.photo && contactData.photo.length > 0) {
          var selectItem = $id('show-multi-sms-' + threadInfo.id);
          if ( !!selectItem) {
            img = selectItem.getElementsByTagName('img')[0];
            img.src = contactData.photo;;
            selectItem.dataset.avatar = contactData.photo;;
            img.classList.remove('avatar-default');
          }
        }
      }
    }, null);
  }

  function updateThreadAvatarFromData(item, nameData, imageData) {
    if (!imageData) {
      return;
    }
    var threadInfo = item;
    var threadItem = $id('id-threads-data-' + threadInfo.id);
    var name = threadItem.getElementsByTagName('div')[2];
    if (nameData) {
      name.childNodes[0].type = 'contact';
      name.childNodes[0].nodeValue = nameData;
    }
    if ( !!imageData && imageData.length > 0) {
      var threadItem = $id('id-threads-data-' + threadInfo.id);
      var img = threadItem.getElementsByTagName('img')[0];
      img.src = imageData;
      threadItem.dataset.avatar = imageData;
      img.classList.remove('avatar-default');
    }
  }

  function showThreadList() {
    var isEmpty = threadList.count() == 0;
    $id('selectAll-sms').dataset.disabled = isEmpty;
    $id('empty-sms-container').hidden = !isEmpty;
    if (isEmpty) {
      $id('threads-list-container').innerHTML = '';
    }
  }

  function createGroupThreadList(threadData) {
    var elem = document.createElement('div');
    elem.classList.add('threads-list-item');

    if (threadData.unreadCount > 0) {
      elem.classList.add('unread');
    }

    var templateData = {
      name: threadData.participants[0],
      unread: '',
      date: '',
      body: ''
    };
    if (threadData.unreadCount > 0) {
      templateData.unread = _('sms-unread-count', {
        n: threadData.unreadCount
      });
    }
    templateData.date = formatDate(threadData.timestamp);
    if (threadData.lastMessageType == 'mms') {
      templateData.body = _('MMS');
    } else {
      templateData.body = threadData.body;
    }
    elem.innerHTML = tmpl('tmpl_sms_list_item', templateData);
    elem.dataset.groupId = threadData.id;
    elem.id = 'id-threads-data-' + threadData.id;
    elem.dataset.threadIndex = threadData.id;
    elem.dataset.body = templateData.body;
    elem.dataset.unread = templateData.unread;
    elem.onclick = function onclick_sms_list(event) {
      var target = event.target;
      if (target instanceof HTMLLabelElement) {
        toggleSmsItem(elem);
      } else {
        smsItemClicked(elem);
      }
    };

    navigator.mozL10n.translate(elem);
    return elem;
  }

  function showSelectView(item) {
    var header = _('sms-selected', {
      n: item.length
    });
    $id('select-threads-count').innerHTML = header;
    $id('show-sms-container').innerHTML = '';
    for (var i = 0; i < item.length; i++) {
      var elem = document.createElement('div');
      elem.classList.add('show-sms-item');
      var index = item[i].dataset.threadIndex;
      var threadItem = $id('id-threads-data-' + index);
      var threadName = threadItem.getElementsByTagName('div')[2];
      var threadImg = threadItem.getElementsByTagName('img')[0];
      var name = threadName.childNodes[0].nodeValue;
      name += item[i].dataset.unread;
      var templateData = {
        name: name,
        body: item[i].dataset.body
      };
      elem.innerHTML = tmpl('tmpl_sms_select_item', templateData);
      elem.id = 'show-multi-sms-' + index;
      navigator.mozL10n.translate(elem);
      $id('show-sms-container').appendChild(elem);
      if (threadImg.src) {
        var selectItem = $id('show-multi-sms-' + index);
        var img = selectItem.getElementsByTagName('img')[0];
        img.src = threadImg.src;
        selectItem.dataset.avatar = threadImg.src;
        img.classList.remove('avatar-default');
      }
    }
    ViewManager.showViews('sms-select-view');
  }

  function showThreadView(item) {
    var loadingGroupId = animationLoading.start();
    var index = item[0].dataset.threadIndex;
    var inputSms = $id('sender-ctn-input');
    if (inputSms) {
      inputSms.value = '';
    }
    $id('message-list-container').innerHTML = '';
    var threadGroup = $id('id-threads-data-' + index);
    threadGroup.classList.remove('unread');
    var sp = threadGroup.getElementsByTagName('div');
    sp[3].innerHTML = '';
    var threadItem = $id('id-threads-data-' + index);
    var threadName = threadItem.getElementsByTagName('div')[2];
    var threadImg = threadItem.getElementsByTagName('img')[0];

    $id('sms-thread-header').value = index;
    var headerImg = $id('sms-thread-header-img');
    if (!!threadImg.src) {
      headerImg.src = threadImg.src;
      headerImg.dataset.avatar = threadImg.src;
      headerImg.classList.remove('avatar-show-default');
    } else {
      headerImg.removeAttribute('src');
      headerImg.classList.add('avatar-show-default');
    }
    var headerName = $id('sms-thread-header-name');
    headerName.textContent = threadName.childNodes[0].nodeValue;
    var headerButton = $id('sms-thread-header-button');
    if (headerButton) {
      if (threadName.childNodes[0].type == 'contact') {
        headerButton.hidden = true;
      } else {
        headerButton.hidden = false;
        headerButton.onclick = function() {
          var addContactData = {
            type: 'add',
            number: threadName.childNodes[0].nodeValue
          }
          ViewManager.showContent('contact-view', addContactData);
        };
      }
    }
    var MessageListData = getMessagesByThreadId(index);
    for (var i = 0; i < MessageListData.length; i++) {
      var nearDate = null;
      if (i > 0) {
        MessageListData[i]['nearDate'] = MessageListData[i - 1].timestamp;
      } else {
        MessageListData[i]['nearDate'] = 0;
      }
    }
    messageList = new GroupedList({
      dataList: MessageListData,
      dataIndexer: function() {
        return 'messagelist';
      },
      disableDataIndexer: true,
      renderFunc: createThreadDialogView,
      container: $id('message-list-container'),
      ondatachange: function() {
        if ( !!$id('message-list-container')) {
          $id('message-list-container').scrollTop = $id('message-list-container').scrollTopMax;
        }
      }
    });
    messageList.render();
    animationLoading.stop(loadingGroupId);
    ViewManager.showViews('sms-thread-view');
  }

  function createThreadDialogView(messageData) {
    CMD.SMS.markReadMessageById(JSON.stringify(messageData.id), null, null);
    var elem = document.createElement('div');
    elem.classList.add('messages-list-item');

    var templateData = {
      date: '',
      body: [],
      time: '',
      type: [],
      id: messageData.id + '-' + messageData.threadId,
      showResendButton: '',
      showorwardButton: '',
      showDeleteButton: '',
      resendValue: '',
      forwardValue: '',
      deleteValue: ''
    };
    templateData.date = formatDate(messageData.timestamp);
    if (messageData.nearDate) {
      if (templateData.date == formatDate(messageData.nearDate)) {
        templateData.date = '';
      }
    }
    if (messageData.delivery != "received") {
      if (messageData.delivery == "error") {
        elem.classList.add('from-me-error');
      } else {
        elem.classList.add('from-me');
      }
    }
    templateData.time += formatTime(messageData.timestamp);;

    // mms display
    if (messageData.type == 'mms') {
      var html = '';
      var dataText = 'data:text/plain;base64,';
      for (var i = 0; i < messageData.attachments.length; i++) {
        if (messageData.attachments[i].content.contains(dataText)) {
          templateData.type.push('text');
          var base64 = new Base64();
          templateData.body.push(base64.decode(messageData.attachments[i].content.substring(dataText.length, messageData.attachments[i].content.length)));
        } else {
          templateData.type.push('img');
          templateData.body.push(messageData.attachments[i].content);
        }
      }

      templateData.showResendButton = 'false';
      templateData.showForwardButton = 'false';
    } else {
      templateData.type.push('text');
      templateData.body.push(messageData.body);
      if (messageData.delivery == 'error') {
        templateData.showResendButton = 'true';
        templateData.resendValue = messageData.body;
      } else {
        templateData.showResendButton = 'false';
      }
      templateData.showForwardButton = 'true';
      templateData.forwardValue = messageData.body;
    }
    templateData.showDeleteButton = 'true';
    templateData.deleteValue = messageData.id;
    elem.innerHTML = tmpl('tmpl_sms_display_item', templateData);
    elem.dataset.groupId = messageData.threadId;
    elem.id = 'id-message-data-' + messageData.threadId;
    navigator.mozL10n.translate(elem);
    var forwardBtns = $expr('.button-forward', elem);
    for (var j = 0; j < forwardBtns.length; j++) {
      forwardBtns[j].hidden = false;
      forwardBtns[j].addEventListener('click', function onclick_forwardSms(event) {
        new SendSMSDialog({
          type: 'multi',
          tel: null,
          bodyText: this.value
        });
      });
      forwardBtns[j].addEventListener('mouseover', function () {
        this.title = _('sms-forward');
      });
    }
    var resendBtns = $expr('.button-resend', elem);
    for (var j = 0; j < resendBtns.length; j++) {
      resendBtns[j].hidden = false;
      resendBtns[j].addEventListener('click', function onclick_resendSms(event) {
        var smsId = this.id.split("-");
        var num;
        if (MessageListData[0].delivery == "received") {
          num = MessageListData[0].sender;
        } else {
          if (MessageListData[0].type == "mms") {
            num = MessageListData[0].receivers;
          } else {
            num = MessageListData[0].receiver;
          }
        }
        var resendSMS = {
          'type': 'sms',
          'id': smsId[2],
          'number': num,
          'body': this.value
        };
        var loadingGroupId = animationLoading.start();
        CMD.SMS.resendMessage(JSON.stringify(resendSMS), function onSuccess(event) {
          removeMessage(smsId[2], smsId[3]);
          animationLoading.stop(loadingGroupId);
        }, function onError(e) {
          animationLoading.stop(loadingGroupId);
        });
      });
      resendBtns[j].addEventListener('mouseover', function () {
        this.title = _('sms-resend');
      });
    }
    var deleteBtns = $expr('.button-delete', elem);
    for (var j = 0; j < deleteBtns.length; j++) {
      deleteBtns[j].hidden = false;
      deleteBtns[j].addEventListener('click', function onclick_deleteSms(event) {
        var self = this;
        var smsId = this.id.split("-");
        var deleteSMS = {
          'id': smsId[2]
        };
        var loadingGroupId = animationLoading.start();
        CMD.SMS.deleteMessageById(JSON.stringify(deleteSMS), function onSuccess(event) {
          removeMessage(smsId[2], smsId[3]);
          animationLoading.stop(loadingGroupId);
        }, function onError(e) {
          animationLoading.stop(loadingGroupId);
        });
      });
      deleteBtns[j].addEventListener('mouseover', function () {
        this.title = _('sms-delete');
      });
    }
    return elem;
  }

  function smsItemClicked(elem) {
    var checkedItems = $expr('#threads-list-container .threads-list-item[data-checked="true"]');
    checkedItems.forEach(function(e) {
      if (e == elem) {
        return;
      }
      e.dataset.checked = e.dataset.focused = false;
      var item = $expr('label', e)[0];
      if (item) {
        item.dataset.checked = false;
      }
    });
    var item = $expr('label', elem)[0];
    if (item) {
      item.dataset.checked = true;
    }
    if (elem.dataset.focused != 'true' || checkedItems.length > 1) {
      elem.dataset.checked = elem.dataset.focused = true;
      if ($expr('#threads-list-container .threads-list-item').length === 1) {
        $id('selectAll-sms').dataset.checked = true;
      } else {
        $id('selectAll-sms').dataset.checked = false;
      }
      $id('remove-sms').dataset.disabled = $id('export-sms').dataset.disabled = false;
      opStateChanged();
    }
  }

  function toggleSmsItem(elem) {
    var item = $expr('label', elem)[0];
    if (!item) {
      return;
    }
    var select = false;
    if (item.dataset.checked == 'false') {
      select = true;
    }
    elem.dataset.checked = elem.dataset.focused = item.dataset.checked = select;
    opStateChanged();
  }

  function opStateChanged() {
    var item = $expr('#threads-list-container .threads-list-item');
    var threadlistLength = item.length;
    if (threadlistLength == 0) {
      $id('selectAll-sms').dataset.checked = false;
      $id('selectAll-sms').dataset.disabled = true;
      ViewManager.showViews('sms-send-view');
    } else {
      item = $expr('#threads-list-container .threads-list-item[data-checked="true"]');
      threadlistLength = item.length;
      $id('selectAll-sms').dataset.checked = $expr('#threads-list-container .threads-list-item').length === threadlistLength;
      $id('selectAll-sms').dataset.disabled = false;
      if (threadlistLength == 1) {
        showThreadView(item);
      } else if (threadlistLength > 1) {
        showSelectView(item);
      } else {
        ViewManager.showViews('sms-send-view');
      }
    }
    $id('remove-sms').dataset.disabled = threadlistLength === 0;
    $id('export-sms').dataset.disabled = threadlistLength === 0;
  }

  function selectAllSms(select) {
    $expr('#threads-list-container .threads-list-item').forEach(function(elem) {
      var item = $expr('label', elem)[0];
      if (!item) {
        return;
      }
      item.dataset.checked = elem.dataset.checked = elem.dataset.focused = select;
    });
    opStateChanged();
  }

  function onMessage(e) {
    if (e.detail.type == 'contact') {
      updateAvatar();
      return;
    }
    if (e.detail.type != 'sms') {
      return;
    }
    var msg = e.detail.data;
    if (!threadList) {
      return;
    }
    if (!allMessagesList[msg.threadId]) {
      allMessagesList[msg.threadId] = [];
    }
    var threadListData = threadList.getGroupedData();
    showThreadList();
    if (threadListData.length > 0) {
      for (var i = 0; i < threadListData.length; i++) {
        if (threadListData[i].dataList.length == 0 || threadListData[i].dataList[0].id != msg.threadId) {
          continue;
        }
        var threadData = threadListData[i].dataList[0];
        if (messageList) {
          var messageListData = messageList.getGroupedData();
          messageListData = messageListData[0].dataList;
          if (messageListData.length > 0 && msg.threadId == messageListData[0].threadId) {
            msg['nearDate'] = messageListData[messageListData.length - 1].timestamp;
            if (messageListData[messageListData.length - 1].id == msg.id) {
              messageList.remove(messageListData[messageListData.length - 1]);
            }
            messageList.add(msg);
          }
        }
        for (var j = 0; j < allMessagesList[msg.threadId].length; j++) {
          if (allMessagesList[msg.threadId][j].id == msg.id) {
            allMessagesList[msg.threadId].splice(j,1);
            break;
          }
        }
        allMessagesList[msg.threadId].push(msg);
        var nameData = null;
        var imageData = null;
        var checked = false;
        var threadsListItems = $expr('#threads-list-container .threads-list-item');
        checkedItems.forEach(function(e) {
          if (e.dataset.threadIndex == threadData.id) {
            checked = e.dataset.checked;
            var name = e.getElementsByTagName('div')[2];
            if (name.childNodes[0].type == 'contact') {
              nameData = name.childNodes[0].nodeValue;
            }
            imageData = e.dataset.avatar;
          }
        });
        threadList.remove(threadData);
        if (msg.delivery == "received") {
          if (messageList) {
            threadData.unreadCount = 0;
          } else {
            threadData.unreadCount += 1;
          }
        }
        threadData.body = msg.body;
        threadData.timestamp = msg.timestamp;
        threadData.lastMessageType = msg.type;
        threadList.add(threadData);
        if (checked) {
          var uncheckedItems = $expr('#threads-list-container .threads-list-item');
          uncheckedItems.forEach(function(e) {
            if (e.dataset.threadIndex == threadData.id) {
              var item = $expr('label', e)[0];
              item.dataset.checked = e.dataset.checked = e.dataset.focused = true;
            }
          });
          opStateChanged();
        }
        updateThreadAvatarFromData(threadData, nameData, imageData);
        return;
      }
    }
    for (var j = 0; j < allMessagesList[msg.threadId].length; j++) {
      if (allMessagesList[msg.threadId][j].id == msg.id) {
        allMessagesList[msg.threadId].splice(j,1);
        break;
      }
    }
    allMessagesList[msg.threadId].push(msg);
    var tempparticipants;
    var unreadCount;
    if (msg.delivery == "received") {
      tempparticipants = msg.sender;
      unreadCount = 1;
    } else {
      if (msg.type == "mms") {
        tempparticipants = msg.receivers;
      } else {
        tempparticipants = msg.receiver;
      }
      unreadCount = 0;
    }
    var tempthreadListData = {
      'id': msg.threadId,
      'body': msg.body,
      'timestamp': msg.timestamp,
      'unreadCount': unreadCount,
      'participants': [tempparticipants],
      'lastMessageType': msg.type
    };
    tempthreadListData['threadIndex'] = msg.threadId;
    threadList.add(tempthreadListData);
    updateThreadAvatarFromPhone(tempthreadListData);
    showThreadList();
  }

  function removeThread(item) {
    selectAllSms(false);
    var groupedData = threadList.getGroupedData();
    var threadId = item.threadIndex;
    var Sms = getMessagesByThreadId(threadId);
    var result = [];
    for (var i = 0; i < Sms.length; i++) {
      var loadingGroupId = animationLoading.start();
      var smsId = {
        'id': Sms[i].id
      };
      CMD.SMS.deleteMessageById(JSON.stringify(smsId), function onSuccess(event) {
        result.push(event.result);
        if (result.length != Sms.length) {
          return;
        }
        for (var j = 0; j < groupedData.length; j++) {
          if (groupedData[j].dataList.length > 0 && threadId == groupedData[j].dataList[0].id) {
            threadList.remove(groupedData[j].dataList[0]);
            delete allMessagesList[threadId];
            break;
          }
        }
        showThreadList();
        animationLoading.stop(loadingGroupId);
      }, function onError(e) {
        animationLoading.stop(loadingGroupId);
      });
    }
  }

  function exportThreads(ids) {
    var loadingGroupId;
    var content = '';
    var threadnum = 0;
    if (ids.length > 0) {
      loadingGroupId = animationLoading.start();
    }
    //add BOM for windowsing.
    content += String.fromCharCode(65279);
    content += String.fromCharCode(13);
    content += String.fromCharCode(10);

    ids.forEach(function(item) {
      var threadId = item.threadIndex;
      var msg = getMessagesByThreadId(threadId);
      threadnum++;
      for (var i = 0; i < msg.length; i++) {
        if (msg[i].type == 'sms') {
          content += msg[i].delivery + ',';
          content += msg[i].deliveryStatus + ',';
          content += msg[i].sender + ',';
          content += msg[i].receiver + ',';
          content += '"' + msg[i].body.replace('"', '""') + '",';
          content += msg[i].messageClass + ',';
          content += formatDate(msg[i].timestamp) + ' ' + formatTime(msg[i].timestamp) + ',';
          content += '\n';
        }
      }
      if (threadnum == ids.length) {
        animationLoading.stop(loadingGroupId);
        saveToDisk(content, function(status) {
          if (status) {
            new AlertDialog({
              message: _('export-sms-success')
            });
          }
        }, {
          title: _('export-sms-success'),
          name: 'sms.csv',
          extension: 'csv'
        });
      }
    });
  }

  function removeMessage(messageId, threadId) {
    var loadingGroupId = animationLoading.start();
    var messageListData = messageList.getGroupedData();
    messageListData = messageListData[0].dataList;
    for (var i=0; i<allMessagesList[threadId].length; i++) {
      var message = allMessagesList[threadId][i];
      if (message.id == messageId) {
        allMessagesList[threadId].splice(i,1);
        break;
      }
    }
    if (messageListData[0].threadId != threadId) {
      animationLoading.stop(loadingGroupId);
      return;
    }
    for (var i = 0; i < messageListData.length; i++) {
      if (messageListData[i].id != messageId) {
        continue;
      }
      if ((i + 1) == messageListData.length) {
        var threadListData = threadList.getGroupedData();
        for (var j = 0; j < threadListData.length; j++) {
          if (threadListData[j].dataList.length == 0 || threadListData[j].dataList[0].id != messageListData[i].threadId) {
            continue;
          }
          threadListData = threadListData[j].dataList[0];
          if (messageListData.length == 1) {
            selectAllSms(false);
            threadList.remove(threadListData);
            ViewManager.showViews('sms-send-view');
          } else {
            var nameData = null;
            var imageData = null;
            var checked = false;
            var threadsListItems = $expr('#threads-list-container .threads-list-item');
            checkedItems.forEach(function(e) {
              if (e.dataset.threadIndex == threadListData.id) {
                checked = e.dataset.checked;
                var name = e.getElementsByTagName('div')[2];
                if (name.childNodes[0].type == 'contact') {
                  nameData = name.childNodes[0].nodeValue;
                }
                imageData = e.dataset.avatar;
              }
            });
            threadList.remove(threadListData);
            threadListData.body = messageListData[i-1].body;
            threadListData.timestamp = messageListData[i-1].timestamp;
            threadListData.lastMessageType = messageListData[i-1].type;
            threadList.add(threadListData);
            if (checked) {
              var uncheckedItems = $expr('#threads-list-container .threads-list-item');
              uncheckedItems.forEach(function(e) {
                if (e.dataset.threadIndex == threadListData.id) {
                  var item = $expr('label', e)[0];
                  item.dataset.checked = e.dataset.checked = e.dataset.focused = true;
                }
              });
              opStateChanged();
            }
            updateThreadAvatarFromData(threadListData, nameData, imageData);
          }
          break;
        }
      }
      messageList.remove(messageListData[i]);
      break;
    }
    animationLoading.stop(loadingGroupId);
  }

  window.addEventListener('load', function wnd_onload(event) {
    $id('selectAll-sms').addEventListener('click', function sall_onclick(event) {
      if (this.dataset.disabled == "true") {
        return;
      }
      if (this.dataset.checked == "false") {
        selectAllSms(true);
      } else {
        selectAllSms(false);
      }
    });

    $id('remove-sms').addEventListener('click', function onclick_removeContact(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }
      var ids = [];
      $expr('#threads-list-container .threads-list-item[data-checked="true"]').forEach(function(item) {
        ids.push(item.dataset);
      });
      new AlertDialog({
        message: _('delete-sms-confirm', {
          n: ids.length
        }),
        showCancelButton: true,
        callback: function() {
          ids.forEach(function(item) {
            removeThread(item);
          });
          ViewManager.showViews('sms-send-view');
        }
      });
    });

    $id('add-new-sms').addEventListener('click', function onclick_addNewSms(event) {
      new SendSMSDialog({
        type: 'multi',
        tel: null,
        bodyText: null
      });
    });

    $id('sms-send-button').addEventListener('click', function onclick_addNewSms(event) {
      new SendSMSDialog({
        type: 'multi',
        tel: null,
        bodyText: null
      });
    });

    var elemSendInput = $id('sender-ctn-input');
    var elemMessageContainer = $id('message-list-container');
    var getStyle = function(elem, name) {
      if (elem.currentStyle) {
        var val = elem.currentStyle[name];
        if (name === 'height' && val.search(/px/i) !== 1) {
          var rect = elem.getBoundingClientRect();
          return rect.bottom - rect.top - parseFloat(getStyle(elem, 'paddingTop')) - parseFloat(getStyle(elem, 'paddingBottom')) + 'px';
        };
        return val;
      } else {
        return getComputedStyle(elem, null)[name];
      }
    };
    var minHeight = parseFloat(getStyle(elemSendInput, 'height'));
    var maxHeight = 5 * parseFloat(getStyle(elemSendInput, 'height'));
    var messageListContainerHeight = parseFloat(getStyle(elemMessageContainer, 'height'));
    elemSendInput.addEventListener('keyup', function onclick_addNewSms(event) {
      var scrollTop;
      this.style.maxHeight = this.style.resize = 'none';
      if (this._length === this.value.length) return;

      this._length = this.value.length;
      scrollTop = this.scrollTop;
      this.style.height = minHeight + 'px';
      if (this.scrollHeight > minHeight) {
        if (maxHeight && this.scrollHeight > maxHeight) {
          this.style.height = maxHeight + 'px';
          this.style.overflowY = 'auto';
        } else {
          this.style.height = this.scrollHeight + 'px';
          this.style.overflowY = 'hidden';
        }
        scrollTop += parseInt(this.style.height) - this.currHeight;
        this.scrollTop = scrollTop;
        this.currHeight = parseInt(this.style.height);
      }
      elemMessageContainer.style.height = messageListContainerHeight - parseFloat(getStyle(elemSendInput, 'height')) + minHeight + 'px';
    });

    $id('refresh-sms').addEventListener('click', function onclick_refreshContacts(event) {
      init();
      ViewManager.showViews('sms-send-view');
    });

    $id('export-sms').addEventListener('click', function onclick_exportContacts(event) {
      if (this.dataset.disabled == 'true') {
        return;
      }

      var ids = [];
      $expr('#threads-list-container .threads-list-item[data-checked="true"]').forEach(function(item) {
        ids.push(item.dataset);
      });
      new AlertDialog({
        message: _('export-sms-confirm', {
          n: ids.length
        }),
        showCancelButton: true,
        callback: function() {
          exportThreads(ids);
        }
      });
    });

    $id('sms-send-inthread').addEventListener('click', function (event) {
      if (!messageList) {
        return;
      }
      var num;
      var MessageListData = messageList.getGroupedData();
      MessageListData = MessageListData[0].dataList;
      if (MessageListData.length <= 0) {
        return;
      }
      var loadingGroupId = animationLoading.start();
      if (MessageListData[0].delivery == "received") {
        num = MessageListData[0].sender;
      } else {
        if (MessageListData[0].type == "mms") {
          num = MessageListData[0].receivers;
        } else {
          num = MessageListData[0].receiver;
        }
      }
      var body = $id('sender-ctn-input');
      CMD.SMS.sendSMS(JSON.stringify({
        number: num,
        message: body.value
      }), function onSuccess_sendSms(sms) {
        animationLoading.stop(loadingGroupId);
      }, function onError_sendSms(e) {
        animationLoading.stop(loadingGroupId);
      });
      body.value = '';

      var scrollTop;
      body.style.maxHeight = body.style.resize = 'none';
      if (body._length === body.value.length) return;
      body._length = body.value.length;
      scrollTop = body.scrollTop;
      body.style.height = minHeight + 'px';
      if (body.scrollHeight > minHeight) {
        if (maxHeight && body.scrollHeight > maxHeight) {
          body.style.height = maxHeight + 'px';
          body.style.overflowY = 'auto';
        } else {
          body.style.height = body.scrollHeight + 'px';
          body.style.overflowY = 'hidden';
        }
        scrollTop += parseInt(body.style.height) - body.currHeight;
        body.scrollTop = scrollTop;
        body.currHeight = parseInt(body.style.height);
      }
      elemMessageContainer.style.height = messageListContainerHeight - parseFloat(getStyle(elemSendInput, 'height')) + minHeight + 'px';
    });
  });

  return {
    init: init,
    resetView: resetView
  };
})();
