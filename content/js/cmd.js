/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var CMD = (function() {
  /* Wifi cmds */
  var CMD_MANAGE_DEVICE    = 'manageDevice';

  /* Contacts cmds */
  var CMD_GET_ALL_CONTACTS = 'getAllContacts';
  var CMD_UPDATE_CONTACTS  = 'updateContacts';
  var CMD_ADD_CONTACTS     = 'addContacts';
  var CMD_REMOVE_CONTACTS  = 'removeContacts';

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

  return {
    manageDevice:   createCommand('init', CMD_MANAGE_DEVICE),

    /***** Contacts commands *****/
    getAllContacts: createCommandWithNonData('contact', CMD_GET_ALL_CONTACTS),
    /**
     * data:
     *   contact array
     */
    updateContacts: createCommand('contact', CMD_UPDATE_CONTACTS),
    /**
     * data:
     *   contact array
     */
    addContacts:    createCommand('contact', CMD_ADD_CONTACTS),
    /**
     * data:
     *   contact id array
     */
    removeContacts: createCommand('contact', CMD_REMOVE_CONTACTS)
  };
})();

