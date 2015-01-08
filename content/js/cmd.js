/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var CMD = (function() {
  var commandId = 0;
/*
   * Return function with three parameters:
   *  - data
   *    the data object will be sent
   *  - onresponse
   *    the callback function when response is back
   *  - onerror
   *    the callback function when error occurs
   */

  function createCommand(target, command, dataString, dataArray) {
    return {
      cmd: {
        title: {
          id: commandId++,
          type: target,
          command: command,
          result: RS_OK,
          datalength: 0,
          subdatalength: 0
        },
        dataString: dataString,
        dataArray: dataArray
      }
    };
  }

/*
   * All the available commands grouped by targets.
   */
  return { /***** Device commands *****/
    Device: {
      /**
       * get the summary info of the device
       */
      getVersion: function() {
        return createCommand(CMD_TYPE.deviceInfo, DEVICEINFO_COMMAND.getVersion)
      },
      getStorage: function() {
        return createCommand(CMD_TYPE.deviceInfo, DEVICEINFO_COMMAND.getStorage);
      },
      getStorageFree: function() {
        return createCommand(CMD_TYPE.deviceInfo, DEVICEINFO_COMMAND.getStorageFree);
      }
    },

    /***** Contacts commands *****/
    Contacts: {
      getAllContacts: function() {
        return createCommand(CMD_TYPE.contact, CONTACT_COMMAND.getAllContacts);
      },

      /*
       * data:
       *   contact object
       */
      updateContact: function(strData, arrayData) {
        return createCommand(CMD_TYPE.contact, CONTACT_COMMAND.updateContactById, strData, arrayData);
      },

      /*
       * data:
       *   contact array
       */
      addContact: function(strData, arrayData) {
        return createCommand(CMD_TYPE.contact, CONTACT_COMMAND.addContact, strData, arrayData);
      },

      /*
       * data:
       *   contact id array
       */
      removeContact: function(dataStr, dataArray) {
        return createCommand(CMD_TYPE.contact, CONTACT_COMMAND.removeContactById, dataStr, dataArray);
      },

      /*
       * data:
       *   contact id
       */
      getContactById: function(dataStr, dataArray) {
        return createCommand(CMD_TYPE.contact, CONTACT_COMMAND.getContactById, dataStr, dataArray);
      }
    },

    /***** Picture commands ******/
    Pictures: {
      getOldPicturesInfo: function() {
        return createCommand(CMD_TYPE.picture, PICTURE_COMMAND.getOldPicturesInfo);
      },
      getChangedPicturesInfo: function() {
        return createCommand(CMD_TYPE.picture, PICTURE_COMMAND.getChangedPicturesInfo);
      },
      deletePicture: function(dataStr, dataArray) {
        return createCommand(CMD_TYPE.picture, PICTURE_COMMAND.deletePicture, dataStr, dataArray);
      }
    },

    /***** Videos commands ******/
    Videos: {
      getOldVideosInfo: function() {
        return createCommand(CMD_TYPE.video, VIDEO_COMMAND.getOldVideosInfo);
      },
      getChangedVideosInfo: function() {
        return createCommand(CMD_TYPE.video, VIDEO_COMMAND.getChangedVideosInfo);
      },
      deleteVideo: function(dataStr, dataArray) {
        return createCommand(CMD_TYPE.video, VIDEO_COMMAND.deleteVideo, dataStr, dataArray);
      }
    },

    /***** Musics commands ******/
    Musics: {
      getOldMusicsInfo: function() {
        return createCommand(CMD_TYPE.music, MUSIC_COMMAND.getOldMusicsInfo);
      },
      getChangedMusicsInfo: function() {
        return createCommand(CMD_TYPE.music, MUSIC_COMMAND.getChangedMusicsInfo);
      },
      deleteMusic: function(dataStr, dataArray) {
        return createCommand(CMD_TYPE.music, MUSIC_COMMAND.deleteMusic, dataStr, dataArray);
      }
    },

    /***** Files commands ******/
    Files: {
      filePull: function(dataStr, dataArray) {
        return createCommand(CMD_TYPE.file, FILE_COMMAND.filePull, dataStr, dataArray);
      },
      filePush: function(dataStr, dataArray) {
        return createCommand(CMD_TYPE.file, FILE_COMMAND.filePush, dataStr, dataArray);
      }
    }
  };
})();
