var SmsList = (function() {
  var threadList = null;
  var threadListContainer = null;
  var selectedList = null;
  var selectedListContainer = null;
  var messageList = null;
  var messageListContainer = null;
  var allMessagesList = {};
  function clearView() {
    var inputSms = $id('sender-ctn-input');
    if (inputSms) {
      inputSms.value = '';
    }
  }

  function init() {
    var loadingGroupId = animationLoading.start();
    clearView();
    CMD.SMS.getThreads(function onresponse_getThreads(messages) {
      // Make sure the 'select-all' box is not checked.
      selectAllSms(false);
      var dataJSON = JSON.parse(messages.data);
      threadListContainer = $id('threads-list-container');
      threadListContainer.innerHTML = '';
      selectedListContainer = $id('show-sms-container');
      selectedListContainer.innerHTML = '';
      messageListContainer = $id('message-list-container');
      messageListContainer.innerHTML = '';
      ViewManager.showViews('sms-send-view');
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
        container: threadListContainer
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

  function show() {
    clearView();
    selectAllSms(false);
  }

  function updateAvatar() {
    if (!threadList) {
      return;
    }
    threadList.getGroupedData().forEach(function(thread) {
      thread.dataList.forEach(function(item) {
        updateThreadAvatar(item);
      });
    });
  }

  function updateThreadAvatar(item) {
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

  function showThreadList() {
    var isEmpty = threadList.count() == 0;
    $id('selectAll-sms').dataset.disabled = isEmpty;
    $id('empty-sms-container').hidden = !isEmpty;
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
    selectedList = item;
    var header = _('sms-selected', {
      n: item.length
    });
    $id('select-threads-count').innerHTML = header;

    selectedListContainer.innerHTML = '';
    for (var i = 0; i < item.length; i++) {
      var elem = document.createElement('div');
      elem.classList.add('show-sms-item');
      var index = item[i].dataset.threadIndex;
      var SmsThreadsData = threadList.getGroupedData();
      for (var j = 0; j < SmsThreadsData.length; j++) {
        if (SmsThreadsData[j].dataList.length == 0 || index != SmsThreadsData[j].dataList[0].id) {
          continue;
        }
        SmsThreadsData = SmsThreadsData[j].dataList[0];
        var threadItem = $id('id-threads-data-' + SmsThreadsData.id);
        var threadName = threadItem.getElementsByTagName('div')[2];
        var threadImg = threadItem.getElementsByTagName('img')[0];

        var name = threadName.childNodes[0].nodeValue;
        if (SmsThreadsData.unreadCount > 0) {
          var header = _('sms-unread-count', {
            n: SmsThreadsData.unreadCount
          });
          name += header;
        }
        var body;
        if (SmsThreadsData.lastMessageType == 'mms') {
          body = _('MMS');
        } else {
          body = SmsThreadsData.body;
        }
        var templateData = {
          name: name,
          body: body
        };
        elem.innerHTML = tmpl('tmpl_sms_select_item', templateData);
        elem.id = 'show-multi-sms-' + SmsThreadsData.id;
        navigator.mozL10n.translate(elem);
        selectedListContainer.appendChild(elem);

        if (threadImg.src) {
          var selectItem = $id('show-multi-sms-' + SmsThreadsData.id);
          var img = selectItem.getElementsByTagName('img')[0];
          img.src = threadImg.src;
          selectItem.dataset.avatar = threadImg.src;
          img.classList.remove('avatar-default');
        }
        break;
      }
    }
    ViewManager.showViews('sms-select-view');
  }

  function showThreadView(item) {
    var loadingGroupId = animationLoading.start();
    var index = item[0].dataset.threadIndex;
    var SmsThreadsData = threadList.getGroupedData();
    clearView();
    messageListContainer.innerHTML = '';
    for (var j = 0; j < SmsThreadsData.length; j++) {
      if (SmsThreadsData[j].dataList.length == 0 || index != SmsThreadsData[j].dataList[0].id) {
        continue;
      }
      SmsThreadsData = SmsThreadsData[j].dataList[0];
      var threadGroup = $id('id-threads-data-' + SmsThreadsData.id);
      threadGroup.classList.remove('unread');
      var sp = threadGroup.getElementsByTagName('div');
      sp[3].innerHTML = '';
      var threadItem = $id('id-threads-data-' + SmsThreadsData.id);
      var threadName = threadItem.getElementsByTagName('div')[2];
      var threadImg = threadItem.getElementsByTagName('img')[0];

      $id('sms-thread-header').value = SmsThreadsData.id;
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
      var MessageListData = getMessagesByThreadId(SmsThreadsData.id);
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
        container: messageListContainer,
        ondatachange: function() {
          if ( !!messageListContainer) {
            messageListContainer.scrollTop = messageListContainer.scrollTopMax;
          }
        }
      });
      messageList.render();
      var forwardBtns = $expr('.button-forward', messageListContainer);
      for (var j = 0; j < forwardBtns.length; j++) {
        forwardBtns[j].hidden = false;
        forwardBtns[j].addEventListener('click', function onclick_replySms(event) {
          new SendSMSDialog({
            type: 'multi',
            tel: null,
            bodyText: this.value
          });
        });
      }
      var resendBtns = $expr('.button-resend', messageListContainer);
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
          CMD.SMS.resendMessage(JSON.stringify(resendSMS), function onSuccess(event) {
            removeMessage(smsId[2], smsId[3]);
          }, null);
        });
      }
      var deleteBtns = $expr('.button-delete', messageListContainer);
      for (var j = 0; j < deleteBtns.length; j++) {
        deleteBtns[j].hidden = false;
        deleteBtns[j].addEventListener('click', function onclick_deleteSms(event) {
          var self = this;
          var smsId = this.id.split("-");
          var deleteSMS = {
            'id': smsId[2]
          };
          CMD.SMS.deleteMessageById(JSON.stringify(deleteSMS), function onSuccess(event) {
            removeMessage(smsId[2], smsId[3]);
          }, null);
        });
      }
      break;
    }
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
      showReplyButton: '',
      showDeleteButton: '',
      resendValue: '',
      replyValue: '',
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
      templateData.showReplyButton = 'false';
    } else {
      templateData.type.push('text');
      templateData.body.push(messageData.body);
      if (messageData.delivery == 'error') {
        templateData.showResendButton = 'true';
        templateData.resendValue = messageData.body;
      } else {
        templateData.showResendButton = 'false';
      }
      templateData.showReplyButton = 'true';
      templateData.replyValue = messageData.body;
    }
    templateData.showDeleteButton = 'true';
    templateData.deleteValue = messageData.id;
    elem.innerHTML = tmpl('tmpl_sms_display_item', templateData);
    elem.dataset.groupId = messageData.threadId;
    elem.id = 'id-message-data-' + messageData.threadId;
    navigator.mozL10n.translate(elem);
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
    item = $expr('label', elem)[0];
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
    if (threadListData.length == 0) {
      threadListContainer.innerHTML = '';
    } else {
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
        updateThreadAvatar(threadData);
        showThreadList();
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
    updateThreadAvatar(tempthreadListData);
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
        navigator.mozFFOSAssistant.saveToDisk(content, function(status) {
          if (status) {
            new AlertDialog(_('export-sms-success'));
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
            threadList.remove(threadListData);
            threadListData.body = messageListData[i-1].body;
            threadListData.timestamp = messageListData[i-1].timestamp;
            threadListData.lastMessageType = messageListData[i-1].type;
            threadList.add(threadListData);
            updateThreadAvatar(threadListData);
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

      new AlertDialog(_('delete-sms-confirm', {
        n: ids.length
      }), true, function() {
        ids.forEach(function(item) {
          removeThread(item);
        });
        ViewManager.showViews('sms-send-view');
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
      new AlertDialog(_('export-sms-confirm', {
        n: ids.length
      }), true, function() {
        exportThreads(ids);
      });
    });

    $id('sms-send-inthread').addEventListener('click', function onclick_quickreply(event) {
      if (!messageList) {
        return;
      }
      var num;
      var MessageListData = messageList.getGroupedData();
      MessageListData = MessageListData[0].dataList;
      if (MessageListData.length > 0) {
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
      }
    });
  });

  return {
    init: init,
    show: show
  };
})();
