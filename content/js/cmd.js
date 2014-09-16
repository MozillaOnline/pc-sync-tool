/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var CMD = (function() {
/*
   * Return function with three parameters:
   *  - data
   *    the data object will be sent
   *  - onresponse
   *    the callback function when response is back
   *  - onerror
   *    the callback function when error occurs
   */

  function createCommand(target, command) {
    return function(data, onresponse, onerror) {
      FFOSAssistant.sendRequest({
        cmd: {
          type: target,
          command: command,
          result: 0,
          data: data,
          datalength: data.length
        },
        onresponse: onresponse,
        onerror: onerror
      });
    };
  }

/*
   * Return function only with onresponse and onerror callbacks
   */

  function createCommandWithNonData(target, command) {
    return function(onresponse, onerror) {
      FFOSAssistant.sendRequest({
        cmd: {
          type: target,
          command: command,
          result: 0,
          data: null,
          datalength: 0
        },
        onresponse: onresponse,
        onerror: onerror
      });
    };
  }

  function createListenCommand(target, command) {
    return function(onresponse, onerror) {
      FFOSAssistant.sendListenRequest({
        cmd: {
          type: target,
          command: command,
          result: 0,
          data: null,
          datalength: 0
        },
        onresponse: onresponse,
        onerror: onerror
      });
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
      getVersion: createCommandWithNonData(CMD_TYPE.deviceInfo, DEVICEINFO_COMMAND.getVersion),
      getStorage: createCommandWithNonData(CMD_TYPE.deviceInfo, DEVICEINFO_COMMAND.getStorage),
      getSettings: createCommandWithNonData(CMD_TYPE.deviceInfo, DEVICEINFO_COMMAND.getSettings),
    },

    /***** Contacts commands *****/
    Contacts: {
      getAllContacts: createCommandWithNonData(CMD_TYPE.contact, CONTACT_COMMAND.getAllContacts),

/*
       * data:
       *   contact ID
       * */
      getContactProfilePic: createCommand(CMD_TYPE.contact, CONTACT_COMMAND.getContactPicById),

/*
       * data:
       *   contact object
       */
      updateContact: createCommand(CMD_TYPE.contact, CONTACT_COMMAND.updateContactById),

/*
       * data:
       *   contact array
       */
      addContact: createCommand(CMD_TYPE.contact, CONTACT_COMMAND.addContact),

/*
       * data:
       *   contact id array
       */
      removeContact: createCommand(CMD_TYPE.contact, CONTACT_COMMAND.removeContactById),

      clearAllContacts: createCommandWithNonData(CMD_TYPE.contact, CONTACT_COMMAND.clearAllContacts),

/*
       * data:
       *   phone number
       */
      getContactByPhoneNumber: createCommand(CMD_TYPE.contact, CONTACT_COMMAND.getContactByPhoneNumber),

/*
       * data:
       *   contact id
       */
      getContactById: createCommand(CMD_TYPE.contact, CONTACT_COMMAND.getContactById)
    },

    /***** Picture commands ******/
    Pictures: {
      getOldPicturesInfo: createCommandWithNonData(CMD_TYPE.picture, PICTURE_COMMAND.getOldPicturesInfo),
      getChangedPicturesInfo: createCommandWithNonData(CMD_TYPE.picture, PICTURE_COMMAND.getChangedPicturesInfo),
      deletePicture: createCommand(CMD_TYPE.picture, PICTURE_COMMAND.deletePicture)
    },

    /***** Videos commands ******/
    Videos: {
      getOldVideosInfo: createCommandWithNonData(CMD_TYPE.video, VIDEO_COMMAND.getOldVideosInfo),
      getChangedVideosInfo: createCommandWithNonData(CMD_TYPE.video, VIDEO_COMMAND.getChangedVideosInfo),
      deleteVideo: createCommand(CMD_TYPE.video, VIDEO_COMMAND.deleteVideo)
    },

    /***** Musics commands ******/
    Musics: {
      getOldMusicsInfo: createCommandWithNonData(CMD_TYPE.music, MUSIC_COMMAND.getOldMusicsInfo),
      getChangedMusicsInfo: createCommandWithNonData(CMD_TYPE.music, MUSIC_COMMAND.getChangedMusicsInfo),
      deleteMusic: createCommand(CMD_TYPE.music, MUSIC_COMMAND.deleteMusic)
    },

    /***** Listen command *****/
    Listen: {
      listenMessage: createListenCommand(CMD_TYPE.listen, LISTEN_COMMAND.listen)
    }
  };
})();