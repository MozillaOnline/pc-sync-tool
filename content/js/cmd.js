/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var CMD = (function() {
  /**
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
          firstData: data,
          firstDatalength: data.length,
          secondData: null,
          secondDatalength: 0
        },
        onresponse: onresponse,
        onerror: onerror
      });
    };
  }
  /**
   * Return function only with onresponse and onerror callbacks
   */
  function createCommandWithNonData(target, command) {
    return function(onresponse, onerror) {
      FFOSAssistant.sendRequest({
        cmd: {
          type: target,
          command: command,
          result: 0,
          firstData: null,
          firstDatalength: 0,
          secondData: null,
          secondDatalength: 0
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
          firstData: null,
          firstDatalength: 0,
          secondData: null,
          secondDatalength: 0
        },
        onresponse: onresponse,
        onerror: onerror
      });
    };
  }
  /**
   * All the available commands grouped by target.
   */
  return {
    Device: {
      /**
       * get the summary info of the device
       */
      getStorage:   createCommandWithNonData(CMD_TYPE.deviceInfo, DEVICEINFO_COMMAND.getStorage),
      getSettings:   createCommandWithNonData(CMD_TYPE.deviceInfo, DEVICEINFO_COMMAND.getSettings),
    },
    /***** Contacts commands *****/
    Contacts: {
      getAllContacts:  createCommandWithNonData(CMD_TYPE.contact, CONTACT_COMMAND.getAllContacts),
      /**
       * data:
       *   contact ID
       * */
      getContactProfilePic:  createCommand(CMD_TYPE.contact, CONTACT_COMMAND.getContactPicById),
      /**
       * data:
       *   contact object
       */
      updateContact:  createCommand(CMD_TYPE.contact, CONTACT_COMMAND.updateContactById),
      /**
       * data:
       *   contact array
       */
      addContact:     createCommand(CMD_TYPE.contact, CONTACT_COMMAND.addContact),
      /**
       * data:
       *   contact id array
       */
      removeContact:  createCommand(CMD_TYPE.contact, CONTACT_COMMAND.removeContactById),

      clearAllContacts:  createCommandWithNonData(CMD_TYPE.contact, CONTACT_COMMAND.clearAllContacts),
      getContactByPhoneNumber:  createCommand(CMD_TYPE.contact, CONTACT_COMMAND.getContactByPhoneNumber),
      getContactById:  createCommand(CMD_TYPE.contact, CONTACT_COMMAND.getContactById)
    },

    /***** Picture commands ******/
    Pictures: {
      getAllPicsInfo:  createCommandWithNonData(CMD_TYPE.picture, PICTURE_COMMAND.getAllPicsInfo),
      /**
       * data:
       *   [fileName1, fileName2]
       */
      // getPicsContent:  createCommand(CMD_TYPE.picture, PICTURE_COMMAND.getPicsContent),
      /**
       * data:
       *   [fileName1, fileName2]
       */
      deletePictureByPath:      createCommand(CMD_TYPE.picture, PICTURE_COMMAND.deletePictureByPath),
      /**
       * data:
       *   [{
       *     fileName1: content
       *   }, {
       *     fileName2: content
       *   }]
       */
      // addPics:         createCommand(CMD_TYPE.picture, CMD_PIC_ADD),
      /**
       * data:
       *   [oldName, newName]
       */
      //renamePic:       createCommand(CMD_TYPE.picture, CMD_PIC_RENAME),
    },
    /***** Videos commands ******/
    Videos: {
      getAllVideosInfo:  createCommandWithNonData(CMD_TYPE.video, VIDEO_COMMAND.getAllVideosInfo),
      /**
       * data:
       *   [fileName1, fileName2]
       */
      // getVideosContent:  createCommand(CMD_TYPE.video, CMD_VIDEO_GETCONTENT),
      /**
       * data:
       *   [fileName1, fileName2]
       */
      deleteVideoByPath:      createCommand(CMD_TYPE.video, VIDEO_COMMAND.deleteVideoByPath),
      /**
       * data:
       *   [{
       *     fileName1: content
       *   }, {
       *     fileName2: content
       *   }]
       */
      // addVideos:         createCommand(CMD_TYPE.video, CMD_VIDEO_ADD),
      /**
       * data:
       *   [oldName, newName]
       */
      // renameVideo:       createCommand(CMD_TYPE.video, CMD_VIDEO_RENAME),
    },

    /***** musics commands ******/
    Musics: {
      getAllMusicsInfo:  createCommandWithNonData(CMD_TYPE.music, MUSIC_COMMAND.getAllMusicsInfo),
      /**
       * data:
       *   [fileName1, fileName2]
       */
      //initMusic:  createCommandWithNonData(CMD_TYPE.music, MUSIC_COMMAND.initMusic),
      /**
       * data:
       *   [fileName1, fileName2]
       */
      //deleteMusics:      createCommand(CMD_TYPE.music, CMD_MUSIC_DELETE),
      /**
       * data:
       *   [{
       *     fileName1: content
       *   }, {
       *     fileName2: content
       *   }]
       */
      // addMusics:         createCommand(CMD_TYPE.music, CMD_MUSIC_ADD),
      /**
       * data:
       *   [oldName, newName]
       */
      //renameMusic:       createCommand(CMD_TYPE.music, CMD_MUSIC_RENAME),
    },

   /***** SMS commands *****/
    SMS: {
      getAllMessages:  createCommandWithNonData(CMD_TYPE.sms, SMS_COMMAND.getAllMessages),
      /**
       * data:
       *   SMS Filter
       */
      getMessageById:  createCommand(CMD_TYPE.sms, SMS_COMMAND.getMessageById),

      /**
       * data:
       *   string like: "number: '10086', message: 'Here is the message content'"
       *   }
       */
      sendMessage:     createCommand(CMD_TYPE.sms, SMS_COMMAND.sendMessage),

      /**
       * data:
       *   string like: "number: ['10086','13584651421'], message: 'Here is the message content'"
       *   }
       */
      sendMessages:     createCommand(CMD_TYPE.sms, SMS_COMMAND.sendMessages),
      /**
       * data:
       *   [id1, id2]
       */
      deleteMessageById:  createCommand(CMD_TYPE.sms, SMS_COMMAND.deleteMessageById),
      markReadMessageById:  createCommand(CMD_TYPE.sms, SMS_COMMAND.markReadMessageById),
      getThreads:  createCommandWithNonData(CMD_TYPE.sms, SMS_COMMAND.getThreads),
      getThreadMessagesById:  createCommand(CMD_TYPE.sms, SMS_COMMAND.getThreadMessagesById)
    },
    //listen command
    Listen: {
      listenMessage:  createListenCommand(CMD_TYPE.listen, LISTEN_COMMAND.listen)
    }
  };
})();

