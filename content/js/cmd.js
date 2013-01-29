/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var CMD = (function() {
  /* Wifi cmds */
  var CMD_MANAGE_DEVICE    = 'manageDevice';

  var CMD_DEVICE_GETINFO   = 'getdeviceinfo';

  /* Contacts cmds */
  var CMD_CONTACT_GET_ALL  = 'getAllContacts';
  var CMD_CONTACT_UPDATE   = 'updateContacts';
  var CMD_CONTACT_ADD      = 'addContacts';
  var CMD_CONTACT_REMOVE   = 'removeContacts';

  var CMD_SMS_GETMESSAGES  = 'getMessages';
  var CMD_SMS_SENTMESSAGE  = 'sendsms';
  var CMD_SMS_MARK_READ    = 'markMessagesRead';
  var CMD_SMS_DELETE       = 'deletesms';

  var CMD_PIC_GETALLINFO   = 'getAllPicsInfo';
  var CMD_PIC_GETCONTENT   = 'getPics';
  var CMD_PIC_DELETE       = 'deletePics';
  var CMD_PIC_ADD          = 'addPics';
  var CMD_PIC_RENAME       = 'renamePic';

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
        target: target,
        command: command,
        data: data
      }, onresponse, onerror);
    };
  }

  /**
   * Return function only with onresponse and onerror callbacks
   */
  function createCommandWithNonData(target, command) {
    return function(onresponse, onerror) {
      FFOSAssistant.sendRequest({
        target: target,
        command: command,
        data: null
      }, onresponse, onerror);
    };
  }

  /**
   * All the available commands grouped by target.
   */
  return {
    manageDevice:      createCommand('init', CMD_MANAGE_DEVICE),

    Device: {
      /**
       * get the summary info of the device
       */
      getDeviceInfo:   createCommandWithNonData('device', CMD_DEVICE_GETINFO),
    },

    /***** Contacts commands *****/
    Contacts: {
      getAllContacts:  createCommandWithNonData('contact', CMD_CONTACT_GET_ALL),
      /**
       * data:
       *   contact array
       */
      updateContacts:  createCommand('contact', CMD_CONTACT_UPDATE),
      /**
       * data:
       *   contact array
       */
      addContacts:     createCommand('contact', CMD_CONTACT_ADD),
      /**
       * data:
       *   contact id array
       */
      removeContacts:  createCommand('contact', CMD_CONTACT_REMOVE),
    },

    /***** Picture commands ******/
    Pictures: {
      getAllPicsInfo:  createCommandWithNonData('pictures', CMD_PIC_GETALLINFO),
      /**
       * data:
       *   [fileName1, fileName2]
       */
      getPicsContent:  createCommand('pictures', CMD_PIC_GETCONTENT),
      /**
       * data:
       *   [fileName1, fileName2]
       */
      deletePics:      createCommand('pictures', CMD_PIC_DELETE),
      /**
       * data:
       *   [{
       *     fileName1: content
       *   }, {
       *     fileName2: content
       *   }]
       */
      addPics:         createCommand('pictures'. CMD_PIC_ADD),
      /**
       * data:
       *   [oldName, newName]
       */
      renamePic:       createCommand('pictures'. CMD_PIC_RENAME),
    },

    /***** SMS commands *****/
    SMS: {
      /**
       * data:
       *   SMS Filter
       */
      getMessages:    createCommand('sms', CMD_SMS_GETMESSAGES),
      /**
       * data:
       *   {
       *     id: ['10086', '10010'],
       *     message: 'Here is the message content'
       *   }
       */
      sendMessage:     createCommand('sms', CMD_SMS_SENTMESSAGE),
      /**
       * data:
       *   {
       *     id: [id1, id2],
       *     readbool: true   // or false
       *   }
       */
      markMessageRead: createCommand('sms', CMD_SMS_MARK_READ),
      /**
       * data:
       *   [id1, id2]
       */
      deleteMessages:  createCommand('sms', CMD_SMS_DELETE)
    }
  };
})();

