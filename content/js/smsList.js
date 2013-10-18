var SmsList = (function() {
  var threadList = null;
  var threadListContainer = null;
  var selectedList = null;
  var selectedListContainer = null;
  var messageList = null;
  var messageListContainer = null;
  var handlerHeaderButton = null;
  var listenSmsMessage = false;

  function initSmsPage(smsThreads) {
    threadListContainer = $id('threads-list-container');
    threadListContainer.innerHTML = '';
    selectedListContainer = $id('show-sms-container');
    selectedListContainer.innerHTML = '';
    messageListContainer = $id('message-list-container');
    messageListContainer.innerHTML = '';
    ViewManager.showViews('sms-send-view');
    threadList = new GroupedList({
      dataList: smsThreads,
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
    threadList.render();
    updateAvatar();
    showThreadList();
    if(listenSmsMessage == false) {
      ViewManager.addViewEventListener('sms', 'onMessage', onMessage);
      listenSmsMessage = true;
    }
  }

  function updateAvatar() {
    if (threadList) {
      threadList.getGroupedData().forEach(function(thread) {
        thread.dataList.forEach(function(item) {
          updateThreadAvatar(item);
        });
      });
    }
  }

  function updateThreadAvatar(item) {
    var threadInfo = item;
    var phoneNum = item.participants[0];
    if ((item.participants[0].indexOf('(') >= 0) && (item.participants[0].indexOf(')') > item.participants[0].indexOf('('))) {
      phoneNum = item.participants[0].substring(item.participants[0].indexOf('(') + 1, item.participants[0].indexOf(')'));
    }
    CMD.Contacts.getContactByPhoneNumber(phoneNum, function(result) {
      if ( !! result.data) {
        var contactData = JSON.parse(result.data);
        var threadItem = $id('id-threads-data-' + threadInfo.id);
        var name = threadItem.getElementsByTagName('div')[2];
        name.childNodes[0].type = 'contact';
        name.childNodes[0].nodeValue = contactData.name.join(' ');

        if (!$id('sms-select-view').hidden) {
          var selectViewName = $id('show-multi-sms-content-number-' + threadInfo.id);
          if ( !! selectViewName) {
            selectViewName.childNodes[0].nodeValue = contactData.name.join(' ');
          }
        }

        if (!$id('sms-thread-view').hidden) {
          var messageViewName = $id('sms-thread-header-name');
          if ( !! messageViewName) {
            messageViewName.textContent = contactData.name.join(' ');
            var titleElem = $id('add-to-contact-' + threadInfo.id);
            if (titleElem) {
              titleElem.hidden = true;
            }
          }
        }

        if (( !! contactData.photo) && (contactData.photo.length > 0)) {
          var threadItem = $id('id-threads-data-' + threadInfo.id);
          var img = threadItem.getElementsByTagName('img')[0];
          img.src = contactData.photo;
          threadItem.dataset.avatar = contactData.photo;
          img.classList.remove('avatar-default');

          if (!$id('sms-thread-view').hidden) {
            var selectItem = $id('show-multi-sms-' + threadInfo.id);
            if ( !! selectItem) {
              img = selectItem.getElementsByTagName('img')[0];
              img.src = contactData.photo;;
              selectItem.dataset.avatar = contactData.photo;;
              img.classList.remove('avatar-default');
            }
          }

          if (!$id('sms-select-view').hidden) {
            var messageViewimg = $id('sms-thread-header-img');
            if ( !! messageViewimg && messageViewimg.value == threadInfo.id) {
              messageViewimg.src = contactData.photo;
              messageViewimg.classList.remove('avatar-default');
            }
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
      templateData.body = 'MMS';
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
        if ( (SmsThreadsData[j].dataList.length <= 0) || (index != SmsThreadsData[j].dataList[0].id) ) {
          continue;
        }
        SmsThreadsData = SmsThreadsData[j].dataList[0];
        var threadItem = $id('id-threads-data-' + SmsThreadsData.id);
        var threadname = threadItem.getElementsByTagName('div')[2];
        var threadimg = threadItem.getElementsByTagName('img')[0];

        var name = threadname.childNodes[0].nodeValue;
        if (SmsThreadsData.unreadCount > 0) {
          var header = _('sms-unread-count', {
            n: SmsThreadsData.unreadCount
          });
          name += header;
        }
        var body;
        if (SmsThreadsData.lastMessageType == 'mms') {
          body = 'MMS';
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

        if (threadimg.src && threadimg.src != '') {
          var selectItem = $id('show-multi-sms-' + SmsThreadsData.id);
          var img = selectItem.getElementsByTagName('img')[0];
          img.src = threadimg.src;
          selectItem.dataset.avatar = threadimg.src;
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
    messageListContainer.innerHTML = '';
    for (var j = 0; j < SmsThreadsData.length; j++) {
      if ( (SmsThreadsData[j].dataList.length <= 0) || (index != SmsThreadsData[j].dataList[0].id) ) {
        continue;
      }
      SmsThreadsData = SmsThreadsData[j].dataList[0];
      var threadGroup = $id('id-threads-data-' + SmsThreadsData.id);
      threadGroup.classList.remove('unread');
      var sp = threadGroup.getElementsByTagName('div');
      sp[3].innerHTML = '';
      var threadItem = $id('id-threads-data-' + SmsThreadsData.id);
      var threadname = threadItem.getElementsByTagName('div')[2];
      var threadimg = threadItem.getElementsByTagName('img')[0];

      $id('sms-thread-header').value = SmsThreadsData.id;
      var headerImg = $id('sms-thread-header-img');
      if (threadimg.src && threadimg.src != '') {
        headerImg.src = threadimg.src;
        headerImg.dataset.avatar = threadimg.src;
        headerImg.classList.remove('avatar-default');
      }
      var headerName = $id('sms-thread-header-name');
      headerName.textContent = threadname.childNodes[0].nodeValue;
      var headerButton = $id('sms-thread-header-button');
      if (headerButton) {
        if (threadname.childNodes[0].type != 'contact') {
          headerButton.hidden = false;
          if (handlerHeaderButton) {
            headerButton.removeEventListener('click', handlerHeaderButton, false);
          }
          handlerHeaderButton = function() {
            var addContactData = {
              type: 'add',
              number: threadname.childNodes[0].nodeValue
            }
            ViewManager.showContent('contact-view', addContactData);
          };
          headerButton.addEventListener('click', handlerHeaderButton, false);
        } else {
          headerButton.hidden = true;
          if (handlerHeaderButton) {
            headerButton.removeEventListener('click', handlerHeaderButton, false);
          }
        }
      }
      CMD.SMS.getThreadMessagesById(JSON.stringify(SmsThreadsData.id), function onresponse_getThreadMessagesById(messages) {
        var MessageListData = JSON.parse(messages.data);
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
            if ( !! messageListContainer) {
              messageListContainer.scrollTop = messageListContainer.scrollTopMax;
            }
          }
        });
        messageList.render();
        var forwardBtns = $expr('.button-forward', messageListContainer);
        for (var j = 0; j < forwardBtns.length; j++) {
          forwardBtns[j].hidden = false;
          forwardBtns[j].addEventListener('click', function onclick_replySms(event) {
            var This = this;
            new SendSMSDialog({
              type: 'multi',
              number: null,
              bodyText: This.value
            });
          });
        }
        var resendBtns = $expr('.button-resend', messageListContainer);
        for (var j = 0; j < resendBtns.length; j++) {
          resendBtns[j].hidden = false;
          resendBtns[j].addEventListener('click', function onclick_resendSms(event) {
            var This = this;
            var smsId = This.id.split("sms-resend-");
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
              'id': smsId[1],
              'number': num,
              'body': This.value
            };
            CMD.SMS.resendMessage(JSON.stringify(resendSMS), function onSuccess(event) {
              removeMessage(smsId[1]);
            }, null);
          });
        }
        var deleteBtns = $expr('.button-delete', messageListContainer);
        for (var j = 0; j < deleteBtns.length; j++) {
          deleteBtns[j].hidden = false;
          deleteBtns[j].addEventListener('click', function onclick_deleteSms(event) {
            var This = this;
            var smsId = {
              'id': This.value
            };
            CMD.SMS.deleteMessageById(JSON.stringify(smsId), function onSuccess(event) {
              removeMessage(This.value);
            }, null);
          });
        }
        animationLoading.stop(loadingGroupId);
      }, function onerror_getThreadMessagesById(messages) {
        animationLoading.stop(loadingGroupId);
        log('Error occurs when fetching all messages' + messages.message);
      });
      break;
    }
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
      id: messageData.id,
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
    if (messageData.delivery == "received") {
      //elem.classList.add('to-me');
    } else if (messageData.delivery == "error") {
      elem.classList.add('from-me-error');
    } else {
      elem.classList.add('from-me');
    }
    templateData.time += formatTime(messageData.timestamp);;

    //mms display
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

      templateData.showResendButton = 'true';
      templateData.showReplyButton = 'true';
    } else {
      templateData.type.push('text');
      templateData.body.push(messageData.body);
      if (messageData.delivery == 'error') {
        templateData.showResendButton = 'false';
        templateData.resendValue = messageData.body;
      } else {
        templateData.showResendButton = 'true';
      }
      templateData.showReplyButton = 'false';
      templateData.replyValue = messageData.body;

    }
    templateData.showDeleteButton = 'false';
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
      if (e != elem) {
        e.dataset.checked = e.dataset.focused = false;
        var item = $expr('label', e)[0];
        if (item) {
          item.dataset.checked = false;
        }
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

  function onMessage(msg) {
    if (!threadList) {
      return;
    }
    if (msg == 'updateAvatar') {
      updateAvatar();
      return;
    }
    var threadListData = threadList.getGroupedData();
    if (threadListData.length > 0) {
      for (var i = 0; i < threadListData.length; i++) {
        if ( (threadListData[i].dataList.length <= 0) || (threadListData[i].dataList[0].id != msg.threadId) ) {
          continue;
        }
        threadListData = threadListData[i].dataList[0];
        threadList.remove(threadListData);
        if (msg.delivery == "received") {
          threadListData.unreadCount += 1;
        }
        if (messageList) {
          var messageListData = messageList.getGroupedData();
          messageListData = messageListData[0].dataList;
          if (messageListData.length > 0) {
            if (msg.threadId == messageListData[0].threadId) {
              msg['nearDate'] = messageListData[messageListData.length - 1].timestamp;
              messageList.add(msg);
              if (msg.delivery == "received") {
                threadListData.unreadCount = 0;
              }
            }
          }
        }
        threadListData.body = msg.body;
        threadListData.timestamp = msg.timestamp;
        threadListData.lastMessageType = msg.type;
        threadList.add(threadListData);
        updateThreadAvatar(threadListData);
        showThreadList();
        return;
      }
    } else {
      threadListContainer.innerHTML = '';
    }
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
    var loadingGroupId = animationLoading.start();
    selectAllSms(false);
    var groupedData = threadList.getGroupedData();
    var threadId = item.threadIndex;
    CMD.SMS.getThreadMessagesById(threadId, function onresponse_getThreadMessagesById(messages) {
      var result = [];
      var Sms = JSON.parse(messages.data);
      for (var i = 0; i < Sms.length; i++) {
        var smsId = {
          'id': Sms[i].id
        };
        CMD.SMS.deleteMessageById(JSON.stringify(smsId), function onSuccess(event) {
          result.push(event.result);
          if (result.length != Sms.length) {
            return;
          }
          for (var j = 0; j < groupedData.length; j++) {
            if ( (groupedData[j].dataList.length > 0) && (threadId == groupedData[j].dataList[0].id) ) {
              threadList.remove(groupedData[j].dataList[0]);
              break;
            }
          }
          showThreadList();
          animationLoading.stop(loadingGroupId);
        }, function onError(e) {
          animationLoading.stop(loadingGroupId);
        });
      }
    }, function onerror_getThreadMessagesById(messages) {
      animationLoading.stop(loadingGroupId);
      log('Error occurs when fetching all messages' + messages.message);
    });
  }

  function exportThreads(ids) {
    var loadingGroupId = animationLoading.start();
    var content = '';
    var threadnum = 0;
    ids.forEach(function(item) {
      var threadId = item.threadIndex;
      CMD.SMS.getThreadMessagesById(threadId, function onresponse_getThreadMessagesById(messages) {
        var result = [];
        var msg = JSON.parse(messages.data);
        threadnum++;
        for (var i = 0; i < msg.length; i++) {
          if (result.type == 'sms') {
            content += msg[i].type + ';';
            content += msg[i].id + ';';
            content += msg[i].threadId + ';';
            content += msg[i].delivery + ';';
            content += msg[i].deliveryStatus + ';';
            content += msg[i].sender + ';';
            content += msg[i].receiver + ';';
            content += msg[i].body + ';';
            content += msg[i].messageClass + ';';
            content += msg[i].timestamp + ';';
            content += msg[i].read + '\n';
          } else if (result.type == 'mms') {
            content += msg[i].type + ';';
            content += msg[i].id + ';';
            content += msg[i].threadId + ';';
            content += msg[i].delivery + ';';
            content += msg[i].deliveryStatus + ';';
            content += msg[i].sender + ';';
            content += msg[i].receivers + ';';
            content += msg[i].subject + ';';
            content += msg[i].smil + ';';
            content += msg[i].expiryDate + ';';
            for (var i = 0; i < msg[i].attachments.length; i++) {
              content += msg[i].attachments[i].id + ';';
              content += msg[i].attachments[i].location + ';';
              content += msg[i].attachments[i].content + ';';
            }
            content += msg[i].timestamp + ';';
            content += msg[i].read + '\n';
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
            name: 'sms.vcf',
            extension: 'vcf'
          });
        }
      }, function onerror_getThreadMessagesById(messages) {
        animationLoading.stop(loadingGroupId);
        log('Error occurs when fetching all messages' + messages.message);
      });
    });
  }

  function removeMessage(messageId) {
    var loadingGroupId = animationLoading.start();
    var messageListData = messageList.getGroupedData();
    messageListData = messageListData[0].dataList;
    for (var i = 0; i < messageListData.length; i++) {
      if (messageListData[i].id != messageId) {
        continue;
      }
      if ((i + 1) == messageListData.length) {
        var threadListData = threadList.getGroupedData();
        for (var j = 0; j < threadListData.length; j++) {
          if ( (threadListData[j].dataList.length <= 0) || (threadListData[j].dataList[0].id != messageListData[i].threadId) ) {
            continue;
          }
          threadListData = threadListData[j].dataList[0];
          if (messageListData.length == 1) {
            selectAllSms(false);
            threadList.remove(threadListData);
            ViewManager.showViews('sms-send-view');
          } else {
            threadList.remove(threadListData);
            threadListData.body = messageListData[i].body;
            threadListData.timestamp = messageListData[i].timestamp;
            threadListData.lastMessageType = messageListData[i].type;
            threadList.add(threadListData);
            updateThreadAvatar(threadListData);
          }
          break;
        }
      }
      messageList.remove(messageListData[i]);
      animationLoading.stop(loadingGroupId);
      break;
    }
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
        }), true, function (returnBtn) {
          if(returnBtn) {
            ids.forEach(function(item) {
              SmsList.removeThread(item);
            });
            ViewManager.showViews('sms-send-view');
          }
      });
    });

    $id('add-new-sms').addEventListener('click', function onclick_addNewSms(event) {
      new SendSMSDialog({
        type: 'multi',
        number: null,
        bodyText: null
      });
    });

    $id('sms-send-button').addEventListener('click', function onclick_addNewSms(event) {
      new SendSMSDialog({
        type: 'multi',
        number: null,
        bodyText: null
      });
    });

    var elemSendInput = $id('sender-ctn-input');
    var elemMessageContainer = $id('message-list-container');
    var getStyle = function (elem, name) {
      if(elem.currentStyle) {
        var val = elem.currentStyle[name];
        if (name === 'height' && val.search(/px/i) !== 1) {
          var rect = elem.getBoundingClientRect();
          return rect.bottom - rect.top - parseFloat(getStyle(elem, 'paddingTop')) - parseFloat(getStyle(elem, 'paddingBottom')) + 'px';
        };
        return val;
      } else {
        return getComputedStyle(elem, null)[name];
      }
    },
    minHeight = parseFloat(getStyle(elemSendInput, 'height')),
    maxHeight = 5 * parseFloat(getStyle(elemSendInput, 'height')),
    messageListContainerHeight = parseFloat(getStyle(elemMessageContainer, 'height'));
    elemSendInput.addEventListener('keyup', function onclick_addNewSms(event) {
      var This = this;
      var scrollTop;
      This.style.maxHeight = This.style.resize = 'none';
      if (This._length === This.value.length)
        return;
      This._length = This.value.length;
      scrollTop = This.scrollTop;
      This.style.height = minHeight + 'px';
      if (This.scrollHeight > minHeight) {
        if (maxHeight && This.scrollHeight > maxHeight) {
          This.style.height = maxHeight + 'px';
          This.style.overflowY = 'auto';
        } else {
          This.style.height = This.scrollHeight + 'px';
          This.style.overflowY = 'hidden';
        }
        scrollTop += parseInt(This.style.height) - This.currHeight;
        This.scrollTop = scrollTop;
        This.currHeight = parseInt(This.style.height);
      }
      elemMessageContainer.style.height = messageListContainerHeight - parseFloat(getStyle(elemSendInput, 'height')) + minHeight + 'px';
    });

    $id('refresh-sms').addEventListener('click', function onclick_refreshContacts(event) {
      FFOSAssistant.updateSMSThreads();
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
        }), true, function (returnBtn) {
          if(returnBtn) {
            SmsList.exportThreads(ids);
          }
      });
    });

    $id('sms-send-inthread').addEventListener('click', function onclick_quickreply(event) {
      if (!messageList) {
        return;
      }
      var loadingGroupId = animationLoading.start();
      var num;
      var MessageListData = messageList.getGroupedData();
      MessageListData = MessageListData[0].dataList;
      if (MessageListData.length > 0) {
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
          if (!sms.result) {
            animationLoading.stop(loadingGroupId);
          }
        }, function onError_sendSms(e) {
          animationLoading.stop(loadingGroupId);
        });
        body.value = '';
      }
    });
  });

  return {
    init: initSmsPage,
    removeThread: removeThread,
    exportThreads: exportThreads,
    selectAllSms: selectAllSms
  };
})();