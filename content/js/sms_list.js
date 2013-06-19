/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var SmsList = (function() {
  var groupedList = null;

  function getListContainer() {
    return $id('sms-list-container');
  }

  function showEmptySmsThreads() {
    getListContainer().innerHTML = '';
    var div = document.createElement('div');
    div.classList.add('empty-sms');
    getListContainer().appendChild(div);
    div = document.createElement('div');
    html = '<label data-l10n-id="empty-sms"> </label>';
    div.innerHTML = html;
    div.classList.add('empty-sms-prompt');
    navigator.mozL10n.translate(div)
    getListContainer().appendChild(div);
  }

  function showSmsThreads() {
    var container = getListContainer();
    container.innerHTML = '';
    var SmsThreadsData = groupedList.getGroupedData();
    SmsThreadsData = SmsThreadsData[0].dataList;
    for (var i = 0; i < SmsThreadsData.length; i++) {
      var threadIndex = SmsThreadsData.length - i - 1;
      var thread = SmsThreadsData[threadIndex];
      container.appendChild(createGroupList(thread, threadIndex));
    }

  }

  function checkIfSmsListEmpty() {
    var isEmpty = groupedList.count() == 0;
    if (isEmpty) {
      showEmptySmsThreads();
    } else {
      showSmsThreads();
    }
  }

  function initList(smsThreads) {
    var container = getListContainer();
    container.innerHTML = '';
    ViewManager.showViews('sms-send-view');
    groupedList = new GroupedList({
      dataList: smsThreads,
      dataIndexer: function() {
        return null;
      },
      renderFunc: function() {
        return null;
      },
      container: container,
      ondatachange: checkIfSmsListEmpty
    });
    groupedList.render();
    checkIfSmsListEmpty();
  }

  function createGroupList(group, threadIndex) {
    var html = '';
    html += '<div>';
    html += '  <label class="unchecked"></label>';
    html += '      <div class="readflag"></div>';
    html += '      <div class="avatar-small" data-noavatar="true"></div>';
    html += '      <div class="sms-info">';

    html += '        <div class="name">' + group.participants;
    if (group.unreadCount > 0) {
      html += '<span> (' + group.unreadCount + ' <span id="sms-unread" data-l10n-id="sms-unread">条未读</span> )</span>';
    }
    
    var dt = new Date(group.timestamp);
    var year = dt.getFullYear();
    var month = dt.getMonth() + 1;
    var date = dt.getDate();
    var today = new Date();
    var curYear = today.getFullYear();
    var curMonth = today.getMonth() + 1;
    var curDate = today.getDate();
    
    if (curYear == year && curMonth == month && curDate == date) {
      html += '<span style="float: right;"> ' + '今天' + ' </span>';
    } else {
      html += '<span style="float: right;"> ' + year + '-' + month + '-' + date + ' </span>';
    }
    html += '</div>';
    var body = group.body;
    if (body.length > 40) {
      body = body.substr(0, 40);
    }
    html += '        <div>' + body + '</div>';

    html += '      </div>';
    html += '    </div>';

    var elem = document.createElement('div');

    elem.classList.add('sms-list-item');
    if (group.unreadCount > 0) {
      elem.classList.add('unread');
    }

    elem.innerHTML = html;

    elem.dataset.groupId = group.id;
    elem.id = 'id-grouped-data-' + group.id;
    elem.dataset.threadIndex = threadIndex;

    elem.onclick = function onclick_sms_list(event) {
      var target = event.target;
      if (target instanceof HTMLLabelElement) {
        toggleSmsItem(elem);
      } else {
        smsItemClicked(elem);
      }
      //showSmsInfo(group);
    };
    navigator.mozL10n.translate(elem);
    return elem;
  }

  function showSelectView(item) {
    var header = $id('select-threads-count');
    header.innerHTML = '您选择了 ' + item.length + ' 组短信';
    var body = $id('w-ui-smartlist-body-ctn');
    var html = '';
    for (var i = 0; i < item.length; i++) {
      var index = item[i].dataset.threadIndex;
      var SmsThreadsData = groupedList.getGroupedData();
      SmsThreadsData = SmsThreadsData[0].dataList;
      if ((Number(index) > -1) && (Number(index) < SmsThreadsData.length)) {
        html += '<li class="w-message-conversation-list-item">';
        html += '<div class="avatar">';
        html += '<img src="style/images/avatar.png">';
        html += '</div>';
        html += '<div class="nameplate">';
        html += '<span class="name wc">';
        html += SmsThreadsData[index].participants;
        if (SmsThreadsData[index].unreadCount > 0) {
          html += ' (' + SmsThreadsData[index].unreadCount + ' 条未读) ';
        }
        html += '</span>';
        html += '</div>';
        html += '<div class="summary wc">';
        if (SmsThreadsData[index].body.length > 15) {
          html += SmsThreadsData[index].body.substr(0, 15);
        } else {
          html += SmsThreadsData[index].body;
        }
        html += '</div>';
        html += '</li>';
      }

    }
    body.innerHTML = html;
    ViewManager.showViews('sms-select-view');
  }

  function showThreadView(item) {
    var index = item[0].dataset.threadIndex;
    var SmsThreadsData = groupedList.getGroupedData();
    SmsThreadsData = SmsThreadsData[0].dataList;
    var header = $id('sms-thread-header');
    header.innerHTML = '<img src="style/images/avatar.png" alt="' + SmsThreadsData[index].participants + '">';

    CMD.SMS.getThreadMessagesById(JSON.stringify(SmsThreadsData[index].id), function onresponse_getThreadMessagesById(messages) {
      showThreadDetail(JSON.parse(messages.data));
    }, function onerror_getThreadMessagesById(messages) {
      log('Error occurs when fetching all messages' + messages.message);
    });

    ViewManager.showViews('sms-thread-view');
  }

  function showThreadDetail(threadSms) {
    var body = $id('w-message-threads-list-ctn');
    var html = '';
    for (var i = 0; i < threadSms.length; i++) {
      html += '<li class="w-message-thread">';
      html += '<div class="date-ctn text-thirdly">';
      html += '<hr><date>';
      var dt = new Date(threadSms[i].timestamp);
    var year = dt.getFullYear();
    var month = dt.getMonth() + 1;
    var date = dt.getDate();
    var hour = dt.getHours();
    var minutes = dt.getMinutes();
    var today = new Date();
    var curYear = today.getFullYear();
    var curMonth = today.getMonth() + 1;
    var curDate = today.getDate();
    if (curYear == year && curMonth == month && curDate == date) {
      html += '今天';
    } else {
      html +=  year + '-' + month + '-' + date;
    }
      html += '</date><hr>';
      html += '</div>';
      html += '<ul class="w-message-item-ctn">';
      html += '<div class="content-wrap text-secondary">';
      html += '<span class="content enable-select">';
      html += threadSms[i].body;
      html += '</span>';
      html += '<div class="arrow">';
      html += '<div class="side"></div>';
      html += '</div>';
      html += '<div class="actions">';
      html += '<button class="button-reply" title="转发" disabled="">';
      html += '</button>';
      html += '<button class="button-copy" title="复制" disabled="">';
      html += '</button>';
      html += '<button class="button-delete" title="删除" disabled="">';
      html += '</button>';
      html += '</div>';
      html += '</div>';
      html += '<div class="info text-thirdly">';
      html += '<date>';
      html += hour + ':'+minutes;
      html += '</date>';
      html += '</div>';
      html += '</ul>';
      html += '</li>';
    }
    body.innerHTML = html;
  }


  function smsItemClicked(elem) {
    $expr('#sms-list-container .sms-list-item[data-checked="true"]').forEach(function(e) {
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
    if ($expr('#sms-list-container .sms-list-item').length === 1) {
      $id('select-all-sms').checked = true;
    } else {
      $id('select-all-sms').checked = false;
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
    $id('select-all-sms').checked =
    $expr('#sms-list-container .sms-list-item').length === $expr('#sms-list-container .sms-list-item[data-checked="true"]').length;
    $id('remove-sms').dataset.disabled =
    $expr('#sms-list-container .sms-list-item[data-checked="true"]').length === 0;
    $id('export-sms').dataset.disabled =
    $expr('#sms-list-container .sms-list-item[data-checked="true"]').length === 0;

    var item = $expr('#sms-list-container .sms-list-item[data-checked="true"]');
    if (item.length == 1) {
      showThreadView(item);
    } else if (item.length > 1) {
      showSelectView(item);
    } else {
      ViewManager.showViews('sms-send-view');
    }
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
    $expr('#sms-list-container .sms-list-item').forEach(function(item) {
      selectSmsItem(item, select);
    });
    opStateChanged();
  }

  function showSmsInfo(group) {
    // Set focused dataset which means it's shown in sms view.
 /*   $id('sms-show-view').removeAttribute('hidden');
    $id('sms-sender-view').setAttribute('hidden', true);
    $id('sms-show-view').dataset.index = group.index;

    $expr('.sms-list-item[data-focused=true]').forEach(function(item) {
      delete item.dataset.focused;
    });

    if (!group) {
      group = groupedList.getGroupedData()[0];
    }

    $id('id-grouped-data-' + group.index).dataset.focused = true;

    var elem = $id('sms');
    elem.innerHTML = '';
    var e = document.createElement('div');
    e.innerHTML = group.index;;
    e.classList.add('msm-header');
    elem.appendChild(e);
    var today = new Date();
    var curYear = '';
    var curMonth = '';
    var curDate = '';

    $id('sms-receiver-id').value = group.index;

    for (var index = 0; index < group.dataList.length; index++) {
      var html = '';
      //html += '<div>';
      var dt = new Date(group.dataList[index].timestamp);
      var year = dt.getFullYear();
      var month = dt.getMonth();
      var date = dt.getDate();
      var hour = dt.getHours();
      var minutes = dt.getMinutes();

      if (curYear != dt.getFullYear() || curMonth != dt.getMonth() || curDate != dt.getDate()) {
        html += '<div>';
        if (today.getFullYear() == year && today.getMonth() == month && today.getDate() == date) {
          html += 'today';
        } else {
          html += year + '-' + month + '-' + date;
        }
        curYear = year;
        curMonth = month;
        curDate = date;
        html += '</div>';
      }

      html += '<div>';
      if (!group.dataList[index].sender) {
        html += 'me:';
      } else {
        html += group.dataList[index].sender + ':';
      }
      html += '<span>' + group.dataList[index].body + '  ';
      if (hour < 10) {
        html += '0';
      }
      html += hour + ':';
      if (minutes < 10) {
        html += '0';
      }
      html += minutes + '</span> </div>';
      e = document.createElement('div');
      e.innerHTML = html;
      elem.appendChild(e);
    }

    updateGroupList(group);*/
  }

  function updateGroupList(group) {
    var smsGroup = $id('id-grouped-data-' + group.index);
    var sp = smsGroup.getElementsByTagName('span');
    sp[0].innerHTML = '(' + group.dataList.length + ')';
    smsGroup.classList.remove('unread');
    for (var i = 0; i < group.dataList.length; i++) {
      if (!group.dataList[i].read) {
        group.dataList[i].read = true;
        CMD.SMS.markReadSmsById([group.dataList[i].id], function(response) {
          if (!response.result) {
            //alert('success');
          }
        }, function(e) {
          alert(e);
        });
      }
    }
  }

  /**
   * Get sms received just now
   */

  function onMessage(sms) {
    FFOSAssistant.updateSMSThreads();
/*    var group = groupedList.add(sms);
    showSms();
    showSmsInfo(group);*/
  }

  /**
   * Remove sms
   */

  function removeSms(item) {
    SmsList.selectAllSms(false);
    var groupedData = groupedList.getGroupedData();
    var threadId = groupedData[0].dataList[item.threadIndex].id;
    CMD.SMS.getThreadMessagesById(JSON.stringify(threadId), function onresponse_getThreadMessagesById(messages) {
      var result = [];
      var Sms = JSON.parse(messages.data);
      for (var i = 0; i < Sms.length; i++) {
        CMD.SMS.deleteMessageById(JSON.stringify(Sms[i].id), function onSuccess_removeSms(event) {
          result.push(event.result);
          if (result.length == Sms.length) {
            groupedList.remove(groupedData[0].dataList[item.threadIndex]);
          }
        }, function onError_removeSms(e) {
          alert('Error occured when removing messae' + e);
        });
      }
    }, function onerror_getThreadMessagesById(messages) {
      log('Error occurs when fetching all messages' + messages.message);
    });

  }

  function updateNewSms(id) {
    CMD.SMS.getSmsById(id, function(data) {
      if (!data.result) {
        var sms = data.data;
        groupedList.add(JSON.parse(sms));
        showSms();
      }
    }, function name(e) {
      alert(e);
    });
  }

  function startListening() {
    CMD.SMS.listenMessage(function(sms) {
      }, function(e) {
        alert(e);
      });
  }

  window.addEventListener('load', function wnd_onload(event) {
    //window.setTimeout(startListening, 1000);
    //startListening();
    $id('select-all-sms').addEventListener('change', function sall_onclick(event) {
      selectAllSms(this.checked);
    });

    $id('remove-sms').addEventListener('click', function onclick_removeContact(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var ids = [];
      $expr('#sms-list-container .sms-list-item[data-checked="true"]').forEach(function(item) {
        ids.push(item.dataset);
      });

      if (window.confirm(_('delete-sms-confirm', {
        n: ids.length
      }))) {
        ids.forEach(function(item) {
          SmsList.removeSms(item);
        });
      }

      ViewManager.showViews('sms-send-view');
    });

    $id('add-new-sms').addEventListener('click', function onclick_addNewSms(event) {
      new SendSMSDialog({
        title: 'Send SMS',
        titleL10n: 'send-sms-title',
        bodyText: 'We are installing driver for you.',
        bodyTextL10n: 'installing-driver-body',
        cancelable: true
      });
    });
    $id('sms-send-button').addEventListener('click', function onclick_addNewSms(event) {
      new SendSMSDialog({
        title: 'Send SMS',
        titleL10n: 'send-sms-title',
        bodyText: 'We are installing driver for you.',
        bodyTextL10n: 'installing-driver-body',
        cancelable: true
      });
    });


    $id('refresh-sms').addEventListener('click', function onclick_refreshContacts(event) {
      FFOSAssistant.updateSMSThreads();
      ViewManager.showViews('sms-send-view');
    });

/*    $id('reply-sms').addEventListener('click', function onclick_replySms(event) {
      CMD.SMS.sendSms(JSON.stringify({number:$id('sms-receiver-id').value, sms: $id('sms-text').value}),
                          function onSuccess_sendSms(sms) {
                            if(!sms.result) {
                              updateNewSms(String(JSON.parse(sms.data).id));
                            }
                          }, function onError_sendSms(e) {
                            alert(e);
                          });
    });

    $id('send-sms').addEventListener('click', function onclick_sendSms(event) {
      var receivers = $id('receivers').value.split(',');
      //alert(receivers.length);
      console.log(JSON.stringify({number:receivers, sms: $id('sms-content').value}));
      CMD.SMS.sendSms(JSON.stringify({number:receivers, sms: $id('sms-content').value}),
                          function onSuccess_sendSms(sms) {
                            if(!sms.result) {
                              //todo update UI
                              //alert('send sms');
                              //updateNewSms(String(JSON.parse(sms.data).id));
                            }
                          }, function onError_sendSms(e) {
                            alert(e);
                          });
    });*/

    $id('export-sms').addEventListener('click', function onclick_exportContacts(event) {
   /*   var content = '';
      groupedList.getGroupedData().forEach(function(group) {
        group.dataList.forEach(function(sms) {
          content += 'sms,' + sms.delivery + ',';
          if (sms.sender) {
            content += sms.sender;
          }
          content += ',';
          if (sms.receiver) {
            content += sms.receiver;
          }
          content += ',' + sms.body + ',' + sms.timestamp + ',' + sms.read + '\n';
        });
      });

      navigator.mozFFOSAssistant.saveToDisk(content, function(status) {
        if (status) {
          alert('Sms have been save to disk.');
        }
      }, {
        title: 'Choose where to save',
        name: 'msm.vcf',
        extension: 'vcf'
      });*/
    });
  });

  return {
    init: initList,
    removeSms: removeSms,
    onMessage: onMessage,
    showSmsInfo: showSmsInfo,
    selectAllSms: selectAllSms,
    startListening: startListening,
  };
})();
