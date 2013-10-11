/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var animationLoading = null;
var FFOSAssistant = (function() {
  var connPool = null;
  var connListenSocket = null;
  var handlerUsbConnection = null;
  var handlerWifiConnection = null;
  var handlerWifiConnect = null;
  var wsurl = "ws://" + location.host + "/ws";
  var heartBeatSocket = null;

  function showConnectView() {
    animationLoading.reset();
    $id('device-connected').classList.add('hiddenElement');
    $id('device-unconnected').classList.remove('hiddenElement');
    $id('views').classList.add('hidden-views');

    if (handlerUsbConnection) {
      $id('usb-connection-button').removeEventListener('click', handlerUsbConnection, false);
    }

    handlerUsbConnection = function() {
      $id('wifi-connection-button').dataset.checked = false;
      $id('usb-connection-button').dataset.checked = true;
      $id('wifi-arrow').classList.add('hiddenElement');
      $id('usb-arrow').classList.remove('hiddenElement');
      $id('wifi-connection-code-input').classList.add('hiddenElement');
      $id('wifi-connect-button').classList.add('hiddenElement');
      $id('wifi-connection-button').classList.remove('wifi-connection-button-select');
      $id('usb-connection-button').classList.add('usb-connection-button-select');
      $id('step-one').classList.remove('step-one-wifi');
      $id('step-two').classList.remove('step-two-wifi');
      $id('step-two').classList.add('step-two-usb');
      $id('step-three').classList.remove('step-three-wifi');
      $id('step-one-span').textContent = _('usb-step-one');
      $id('step-three-span').textContent = _('usb-step-three');
      $id('step-one-span').dataset.l10nId = 'usb-step-one';
      $id('step-three-span').dataset.l10nId = 'usb-step-three';
    };

    $id('usb-connection-button').addEventListener('click', handlerUsbConnection, false);

    if (handlerWifiConnection) {
      $id('wifi-connection-button').removeEventListener('click', handlerWifiConnection, false);
    }

    handlerWifiConnection = function() {
      $id('wifi-connection-button').dataset.checked = true;
      $id('usb-connection-button').dataset.checked = false;
      $id('usb-arrow').classList.add('hiddenElement');
      $id('wifi-arrow').classList.remove('hiddenElement');
      $id('wifi-connection-code-input').classList.remove('hiddenElement');
      $id('wifi-connect-button').classList.remove('hiddenElement');
      $id('wifi-connection-button').classList.add('wifi-connection-button-select');
      $id('usb-connection-button').classList.remove('usb-connection-button-select');
      $id('step-one').classList.add('step-one-wifi');
      $id('step-two').classList.remove('step-two-usb');
      $id('step-two').classList.add('step-two-wifi');
      $id('step-three').classList.add('step-three-wifi');
      $id('step-one-span').textContent = _('wifi-step-one');
      $id('step-three-span').textContent = _('wifi-step-three');
      $id('step-one-span').dataset.l10nId = 'wifi-step-one';
      $id('step-three-span').dataset.l10nId = 'wifi-step-three';
    };

    $id('wifi-connection-button').addEventListener('click', handlerWifiConnection, false);

    if (handlerWifiConnect) {
      $id('wifi-connect-button').removeEventListener('click', handlerWifiConnect, false);
    }

    handlerWifiConnect = function() {
      var wifiCode = $id('wifi-connection-code');
      if (wifiCode && wifiCode.value && wifiCode.value.length > 0) {
        var ip = '';
        var dataArray = new ArrayBuffer(4);
        var int8Array = new Uint8Array(dataArray);
        var int32Array = new Uint32Array(dataArray);
        int32Array[0] = parseInt(wifiCode.value);
        ip = int8Array[0].toString() + '.' + int8Array[1].toString() + '.' + int8Array[2].toString() + '.' + int8Array[3].toString();
        var elem = $id('mgmt-list');
        $expr('.header', elem)[0].textContent = wifiCode.value;

        if (navigator.mozFFOSAssistant) {
          heartBeatSocket = navigator.mozTCPSocket.open(ip, 10010);
          heartBeatSocket.onclose = function onclose_socket() {
            navigator.mozFFOSAssistant.wifiConnected(false);
          };
          heartBeatSocket.onopen = function onclose_socket() {
            navigator.mozFFOSAssistant.wifiConnected(true);
          };
        }
        connectToDevice(ip);
      }
    };
    $id('wifi-connect-button').addEventListener('click', handlerWifiConnect, false);

    ViewManager.showContent('connect-view');
  }

  function showSummaryView(serverIP) {
    if (connListenSocket) {
      connListenSocket.socket.close();
      connListenSocket = null;
    }

    var socket = navigator.mozTCPSocket.open(serverIP, 10010, {
      binaryType: 'arraybuffer'
    });
    socket.onopen = function tc_onSocketOpened(event) {
      var socketWrapper = new TCPSocketWrapper({
        socket: event.target,
        onmessage: function(socket, jsonCmd, sendCallback, recvData) {
          if (connListenSocket == null) {
            return;
          }
          var message = JSON.parse(recvData);
          if (message.type == 'sms') {
            SmsList.onMessage(message);
          } else if (message.type == 'contact') {
            ContactList.onMessage(message);
            SmsList.onMessage('updateAvatar');
          }
        },
        onclose: function() {
          connListenSocket = null;
        }
      });
      connListenSocket = socketWrapper;
      CMD.Listen.listenMessage(function() {}, function(e) {
        new AlertDialog(e);
      });
    };
    $id('device-disconnect').addEventListener('click', function onclick_disconnect(event) {
      if (connPool) {
        connPool.finalize();
        connPool = null;
      }
      if (heartBeatSocket) {
        heartBeatSocket.close();
      }
      showConnectView();
      ViewManager.reset();
    });
    if (navigator.mozFFOSAssistant.isWifiConnect) {
      $id('device-image-connection').classList.add('wifiConnection');
    } else {
      $id('device-image-connection').classList.remove('wifiConnection');
    }
    $id('device-connected').classList.remove('hiddenElement');
    $id('device-unconnected').classList.add('hiddenElement');
    ViewManager.showContent('summary-view');
  }

  /**
   * Format storage size.
   */

  function formatStorage(sizeInBytes) {
    var sizeInMega = sizeInBytes / 1024 / 1024;

    if (sizeInMega > 900) {
      var sizeInGiga = sizeInMega / 1024;
      return (sizeInGiga.toFixed ? sizeInGiga.toFixed(2) : sizeInGiga) + 'G';
    }

    return (sizeInMega.toFixed ? sizeInMega.toFixed(2) : sizeInMega) + 'M';
  }

  function fillStorageSummaryInfo(elemId, info) {
    var elem = $id(elemId);
    var total = info.usedInBytes + info.freeInBytes;
    if (total > 0) {
      var usedInP = Math.floor(info.usedInBytes / total * 100) + '%';
      $expr('.storage-number', elem)[0].textContent =
      formatStorage(info.usedInBytes) + '/' + formatStorage(total) + ' ' + usedInP;
      $expr('.storage-graph .used', elem)[0].style.width = usedInP;
      if (elemId == 'sdcard-storage-summary') {
        var subInP = Math.floor(info.picture / info.usedInBytes * 100);
        if (subInP == 0) {
          subInP = 1;
        }
        $expr('.storage-used', elem)[0].style.width = subInP + '%';
        subInP = Math.floor(info.music / info.usedInBytes * 100);
        if (subInP == 0) {
          subInP = 1;
        }
        $expr('.storage-used', elem)[1].style.width = subInP + '%';
        subInP = Math.floor(info.video / info.usedInBytes * 100);
        if (subInP == 0) {
          subInP = 1;
        }
        $expr('.storage-used', elem)[2].style.width = subInP + '%';
        subInP = Math.floor((info.usedInBytes - info.music - info.picture - info.video) / info.usedInBytes * 100);
        if (subInP == 0) {
          subInP = 1;
        }
        $expr('.storage-used', elem)[3].style.width = subInP + '%';
      }
    } else {
      $expr('.storage-number', elem)[0].textContent = formatStorage(info.usedInBytes) + '/' + formatStorage(total);
      $expr('.storage-graph .used', elem)[0].style.width = 0 + '%';
      if (elemId == 'sdcard-storage-summary') {
        $expr('.storage-used', elem)[0].style.width = 0 + '%';
        $expr('.storage-used', elem)[1].style.width = 0 + '%';
        $expr('.storage-used', elem)[2].style.width = 0 + '%';
        $expr('.storage-used', elem)[3].style.width = 0 + '%';
      }
    }
  }

  function getAndShowStorageInfo() {
    var loadingGroupId = animationLoading.start();
    CMD.Device.getStorage(function onresponse_getDeviceInfo(message) {
      var deviceInfo = {
        usedInBytes: 0,
        freeInBytes: 0
      };
      var sdcardInfo = {
        usedInBytes: 0,
        freeInBytes: 0,
        picture: 0,
        music: 0,
        video: 0
      };

      var dataJSON = JSON.parse(message.data);
      for (var i = 0; i < dataJSON.length; i++) {
        if (dataJSON[i].storageName == 'apps') {
          deviceInfo.usedInBytes = dataJSON[i].usedSpace;
          deviceInfo.freeInBytes = dataJSON[i].freeSpace;
        } else if (dataJSON[i].storageName == 'sdcard') {
          sdcardInfo.usedInBytes = dataJSON[i].usedSpace;
          sdcardInfo.freeInBytes = dataJSON[i].freeSpace;
        } else if (dataJSON[i].storageName == 'pictures') {
          sdcardInfo.picture = dataJSON[i].usedSpace;
        } else if (dataJSON[i].storageName == 'music') {
          sdcardInfo.music = dataJSON[i].usedSpace;
        } else if (dataJSON[i].storageName == 'videos') {
          sdcardInfo.video = dataJSON[i].usedSpace;
        }
      }
      fillStorageSummaryInfo('device-storage-summary', deviceInfo);
      fillStorageSummaryInfo('sdcard-storage-summary', sdcardInfo);
      animationLoading.stop(loadingGroupId);
    }, function onerror_getStorage(message) {
      animationLoading.stop(loadingGroupId);
      console.log('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });
  }

  function getAndShowSummaryInfo() {
    var loadingGroupId = animationLoading.start();
    getAndShowStorageInfo();
    CMD.Device.getSettings(function onresponse_getDeviceInfo(message) {
      var dataJSON = JSON.parse(message.data);
      var elem = $id('device-storage-summary');
      $expr('.device-os-version-number', elem)[0].textContent = dataJSON["deviceinfo.os"];
      $expr('.device-hardware-revision-number', elem)[0].textContent = dataJSON["deviceinfo.hardware"];
      $expr('.device-platform-version-number', elem)[0].textContent = dataJSON["deviceinfo.platform_version"];
      $expr('.device-build-identifier-number', elem)[0].textContent = dataJSON["deviceinfo.platform_build_id"];
      animationLoading.stop(loadingGroupId);
    }, function onerror_getSettings(message) {
      animationLoading.stop(loadingGroupId);
      console.log('Error occurs when fetching device infos, see: ' + JSON.stringify(message));
    });
  }
  /**
   * Show the contact view, and start fetching the contacts data from device.
   */

  function showContactView() {
    ViewManager.showContent('contact-view');
  }

  function getAndShowAllContacts(viewData) {
    var loadingGroupId = animationLoading.start();
    ViewManager.showViews('contact-quick-add-view');
    CMD.Contacts.getAllContacts(function onresponse_getAllContacts(message) {
      // Make sure the 'select-all' box is not checked.
      ContactList.selectAllContacts(false);
      var dataJSON = JSON.parse(message.data);
      ContactList.init(dataJSON, viewData);
      animationLoading.stop(loadingGroupId);
    }, function onerror_getAllContacts(message) {
      animationLoading.stop(loadingGroupId);
      log('getAndShowAllContacts Error occurs when fetching all contacts.');
    });
  }

  function getAndShowAllSMSThreads() {
    updateSMSThreads();
  }

  function updateSMSThreads() {
    var loadingGroupId = animationLoading.start();
    CMD.SMS.getThreads(function onresponse_getThreads(messages) {
      // Make sure the 'select-all' box is not checked.  
      SmsList.selectAllSms(false);
      var dataJSON = JSON.parse(messages.data);
      SmsList.init(dataJSON);
      animationLoading.stop(loadingGroupId);
    }, function onerror_getThreads(messages) {
      animationLoading.stop(loadingGroupId);
      log('Error occurs when fetching all messages' + messages.message);
    });
  }

  function getAndShowAllMusics() {
    var loadingGroupId = animationLoading.start();
    MusicList.init();
    CMD.Musics.getOldMusicsInfo(function onresponse_getOldMusicsInfo(oldMusic) {
      var music = JSON.parse(oldMusic.data);
      if (music.callbackID == 'enumerate') {
        MusicList.addMusic(music.detail);
        return;
      }
      if (music.callbackID == 'enumerate-done') {
        CMD.Musics.getChangedMusicsInfo(function onresponse_getChangedMusics(changedMusicInfo) {
          var changedMusic = JSON.parse(changedMusicInfo.data);
          if (changedMusic.callbackID == 'oncreated') {
            MusicList.addMusic(changedMusic.detail);
            return;
          }
          if (changedMusic.callbackID == 'ondeleted') {
            MusicList.removeMusic(changedMusic.detail);
            return;
          }
          if (changedMusic.callbackID == 'onscanend') {
            // Make sure the 'select-all' box is not checked.
            MusicList.selectAllMusics(false);
            MusicList.updateUI();
            animationLoading.stop(loadingGroupId);
            return;
          }
        }, function onerror_getChangedMusics(e) {
          animationLoading.stop(loadingGroupId);
          log('Error occurs when fetching changed musics.');
        })
      }
    }, function onerror_getOldMusicsInfo(e) {
      animationLoading.stop(loadingGroupId);
      log('Error occurs when fetching all musics.');
    });
  }

  function getAndShowGallery() {
    var loadingGroupId = animationLoading.start();
    Gallery.init();
    CMD.Pictures.getOldPicturesInfo(function onresponse_getOldMusicsInfo(oldPicture) {
      var picture = JSON.parse(oldPicture.data);
      if (picture.callbackID == 'enumerate') {
        Gallery.addPicture(picture.detail);
        return;
      }
      if (picture.callbackID == 'enumerate-done') {
        CMD.Pictures.getChangedPicturesInfo(function onresponse_getChangedPictures(changedPictureInfo) {
          var changedPicture = JSON.parse(changedPictureInfo.data);
          if (changedPicture.callbackID == 'oncreated') {
            Gallery.addPicture(changedPicture.detail);
            return;
          }
          if (changedPicture.callbackID == 'ondeleted') {
            Gallery.updateRemovedPictures(changedPicture.detail);
            return;
          }
          if (changedPicture.callbackID == 'onscanend') {
            Gallery.selectAllPictures(false);
            Gallery.checkGalleryIsEmpty();
            animationLoading.stop(loadingGroupId);
            return;
          }
        }, function onerror_getChangedPictures(e) {
          animationLoading.stop(loadingGroupId);
          log('Error occurs when fetching changed pictures.');
        });
        return;
      }
    }, function onerror_getOldMusicsInfo(e) {
      animationLoading.stop(loadingGroupId);
      log('Error occurs when fetching old pictures.');
    });
  }

  function getAndShowAllVideos() {
    var loadingGroupId = animationLoading.start();
    Video.init();
    CMD.Videos.getOldVideosInfo(function onresponse_getOldVideosInfo(oldVideo) {
      var video = JSON.parse(oldVideo.data);
      if (video.callbackID == 'enumerate') {
        Video.addVideo(video.detail);
        return;
      }
      if (video.callbackID == 'enumerate-done') {
        CMD.Videos.getChangedVideosInfo(function onresponse_getChangedVideos(changedVideoInfo) {
          var changedVideo = JSON.parse(changedVideoInfo.data);
          if (changedVideo.callbackID == 'oncreated') {
            Video.addVideo(changedVideo.detail);
            return;
          }
          if (changedVideo.callbackID == 'ondeleted') {
            Video.updateRemovedVideos(changedVideo.detail);
            return;
          }
          if (changedVideo.callbackID == 'onscanend') {
            // Make sure the 'select-all' box is not checked.
            Video.selectAllVideos(false);
            Video.checkVideoListIsEmpty();
            animationLoading.stop(loadingGroupId);
            return;
          }
        }, function onerror_getChangedVideo(e) {
          animationLoading.stop(loadingGroupId);
          log('Error occurs when fetching changed videos.');
        });
      }
    }, function onerror_getOldVideosInfo(e) {
      animationLoading.stop(loadingGroupId);
      log('Error occurs when fetching old videos.');
    });
  }

  function connectToDevice(serverIP) {
    var timeout = null;

    if (connPool) {
      connPool.finalize();
      connPool = null;
    }

    connPool = new TCPConnectionPool({
      host: serverIP,
      size: 2,
      onenable: function onenable() {
        // FIXME, still not finish binding data listening event in server socket, displaying info. delay 
        timeout = window.setTimeout(function imedb_cacheTimeout() {
          showSummaryView(serverIP);
        }, 1000);
      },
      ondisable: function ondisable() {
        log('USB Socket is closed');
        window.clearTimeout(timeout);
        showConnectView();
        socket = null;
        ViewManager.reset();
      }
    });
  }

  function init() {
    $id('lang-settings').addEventListener('click', function onclick_langsetting(event) {
      if (!event.target.classList.contains('language-code-button')) {
        return;
      }
      navigator.mozL10n.language.code = event.target.dataset.languageCode;
      $expr('.language-code-button', this).forEach(function(elem) {
        elem.classList.remove('current');
      });
      event.target.classList.add('current');
    });
    if (!animationLoading) {
      animationLoading = new animationLoadingDialog();
    }
    showConnectView();
    if (navigator.mozFFOSAssistant) {
      navigator.mozFFOSAssistant.onadbstatechange = function onADBStateChange(event) {
        if (navigator.mozFFOSAssistant.adbConnected === true) {
          var devicename = navigator.mozFFOSAssistant.adbffosDeviceName;
          var elem = $id('mgmt-list');
          $expr('.header', elem)[0].textContent = devicename;
          connectToDevice('localhost');
        }
      };

      if (navigator.mozFFOSAssistant.adbConnected === true) {
        var devicename = navigator.mozFFOSAssistant.adbffosDeviceName;
        var elem = $id('mgmt-list');
        $expr('.header', elem)[0].textContent = devicename;
        connectToDevice('localhost');
      }
    }

    // Register view event callbacks
    ViewManager.addViewEventListener('summary-view', 'firstshow', getAndShowSummaryInfo);
    ViewManager.addViewEventListener('summary-view', 'othershow', getAndShowStorageInfo);
    ViewManager.addViewEventListener('contact-view', 'firstshow', getAndShowAllContacts);
    ViewManager.addViewEventListener('contact-view', 'othershow', getAndShowAllContacts);
    ViewManager.addViewEventListener('sms-view', 'firstshow', getAndShowAllSMSThreads);
    ViewManager.addViewEventListener('sms-view', 'othershow', updateSMSThreads);
    ViewManager.addViewEventListener('music-view', 'firstshow', getAndShowAllMusics);
    ViewManager.addViewEventListener('gallery-view', 'firstshow', getAndShowGallery);
    ViewManager.addViewEventListener('video-view', 'firstshow', getAndShowAllVideos);
  }

  window.addEventListener('load', function window_onload(event) {
    window.removeEventListener('load', window_onload);
    init();
  });

  window.addEventListener('localized', function showBody() {
    document.documentElement.lang = navigator.mozL10n.language.code;
    document.documentElement.dir = navigator.mozL10n.language.direction;
    document.body.hidden = false;

    $expr('#lang-settings .language-code-button').forEach(function(label) {
      if (label.dataset.languageCode == navigator.mozL10n.language.code) {
        label.classList.add('current');
      } else {
        label.classList.remove('current');
      }
    });
  });

  return {
    sendRequest: function(obj) {
      if (connPool) {
        connPool.send(obj);
      }
    },

    sendListenRequest: function(obj) {
      if (connListenSocket) {
        obj.cmd = extend({
          cmd: null,
          data: null,
          datalength: 0,
          json: false // Indicates if the reulst is an JSON string
        }, obj.cmd);
        obj.cmd.id = 1;
        connListenSocket.send(obj.cmd, obj.cmd.data);
      }
    },

    getAndShowAllContacts: getAndShowAllContacts,
    getAndShowAllSMSThreads: getAndShowAllSMSThreads,
    getAndShowAllVideos: getAndShowAllVideos,
    getAndShowAllMusics: getAndShowAllMusics,
    getAndShowGallery: getAndShowGallery,
    updateSMSThreads: updateSMSThreads
  };
})();
