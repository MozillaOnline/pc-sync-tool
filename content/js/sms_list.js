/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var SmsList = (function() {
  function getListContainer() {
    return $id('sms-list-container');
  }

  function updateGroupList(group) {
    var smsGroup = $id('id-grouped-data-' + group.index);
    var sp = smsGroup.getElementsByTagName('span');
    sp[0].innerHTML = '(' + group.dataList.length + ')';
    smsGroup.classList.remove('unread');

    for (var i = 0 ; i < group.dataList.length; i++) {
      if (!group.dataList[i].read) {
        group.dataList[i].read = true;
        CMD.SMS.markReadSmsById([group.dataList[i].id], function(response){
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
    html += '  <input id="checkbox-' + group.index + '"';
    html += '  class="checkbox" type="checkbox"></input>';
    html += '  <label class="selectAll" for="checkbox-' + group.index + '"></label>';
    html += '      <div class="readflag"></div>';
    html += '      <div class="avatar-small" data-noavatar="true"></div>';
    html += '      <div class="sms-info">';
    
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
    
      html += group.dataList.length + ')</span> </div>';
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

    elem.classList.add('sms-list-item');
    if (unread) {
      elem.classList.add('unread');
    }

    elem.innerHTML = html;

    elem.dataset.groupId = group.index;
    elem.id = 'id-grouped-data-' + group.index;
    
    elem.onclick = function onclick_sms_list(event) {
      var target = event.target;
      if (target instanceof HTMLInputElement) {
        selectItem(elem, target.checked);
      }
      showSmsInfo(group);
    };
    navigator.mozL10n.translate(elem);
    return elem;
  }

  /**
   * Show sms group in detail 
   */
  function showSmsInfo(group) {
    // Set focused dataset which means it's shown in sms view.
    $id('sms-show-view').removeAttribute('hidden');
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

  function checkIfSmsListEmpty() {
    var isEmpty = groupedList.getGroupedData().length;
    if (isEmpty == 0) {
      showEmptySms();
    }
  }

  
  var groupedList = null;

  function initList(sms) {
    var container = getListContainer();
    container.innerHTML = '';
    
    ViewManager.showViews('sms-show-view');
    
    groupedList = new DataPool({
      dataList: sms,
      dataKeyGenerator : dataKeyGenerator,
      dataSorter: sorter,
      dataIndexGenerator: getSmsIndex,
      groupDataSorter : sorter,
      groupKeyGenerator: groupKeyGenerator,
      groupSorter: sorter
    });
    groupedList.process();
    
    checkIfSmsListEmpty();
    showSms();
  }
  
  function showEmptySms() {
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

  function showSms() {
    var container = getListContainer();
    container.innerHTML = '';
    for (var i = 0 ; i < groupedList.getGroupedData().length; i++) {
      container.appendChild(createGroupList(groupedList.getGroupedData()[i]));
    }
    //showSmsInfo(groupedList.getGroupedData()[0]);
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

  function dataKeyGenerator(sms) {
    return sms.id;
  }

  function getSmsIndex(sms) {
    //return sms.threadId;
    if(sms.delivery == 'sent'){
      return sms.receiver;
    }else{
      return sms.sender;
    }
  }

  /**
   * Get sms received just now
   */
  function onSms(sms) {
    var group = groupedList.add(sms);
    showSms();
    showSmsInfo(group);
  }

  /**
   * Remove sms
   */
  function removeSms(id) {
    SmsList.selectAllSms(false);
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
      CMD.SMS.deleteSmsById([ids[index]], function onSuccess_removeSms(sms){
        if (!sms.result) {
          return;
        }
      },function onError_removeSms(e){
        alert('Error occured when removing messae' + e);  
      });
    }
    groupedList.removeGroupByIndex(id);
    var container = $id('id-grouped-data-' + id);
    container.parentNode.removeChild(container);
  }

  function selectAllSms(select) {
    $expr('#sms-list-container .sms-list-item').forEach(function(item) {
      selectItem(item, select);
    });

    $id('select-all-sms').checked = select;
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

    $id('select-all-sms').checked =
      $expr('#sms-list-container input[data-checked=false]').length === 0;
    $id('remove-sms').dataset.disabled =
      $expr('#sms-list-container input[data-checked=true]').length === 0;
  }

  function updateNewSms(id) {
    CMD.SMS.getSmsById(id, function(data){
        if (!data.result) {
          var sms = data.data;
          groupedList.add(JSON.parse(sms));
          showSms();
        }
      },
      function name(e) {
        alert(e);
      });
  }

  function startListening() {
/*    CMD.SMS.listenSms(function(sms) {
      //todo listening sms
      }, function(e) {
        alert(e);
      });*/
  }

  window.addEventListener('load', function wnd_onload(event) {
    window.setTimeout(startListening, 1000);

    $id('select-all-sms').addEventListener('change', function sall_onclick(event) {
      selectAllSms(this.checked);
    });

    $id('remove-sms').addEventListener('click', function onclick_removeContact(event) {
      // Do nothing if the button is disabled.
      if (this.dataset.disabled == 'true') {
        return;
      }

      var ids = [];
      $expr('#sms-list-container div.selected').forEach(function(item) {
        ids.push(item.dataset.groupId);
      });

      if (window.confirm(_('delete-sms-confirm', {n: ids.length}))) {
        ids.forEach(function(item) {
          SmsList.removeSms(item);
        });
      }

      if (!$id('sms-show-view').getAttribute('hidden')) {
        var index = $id('sms-show-view').dataset.index;
        if (ids.indexOf(index) != -1) {
          $id('sms-show-view').setAttribute('hidden', true);
          $id('sms-sender-view').removeAttribute('hidden');
        }
      }
    });

    $id('add-new-sms').addEventListener('click', function onclick_addNewSms(event) {
      $id('sms-show-view').setAttribute('hidden', true);
      $id('sms-sender-view').removeAttribute('hidden');
    });

    $id('refresh-sms').addEventListener('click', function onclick_refreshContacts(event) {
      FFOSAssistant.getAndShowAllSMSs();
      $id('sms-show-view').setAttribute('hidden', true);
      $id('sms-sender-view').removeAttribute('hidden');
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
      var content = '';
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
      });
    });
  });

  return {
    init:              initList,
    removeSms:    removeSms,
    onSms:         onSms,
    showSmsInfo:  showSmsInfo,
    selectAllSms: selectAllSms
  };
})();

