/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MessageList = (function() {
  function getListContainer() {
    return $id('message-list-container');
  }

  function updateGroupList(group) {
    var messageGroup = $id('id-grouped-data-' + group.index);
    var sp = messageGroup.getElementsByTagName('span');
    sp[0].innerHTML = '(' + group.dataList.length + ')';
    messageGroup.classList.remove('unread');

    for (var i = 0 ; i < group.dataList.length; i++) {
      if (!group.dataList[i].read) {
        group.dataList[i].read = true;
        CMD.SMS.markReadMessageById([group.dataList[i].id], function(response){
          if (!response.result) {
            //alert('success');
          }
          }, function(e){
          alert(e);
        });
      }
    }
  }
  
  function createGroupList(group) {
    var html = '';
    html += '<div>';
    html += '  <input type="checkbox" data-checked="false"></input>';
    html += '      <div class="readflag"></div>';
    html += '      <div class="avatar-small" data-noavatar="true"></div>';
    html += '      <div class="message-info">'
    if (group.index) {
      html += '        <div class="name">' + group.index + '<span> (';
      var unread = 0;
      for (var i = 0; i < group.dataList.length; i++) {
        if (!group.dataList[i].read) {
          unread++;
        }
      }
      if (unread > 0) {
        html +=  unread + ' <span id="sms-unread" data-l10n-id="sms-unread">条未读</span>,';
      }
    
      html += group.dataList.length + ')</span> </div>'
    }

    if (group.dataList.length > 0) {
      var body = group.dataList[0].body;
      if (body.length > 25) {
        body = body.substr(0,25);
      }
      html += '        <div>' + body +  '</div>';
    }
    html += '      </div>';
    html += '    </div>';

    var elem = document.createElement('div');

    elem.classList.add('message-list-item');
    if (unread) {
      elem.classList.add('unread');
    }

    elem.innerHTML = html;

    elem.dataset.groupId = group.index;
    elem.id = 'id-grouped-data-' + group.index;
    
    elem.onclick = function onclick_messages_list(event) {
      var target = event.target;
      if (target instanceof HTMLInputElement) {
        selectItem(elem, target.checked);
      }
      showMessagesInfo(group);
    };
    navigator.mozL10n.translate(elem);
    return elem;
  }

  /**
   * Show messages group in detail 
   */
  function showMessagesInfo(group) {
    // Set focused dataset which means it's shown in messages view.
    $id('messages-show-view').removeAttribute('hidden');
    $id('message-sender-view').setAttribute('hidden', true);
    $id('messages-show-view').dataset.index = group.index;

    $expr('.message-list-item[data-focused=true]').forEach(function(item) {
      delete item.dataset.focused;
    });

    if (!group) {
      group = groupedList.getGroupedData()[0];
    }
   
    $id('id-grouped-data-' + group.index).dataset.focused = true;
    
    var elem = $id('messages');
    elem.innerHTML = '';
    var e = document.createElement('div');
    e.innerHTML = group.index;;
    e.classList.add('msm-header');
    elem.appendChild(e);
    var today = new Date();
    var curYear = '';
    var curMonth = '';
    var curDate = '';

    $id('message-receiver-id').value = group.index;
      
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
        if (today.getFullYear() == year &&
            today.getMonth() == month &&
            today.getDate() == date) {
          html += 'today';
        } else{
          html += year + '-' + month + '-' + date ;
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
      html +=  hour + ':';
      if (minutes < 10) {
        html += '0';
      }
      html += minutes + '</span> </div>';
      e = document.createElement('div');
      e.innerHTML = html;
      elem.appendChild(e);
    }

    updateGroupList(group);
  }
/*
  function checkIfListEmpty() {
    var isEmpty = groupedList.count() == 0;
    if (isEmpty) {
      $id('sms-view').classList.add('empty-list');
    } else {
      $id('sms-view').classList.remove('empty-list');
    }
  }
*/
  var groupedList = null;

  function initList(messages) {
    groupedList = new DataPool({
      dataList: messages,
      dataKeyGenerator : dataKeyGenerator,
      dataSorter: sorter,
      dataIndexGenerator: getMessageIndex,
      groupDataSorter : sorter,
      groupKeyGenerator: groupKeyGenerator,
      groupSorter: sorter
    });
    groupedList.process();

    showMessages();
  }

  function showMessages() {
    var container = getListContainer();
    container.innerHTML = '';
    for (var i = 0 ; i < groupedList.getGroupedData().length; i++) {
      container.appendChild(createGroupList(groupedList.getGroupedData()[i]));
    }
    //showMessagesInfo(groupedList.getGroupedData()[0]);
    //checkIfListEmpty();
    // console.log(JSON.stringify(groupedList.getGroupedData()));
  }

  function groupKeyGenerator(group) {
    group.key = 0;
    for (var i = 0; i < group.dataList.length; i++) {
      if (group.dataList[i].id > group.key) {
        group.key = group.dataList[i].id;
      }
    }
  }

  function sorter(item1, item2) {
    if (item1.key == item2.key) {
      return 0;
    }
    if (item1.key < item2.key) {
      return 1;
    } else return -1;
  }

  function dataKeyGenerator(message) {
    return message.id;
  }

  function getMessageIndex(message) {
    if(message.receiver) {
      if (message.receiver.length > 11) {
        return message.receiver.substr(message.receiver.length - 11, message.receiver.length);
      } else {
        return message.receiver;
      }
    } else {
      if (message.sender.length > 11) {
        return message.sender.substr(message.sender.length - 11, message.sender.length);
      } else {
        return message.sender;
      }
    }
  }

  /**
   * Get message received just now
   */
  function onMessage(message) {
    var group = groupedList.add(message);
    showMessages();
    showMessagesInfo(group);
  }

  /**
   * Remove messages
   */
  function removeMessages(id) {
    MessageList.selectAllMessages(false);
    var groupedData = groupedList.getGroupedData();
    var ids = [];
    for (var index = 0; index < groupedData.length; index++) {
      if (groupedData[index].index == id) {
        for (var i = 0; i < groupedData[index].dataList.length; i++) {
          ids.push(groupedData[index].dataList[i].id);
        }
      }
    }
    
    for (index = 0; index < ids.length; index++) {
      CMD.SMS.deleteMessageById([ids[index]], function onSuccess_removeMessage(message){
        if (!message.result) {
          return;
        }
      },function onError_removeMessage(e){
        alert('Error occured when removing messae' + e);  
      });
    }
    groupedList.removeGroupByIndex(id);
    var container = $id('id-grouped-data-' + id);
    container.parentNode.removeChild(container);
  }

  function selectAllMessages(select) {
    $expr('#message-list-container .message-list-item').forEach(function(item) {
      selectItem(item, select);
    });

    $id('select-all-messages').checked = select;
  }

  function selectItem(item, select) {
    if (select) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }

    $expr('input[type=checkbox]', item).forEach(function(checkbox) {
      checkbox.checked = select;
      checkbox.dataset.checked = !!select;
    });

    $id('select-all-messages').checked =
      $expr('#message-list-container input[data-checked=false]').length === 0;
    $id('remove-messages').dataset.disabled =
      $expr('#message-list-container input[data-checked=true]').length === 0;
  }

  function updateNewMessage(id) {
    CMD.SMS.getMessageById(id, function(data){
        if (!data.result) {
          var message = data.data;
          groupedList.add(JSON.parse(message));
          showMessages();
        }
      },
      function name(e) {
        alert(e);
      });
  }

  function startListening() {
    CMD.SMS.listenMessage(function(message) {
      //todo listening message
      }, function(e) {
        alert(e);
      });
  }

  window.addEventListener('load', function wnd_onload(event) {
    window.setTimeout(startListening, 1000);

    $id('select-all-messages').addEventListener('change', function sall_onclick(event) {
      selectAllMessages(this.checked);
    });

    $id('remove-messages').addEventListener('click', function onclick_removeContact(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var ids = [];
      $expr('#message-list-container div.selected').forEach(function(item) {
        ids.push(item.dataset.groupId);
      });

      if (window.confirm(_('delete-messages-confirm', {n: ids.length}))) {
        ids.forEach(function(item) {
          MessageList.removeMessages(item);
        });
      }

      if (!$id('messages-show-view').getAttribute('hidden')) {
        var index = $id('messages-show-view').dataset.index;
        if (ids.indexOf(index) != -1) {
          $id('messages-show-view').setAttribute('hidden', true);
          $id('message-sender-view').removeAttribute('hidden');
        }
      }
    });

    $id('add-new-message').addEventListener('click', function onclick_addNewMessage(event) {
      $id('messages-show-view').setAttribute('hidden', true);
      $id('message-sender-view').removeAttribute('hidden');
    });

    $id('refresh-messages').addEventListener('click', function onclick_refreshContacts(event) {
      FFOSAssistant.getAndShowAllSMSs();
      $id('messages-show-view').setAttribute('hidden', true);
      $id('message-sender-view').removeAttribute('hidden');
    });

    $id('reply-message').addEventListener('click', function onclick_replyMessage(event) {
      CMD.SMS.sendMessage(JSON.stringify({number:$id('message-receiver-id').value, message: $id('message-text').value}),
                          function onSuccess_sendMessage(message) {
                            if(!message.result) {
                              updateNewMessage(String(JSON.parse(message.data).id));
                            }
                          }, function onError_sendMessage(e) {
                            alert(e);
                          });
    });

    $id('send-message').addEventListener('click', function onclick_sendMessage(event) {
      var receivers = $id('receivers').value.split(',');
      //alert(receivers.length);
      console.log(JSON.stringify({number:receivers, message: $id('message-content').value}));
      CMD.SMS.sendMessages(JSON.stringify({number:receivers, message: $id('message-content').value}),
                          function onSuccess_sendMessages(message) {
                            if(!message.result) {
                              //todo update UI
                              //alert('send messages');
                              //updateNewMessage(String(JSON.parse(message.data).id));
                            }
                          }, function onError_sendMessage(e) {
                            alert(e);
                          });
    });

    $id('export-messages').addEventListener('click', function onclick_exportContacts(event) {
      var content = '';
      groupedList.getGroupedData().forEach(function(group) {
        group.dataList.forEach(function(message) {
          content += 'sms,' + message.delivery + ',';
          if (message.sender) {
            content += message.sender;
          }
          content += ',';
          if (message.receiver) {
            content += message.receiver;
          }
          content += ',' + message.body + ',' + message.timestamp + ',' + message.read + '\n';
        });
      });

      navigator.mozFFOSAssistant.saveToDisk(content, function(status) {
        if (status) {
          alert('Messages have been save to disk.');
        }
      }, {
        title: 'Choose where to save',
        name: 'msm.vcf',
        extension: 'vcf'
      });
    });
  });

  return {
    init:              initList,
    removeMessages:    removeMessages,
    onMessage:         onMessage,
    showMessagesInfo:  showMessagesInfo,
    selectAllMessages: selectAllMessages
  };
})();

