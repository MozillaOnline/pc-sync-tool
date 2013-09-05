/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var SmsList = (function() {
  var threadList = null;
  var threadListContainer = null;
  var selectedList = null;
  var selectedListContainer = null;
  var messageList = null;
  var messageListContainer = null;

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
      dataIndexer: function() {
        return 'threadlist';
      },
      disableDataIndexer: true,
      renderFunc: createGroupThreadList,
      container: threadListContainer
    });

    threadList.render();
    updateAvatar();
    showThreadList();
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
    CMD.Contacts.getContactByPhoneNumber(item.participants, function(result) {
      if (result.data != '') {
        var contactData = JSON.parse(result.data);
        var threadItem = $id('id-threads-data-' + threadInfo.id);
        var name = threadItem.getElementsByTagName('div')[3];
        name.childNodes[0].nodeValue = contactData.name;
        name.childNodes[0].type = 'contact';
        var selectViewName = $id('show-multi-sms-content-number-' + threadInfo.id);

        if (selectViewName != null) {
          selectViewName.childNodes[0].nodeValue = contactData.name;
        }

        var messageViewName = $id('sms-thread-header-name-' + threadInfo.id);

        if (messageViewName != null) {
          messageViewName.childNodes[0].nodeValue = contactData.name;
          var titleElem = $id('add-to-contact-' + threadInfo.id);
          if (titleElem) {
            titleElem.style.display = 'none';
          }
        }

        if ((contactData.photo != null) && (contactData.photo.length > 0)) {
          var threadItem = $id('id-threads-data-' + threadInfo.id);
          var img = threadItem.getElementsByTagName('img')[0];
          img.src = contactData.photo;
          threadItem.dataset.avatar = contactData.photo;

          if (img.classList.contains('avatar-default')) {
            img.classList.remove('avatar-default');
          }

          var selectViewimg = $id('show-multi-sms-content-img-' + threadInfo.id);

          if (selectViewimg != null) {
            selectViewimg.src = contactData.photo;
            if (selectViewimg.classList.contains('avatar-default')) {
              selectViewimg.classList.remove('avatar-default');
            }
          }

          var messageViewimg = $id('sms-thread-header-img-' + threadInfo.id);
          if (messageViewimg != null) {
            messageViewimg.src = contactData.photo;
            if (messageViewimg.classList.contains('avatar-default')) {
              messageViewimg.classList.remove('avatar-default');
            }
          }
        }
      }
    }, function(e) {
      alert('get getContactByPhoneNumber error:' + e);
    });
  }

  function showThreadList() {
    var isEmpty = threadList.count() == 0;
    if (isEmpty) {
      threadListContainer.innerHTML = '';
      $id('selectAll-sms').dataset.disabled = true;
      var div = document.createElement('div');
      div.classList.add('empty-sms');
      threadListContainer.appendChild(div);
      div = document.createElement('div');
      html = '<label data-l10n-id="empty-sms"> </label>';
      div.innerHTML = html;
      div.classList.add('empty-sms-prompt');
      navigator.mozL10n.translate(div)
      threadListContainer.appendChild(div);
    } else {
      $id('selectAll-sms').dataset.disabled = false;
    }
  }

  function createGroupThreadList(threadData) {
    var html = '';
    html += '<div>';
    html += '  <label class="unchecked"></label>';
    html += '  <div class="readflag"></div>';
    html += '  <img class="avatar avatar-default">';
    html += '  <div class="sms-info">';
    html += '    <div class="name">' + threadData.participants;
    if (threadData.unreadCount > 0) {
      html += '    <span> ('
      html += threadData.unreadCount;
      html += '    <span id="sms-unread" data-l10n-id="sms-unread"></span> )</span>';
    }
    var dt = new Date(threadData.timestamp);
    var year = dt.getFullYear();
    var month = dt.getMonth() + 1;
    var date = dt.getDate();
    var today = new Date();
    var curYear = today.getFullYear();
    var curMonth = today.getMonth() + 1;
    var curDate = today.getDate();
    if (curYear == year && curMonth == month && curDate == date) {
      html += '    <span style="float: right; color:#6a6a6a; font-size:12px;" data-l10n-id="today"></span>';
    } else {
      html += '    <span style="float: right; color:#6a6a6a; font-size:12px;"> ' + year + '-' + month + '-' + date + ' </span>';
    }
    html += '    </div>';
    var body = threadData.body;
    if (body.length > 36) {
      body = body.substr(0, 36);
    }
    html += '    <div class="body">' + body + '</div>';
    html += '  </div>';
    html += '</div>';
    var elem = document.createElement('div');
    elem.classList.add('threads-list-item');

    if (threadData.unreadCount > 0) {
      elem.classList.add('unread');
    }

    elem.innerHTML = html;
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
      var html = '';
      var div = document.createElement('div');
      var index = item[i].dataset.threadIndex;
      var SmsThreadsData = threadList.getGroupedData();
      SmsThreadsData = SmsThreadsData[0].dataList;

      for(var j = 0; j < SmsThreadsData.length; j++) {
        if (index == SmsThreadsData[j].id) {
          SmsThreadsData = SmsThreadsData[j];
          var threadItem = $id('id-threads-data-' + SmsThreadsData.id);
          var threadname = threadItem.getElementsByTagName('div')[3];
          var threadimg = threadItem.getElementsByTagName('img')[0];
          html = '<img class="multi-avatar-show multi-avatar-show-default" src="';
          html += threadimg.src;
          html += '" id="';
          html += 'show-multi-sms-content-img-';
          html += SmsThreadsData.id
          html += '"></img>';
          html += '<div class="show-multi-sms-content">';
          html += '  <div class="number" id="';
          html += 'show-multi-sms-content-number-';
          html += SmsThreadsData.id
          html += '">';
          html += threadname.childNodes[0].nodeValue;

          if (SmsThreadsData.unreadCount > 0) {
            var header = _('sms-unread-count', {
              n: SmsThreadsData.unreadCount
            });
            html += header;
          }

          html += '  </div>';
          html += '  <div class="body">';

          if (SmsThreadsData.body.length > 12) {
            html += SmsThreadsData.body.substr(0, 12) + '..';
          } else {
            html += SmsThreadsData.body;
          }

          html += '  </div>';
          html += '</div>';
          div.innerHTML = html;
          div.classList.add('show-sms-item');
          selectedListContainer.appendChild(div);
        }
      }
    }
    ViewManager.showViews('sms-select-view');
  }

  function showThreadView(item) {
    var index = item[0].dataset.threadIndex;
    var SmsThreadsData = threadList.getGroupedData();
    SmsThreadsData = SmsThreadsData[0].dataList;
    for (var j = 0; j < SmsThreadsData.length; j++) {
      if (index == SmsThreadsData[j].id) {
        SmsThreadsData = SmsThreadsData[j];
        var threadGroup = $id('id-threads-data-' + SmsThreadsData.id);
        var sp = threadGroup.getElementsByTagName('span');
        sp[0].innerHTML = '';
        threadGroup.classList.remove('unread');
        var threadItem = $id('id-threads-data-' + SmsThreadsData.id);
        var threadname = threadItem.getElementsByTagName('div')[3];
        var threadimg = threadItem.getElementsByTagName('img')[0];
        var header = $id('sms-thread-header');
        var html = '';
        html += '<img style="height:5.5rem; width:5.5rem; padding-top: 20px; float: left;" src="';

        if (threadimg.src != "") {
          html += threadimg.src;
        } else {
          html += 'chrome://ffosassistant/content/style/images/avatar.png';
        }

        html += '" id="sms-thread-header-img-';
        html += SmsThreadsData.id;
        html += '">';
        html += '<span style="float: left; margin-top: 22px; margin-left: 10px;" id="';
        html += 'sms-thread-header-name-';
        html += SmsThreadsData.id;
        html += '">';
        html += threadname.childNodes[0].nodeValue;//SmsThreadsData[index].participants;
        html += '</span>';
        html += '<div id="add-to-contact-';
        html += SmsThreadsData.id;
        html += '" class="button" data-l10n-id="add-to-contacts-from-sms" style="margin-left: 65px; height: 21px; margin-top: 50px; width: 106px;">添加到联系人</div>';
        header.innerHTML = html;

        var addtoContactButton = $id('add-to-contact-'+SmsThreadsData.id);
        if (addtoContactButton) {
          if (threadname.childNodes[0].type != 'contact') {
            addtoContactButton.style.display = 'block';
            addtoContactButton.addEventListener('click', function onclick_addto(event) {
              var addContactData = {
                type: 'add',
                number: threadname.childNodes[0].nodeValue
              }
              ViewManager.showContent('contact-view',addContactData);
            });
          } else {
            addtoContactButton.style.display = 'none';
          }
        }
        CMD.SMS.getThreadMessagesById(JSON.stringify(SmsThreadsData.id), function onresponse_getThreadMessagesById(messages) {
          var MessageListData = JSON.parse(messages.data);
          for (var i = 0; i < MessageListData.length; i++) {
            var nearDate = null;
            if (i > 0) {
              MessageListData[i]['nearDate'] = MessageListData[i-1].timestamp;
            } else {
              MessageListData[i]['nearDate'] = 0;
            }
          }
          messageListContainer.innerHTML = '';
          messageList = new GroupedList({
            dataList: MessageListData,
            dataIndexer: function() {
              return 'messagelist';
            },
            disableDataIndexer: true,
            renderFunc: createGroupMessageList,
            container: messageListContainer,
            ondatachange: function() {
              if (messageListContainer != null) {
                messageListContainer.scrollTop=messageListContainer.scrollTopMax;
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
                num = MessageListData[0].receiver;
              }
              CMD.SMS.deleteMessageById(smsId[1], function onSuccess(event) {
                removeMessage(smsId[1]);
                CMD.SMS.sendMessage(JSON.stringify({
                  number: num,
                  message: This.value
                }), function onSuccess_sendSms(sms) {
                  if (!sms.result) {
                    updateAvatar();
                  }
                }, function onError_sendSms(e) {
                  alert(e);
                });
              }, function onError(e) {
                alert('Error occured when removing message' + e);
              });
            });
          }
          var deleteBtns = $expr('.button-delete', messageListContainer);
          for (var j = 0; j < deleteBtns.length; j++) {
            deleteBtns[j].hidden = false;
            deleteBtns[j].addEventListener('click', function onclick_deleteSms(event) {
              var This = this;
              CMD.SMS.deleteMessageById(This.value, function onSuccess(event) {
                removeMessage(This.value);
              }, function onError(e) {
                alert('Error occured when removing message' + e);
              });
            });
          }
        }, function onerror_getThreadMessagesById(messages) {
          log('Error occurs when fetching all messages' + messages.message);
        });
      }
    }
    ViewManager.showViews('sms-thread-view');
  }

  function createGroupMessageList(MessageData) {
    CMD.SMS.markReadMessageById(JSON.stringify(MessageData.id), function(response) {
      if (!response.result) {
        //TODO: mark message read state
      }
    }, function(e) {
      alert(e);
    });

    var html = '';
    html += '<div>';
    html += '<li class="sms-message-thread">';
    html += '<div class="date-ctn text-thirdly">';
    html += '<date>';
    var dt = new Date(MessageData.timestamp);
    var year = dt.getFullYear();
    var month = dt.getMonth() + 1;
    var date = dt.getDate();
    var hour = dt.getHours();
    var minutes = dt.getMinutes();
    var today = new Date();
    var curYear = today.getFullYear();
    var curMonth = today.getMonth() + 1;
    var curDate = today.getDate();
    if (MessageData.nearDate) {
      var olddt = new Date(MessageData.nearDate);
      if (olddt.getFullYear() != year || (olddt.getMonth() + 1) != month || olddt.getDate() != date) {
        if (curYear == year && curMonth == month && curDate == date) {
          html += _('today');
        } else {
          html += year + '-' + month + '-' + date;
        }
      }
    } else {
      if (curYear == year && curMonth == month && curDate == date) {
        html += _('today');
      } else {
        html += year + '-' + month + '-' + date;
      }
    }
    html += '</date>';
    html += '</div>';
    html += '<ul class="sms-message-item-ctn">';

    if (MessageData.delivery == "received") {
      html += '<li ';
    } else if (MessageData.delivery == "error") {
      html += '<li class="from-me-error" ';
    } else {
      html += '<li class="from-me" ';
    }

    html += 'id="sms-id-' + MessageData.id + '">';
    html += '<div class="content-wrap text-secondary">';
    html += '<span class="content enable-select">';
    html += MessageData.body;
    html += '</span>';
    html += '<div class="arrow">';
    html += '<div class="side"></div>';
    html += '</div>';
    html += '<div class="actions">';

    if (MessageData.delivery == "error") {
      html += '<button class="button-resend" title="重发" ';
      html += 'id="sms-resend-' + MessageData.id + '" ';
      html += 'value="' + MessageData.body + '">';
      html += '</button>';
    }

    html += '<button class="button-forward" title="转发" ';
    html += 'id="sms-reply-' + MessageData.id + '" ';
    html += 'value="' + MessageData.body + '">';
    html += '</button>';
    html += '<button class="button-delete" title="删除" ';
    html += 'id="sms-delete-' + MessageData.id + '" ';
    html += 'value="' + MessageData.id + '">';
    html += '</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="info text-thirdly">';
    html += '<date>';
    if (hour < 10) {
      html += '0';
    }
    html += hour + ':';
    if (minutes < 10) {
      html += '0';
    }
    html += minutes;
    html += '</date>';
    html += '</div>';
    html += '</li>';
    html += '</ul>';
    html += '</li>';
    html += '    </div>';
    var elem = document.createElement('div');
    elem.classList.add('messages-list-item');
    elem.innerHTML = html;
    elem.dataset.groupId = MessageData.threadId;
    elem.id = 'id-message-data-' + MessageData.threadId;
    navigator.mozL10n.translate(elem);
    return elem;
  }

  function smsItemClicked(elem) {
    $expr('#threads-list-container .threads-list-item[data-checked="true"]').forEach(function(e) {
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
    if ($expr('#threads-list-container .threads-list-item').length === 1) {
      $id('selectAll-sms').dataset.checked = true;
    } else {
      $id('selectAll-sms').dataset.checked = false;
    }
    $id('remove-sms').dataset.disabled = false;
    $id('export-sms').dataset.disabled = false;
    opStateChanged();
  }

  function toggleSmsItem(elem) {
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
      $id('selectAll-sms').dataset.checked =
      $expr('#threads-list-container .threads-list-item').length === threadlistLength;
      $id('selectAll-sms').dataset.disabled = false;
      if (threadlistLength == 1) {
        showThreadView(item);
      } else if (threadlistLength > 1) {
        showSelectView(item);
      } else {
        ViewManager.showViews('sms-send-view');
      }
    }
    $id('remove-sms').dataset.disabled =
    threadlistLength === 0;
    $id('export-sms').dataset.disabled =
    threadlistLength === 0;
  }

  function selectSmsItem(elem, selected) {
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

  function selectAllSms(select) {
    $expr('#threads-list-container .threads-list-item').forEach(function(item) {
      selectSmsItem(item, select);
    });
    opStateChanged();
  }

  /**
   * Get sms received just now
   */

  function onMessage(sms) {
    if (threadList) {
      if (sms == 'updateAvatar') {
        updateAvatar();
      } else {
        var threadListData = threadList.getGroupedData();
        if (threadListData.length > 0) {
          threadListData = threadListData[0].dataList;
          for(var i = 0; i < threadListData.length; i++) {
            if (threadListData[i].id == sms.threadId) {
              threadList.remove(threadListData[i]);
              if (sms.delivery == "received") {
                threadListData[i].unreadCount += 1;
              }
              if (messageList) {
                var messageListData = messageList.getGroupedData();
                messageListData = messageListData[0].dataList;
                if (messageListData.length > 0) {
                  if (sms.threadId == messageListData[0].threadId) {
                    sms['nearDate'] = messageListData[messageListData.length-1].timestamp;
                    messageList.add(sms);
                    if (sms.delivery == "received") {
                      threadListData[i].unreadCount = 0;
                    }
                  }
                }
              }
              threadListData[i].body = sms.body;
              threadListData[i].timestamp = sms.timestamp;
              threadListData[i].lastMessageType = sms.type;
              threadList.add(threadListData[i]);
              updateAvatar();
              return;
            }
          }
        }else{
          threadListContainer.innerHTML = '';
        }
        var tempparticipants;
        var unreadCount;
        if (sms.delivery == "received") {
          tempparticipants = sms.sender;
          unreadCount = 1;
        } else {
          tempparticipants = sms.receiver;
          unreadCount = 0;
        }
        var tempthreadListData = {
          'id': sms.threadId,
          'body': sms.body,
          'timestamp': sms.timestamp,
          'unreadCount': unreadCount,
          'participants': tempparticipants,
          'lastMessageType': sms.type
        };
        tempthreadListData['threadIndex'] = sms.threadId;
        threadList.add(tempthreadListData);
        updateAvatar();
      }
    }
  }

  /**
   * Remove sms
   */
  function removeThreads(item) {
    SmsList.selectAllSms(false);
    var groupedData = threadList.getGroupedData();
    groupedData = groupedData[0].dataList;
    var threadId = item.threadIndex;
    CMD.SMS.getThreadMessagesById(threadId, function onresponse_getThreadMessagesById(messages) {
      var result = [];
      var Sms = JSON.parse(messages.data);
      for (var i = 0; i < Sms.length; i++) {
        CMD.SMS.deleteMessageById(JSON.stringify(Sms[i].id), function onSuccess(event) {
          result.push(event.result);
          if (result.length == Sms.length) {
            for(var j = 0; j < groupedData.length; j++) {
              if (threadId == groupedData[j].id) {
                threadList.remove(groupedData[j]);
              }
            }
          }
        }, function onError(e) {
          alert('Error occured when removing messae' + e);
        });
      }
    }, function onerror_getThreadMessagesById(messages) {
      log('Error occurs when fetching all messages' + messages.message);
    });
  }

  function exportThreads(ids) {
    var content = '';
    var threadnum = 0;
    ids.forEach(function(item) {
      var threadId = item.threadIndex;
      CMD.SMS.getThreadMessagesById(threadId, function onresponse_getThreadMessagesById(messages) {
        var result = [];
        var Sms = JSON.parse(messages.data);
        threadnum++;
        for (var i = 0; i < Sms.length; i++) {
          content += Sms[i].type + ',';
          content += Sms[i].delivery + ',';
          content += Sms[i].sender + ',';
          content += Sms[i].receiver + ',';
          content += Sms[i].body + ',';
          content += Sms[i].timestamp + ',';
          content += Sms[i].read + '\n';
        }
        if (threadnum == ids.length) {
          navigator.mozFFOSAssistant.saveToDisk(content, function(status) {
            if (status) {
              alert(_('export-sms-success'));
            }
          }, {
            title: _('export-sms-success'),
            name: 'sms.vcf',
            extension: 'vcf'
          });
        }
      }, function onerror_getThreadMessagesById(messages) {
        log('Error occurs when fetching all messages' + messages.message);
      });
    });
  }

  function removeMessage(messageId) {
    var messageListData = messageList.getGroupedData();
    messageListData = messageListData[0].dataList;
    for (var i = 0; i < messageListData.length; i++) {
      if (messageListData[i].id == messageId) {
        if ((i+1) == messageListData.length) {
          var threadListData = threadList.getGroupedData();
          threadListData = threadListData[0].dataList;
          for(var j = 0; j < threadListData.length; j++) {
            if (threadListData[j].id == messageListData[i].threadId) {
              if (messageListData.length == 1) {
                SmsList.selectAllSms(false);
                threadList.remove(threadListData[j]);
                ViewManager.showViews('sms-send-view');
                break;
              } else {
                threadList.remove(threadListData[j]);
                threadListData[j].body = messageListData[i].body;
                threadListData[j].timestamp = messageListData[i].timestamp;
                threadListData[j].lastMessageType = messageListData[i].type;
                threadList.add(threadListData[j]);
                updateAvatar();
                break;
              }
            }
          }
        }
        messageList.remove(messageListData[i]);
        break;
      }
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

      if (window.confirm(_('delete-sms-confirm', {
        n: ids.length
      }))) {
        ids.forEach(function(item) {
          SmsList.removeThreads(item);
        });
        ViewManager.showViews('sms-send-view');
      }
    });

    $id('add-new-sms').addEventListener('click', function onclick_addNewSms(event) {
      new SendSMSDialog({
        number: null,
        bodyText: null
      });
    });

    $id('sms-send-button').addEventListener('click', function onclick_addNewSms(event) {
      new SendSMSDialog({
        number: null,
        bodyText: null
      });
    });

    $id('sender-ctn-input').addEventListener('keyup', function onclick_addNewSms(event) {
      var This = this;
      var height = This.scrollHeight + 2;
      var subListHeight = 380 + 30 - height;
      if (subListHeight > 200) {
        This.style.height = height + 'px';
        messageListContainer.style.height = subListHeight + 'px';
      }
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
      if (window.confirm(_('export-sms-confirm', {
        n: ids.length
      }))) {
        SmsList.exportThreads(ids);
      }
    });

    $id('sms-send-inthread').addEventListener('click', function onclick_quickreply(event) {
      if (messageList) {
        var num;
        var MessageListData = messageList.getGroupedData();
        MessageListData = MessageListData[0].dataList;
        if (MessageListData.length > 0) {
          if (MessageListData[0].delivery == "received") {
            num = MessageListData[0].sender;
          } else {
            num = MessageListData[0].receiver;
          }
          var body = $id('sender-ctn-input');
          CMD.SMS.sendMessage(JSON.stringify({
            number: num,
            message: body.value
          }), function onSuccess_sendSms(sms) {
            if (!sms.result) {
              updateAvatar();
            }
          }, function onError_sendSms(e) {
            alert(e);
          });
          body.value='';
        }
      }
    });
  });

  return {
    init: initSmsPage,
    removeThreads: removeThreads,
    exportThreads: exportThreads,
    onMessage: onMessage,
    selectAllSms: selectAllSms,
  };
})();
