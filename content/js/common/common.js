var TITLE_SIZE = 12;
//CMD_TYPE from 0 to 50
var CMD_TYPE = {
  app_connected: 0,
  app_disconnect: 1,
  app_accepted: 2,
  app_rejected: 3,
  contact_add: 4,
  contact_getAll: 5,
  contact_getById: 6,
  contact_removeById: 7,
  contact_updateById: 8,
  device_getVersion: 9,
  device_getstorageInfo: 10,
  device_getstorageFree: 11,
  music_getOld: 12,
  music_getChanged: 13,
  music_delete: 14,
  picture_getOld: 15,
  picture_getChanged: 16,
  picture_delete: 17,
  video_getOld: 18,
  video_getChanged: 19,
  video_delete: 20,
  file_pull: 21,
  file_push: 22,
};
//CMD_TYPE from 50 to 100
var CMD_ID = {
  app_connected: 50,
  app_disconnect: 51,
  app_accepted: 52,
  app_rejected: 53,
  app_error: 54,
  listen_contact_create: 55,
  listen_contact_update: 56,
  listen_contact_delete: 57,
  listen_picture_create: 58,
  listen_picture_delete: 59,
  listen_music_create: 60,
  listen_music_delete: 61,
  listen_video_create: 62,
  listen_video_delete: 63,
};

var RS_OK = 0;

var RS_ERROR = {
  UNKNOWEN: 1,
  TYPE_UNDEFINED: 2,
  COMMAND_UNDEFINED: 3,
  DEVICEINFO_GETSTORAGE: 4,
  CONTACT_ADDCONTACT: 5,
  CONTACT_CONTACT_NOTFOUND: 6,
  CONTACT_CLEARALLCONTACTS: 7,
  CONTACT_GETALLCONTACTS: 8,
  CONTACT_GETCONTACT: 9,
  CONTACT_NOCONTACTPIC: 10,
  CONTACT_GETCONTACTPIC: 11,
  CONTACT_REMOVECONTACT: 12,
  CONTACT_SAVECONTACT: 13,
  APPSMANAGER_GETINSTALLEDAPPS: 14,
  APPSMANAGER_GETALLAPPS: 15,
  APPSMANAGER_UNSTALLAPP: 16,
  APPSMANAGER_NOTFOUNDAPP: 17,
  DEVICESTORAGE_UNAVAILABLE: 18,
  MUSIC_INIT: 19,
  MUSIC_RENAME: 20,
  PICTURE_INIT: 21,
  PICTURE_RENAME: 22,
  VIDEO_INIT: 23,
  VIDEO_RENAME: 24,
  MEDIADB_ADDFILE: 25,
  FILE_CREATE: 26,
  FILE_GET: 27,
  FILE_WRITE: 28,
  OPEN_DB: 29,
  FILE_ADD: 30,
  FILE_NOTEXIT: 31
};

function dataUri2Blob(dataURI) {
  var byteString = atob(dataURI.split(',')[1]);
  var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
  var array = [];
  for (var i = 0; i < byteString.length; i++) {
    array.push(byteString.charCodeAt(i));
  }
  return new Blob([new Uint8Array(array)], {
    type: mimeString
  });
}

function titleArray2Json(dataArray) {
  if (dataArray.length >= TITLE_SIZE) {
    var dataBuffer = new ArrayBuffer(TITLE_SIZE);
    var titleArray = new Uint8Array(dataBuffer);
    var int32Array = new Int32Array(dataBuffer);
    for (var i = 0; i < titleArray.length; i++) {
      titleArray[i] = dataArray[i];
    }
    var dataJson = {
      id: int32Array[0],
      flag: int32Array[1],
      datalength: int32Array[2]
    };
    return dataJson;
  } else {
    return null;
  }
}

function json2TitleArray(dataJson) {
  var dataArray = new ArrayBuffer(TITLE_SIZE);
  var int8Array = new Uint8Array(dataArray);
  var int32Array = new Int32Array(dataArray);
  if (isNaN(dataJson.id) ||
      isNaN(dataJson.flag) ||
      isNaN(dataJson.datalength)) {
    return null;
  }
  int32Array[0] = dataJson.id;
  int32Array[1] = dataJson.flag;
  int32Array[2] = dataJson.datalength;
  return int8Array;
}

function array2Int(dataArray) {
  if (dataArray.length >= 4) {
    var dataBuffer = new ArrayBuffer(4);
    var titleArray = new Uint8Array(dataBuffer);
    var int32Array = new Int32Array(dataBuffer);
    for (var i = 0; i < titleArray.length; i++) {
      titleArray[i] = dataArray[i];
    }
    return int32Array[0];
  } else {
    return null;
  }
}

function int2Array(dataInt) {
  var dataArray = new ArrayBuffer(4);
  var int8Array = new Uint8Array(dataArray);
  var int32Array = new Int32Array(dataArray);
  if (isNaN(dataInt)) {
    return null;
  }
  int32Array[0] = dataInt;
  return int8Array;
}

function string2Array(dataString) {
  return new TextEncoder('utf-8').encode(dataString);
}

function array2String(dataArray) {
  return new TextDecoder('utf-8').decode(dataArray);
}

function arraycat(array1, array2) {
  var array1Length = array1.byteLength !== undefined ? array1.byteLength : array1.length;
  var array2Length = array2.byteLength !== undefined ? array2.byteLength : array2.length;
  var uint8Array = new Uint8Array(array1Length + array2Length);
  uint8Array.set(array1, 0);
  uint8Array.set(array2, array1Length);
  return uint8Array;
}
