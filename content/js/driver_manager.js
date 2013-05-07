/* This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var DriverManager = (function() {
  var client = null;

  function connectToDriverManager() {
    if (navigator.mozFFOSAssistant.isDriverManagerRunning &&
        navigator.mozFFOSAssistant.driverManagerPort) {
      client = new TelnetClient({
        // host: '10.241.5.197',
        host: '127.0.0.1',
        port: navigator.mozFFOSAssistant.driverManagerPort,
        onmessage: handleMessage,
        onopen: onopen,
        onclose: onclose
      }).connect();
    } else {
      console.log("DriverManager process is not running!");
    }
  }

  function handleMessage(msg) {
    if (!msg) {
      return;
    }

    switch (msg.type) {
      case 'notification':
        console.log('Got an notification');
        checkNotification();
        break;
      case 'deviceChanged':
        onDeviceChanged(msg);
        break;
      case 'driverInstalled':
        onDriverInstalled();
        break;
    }
  }

  function onDeviceChanged(msg) {
    fireEvent(DriverManager.EVENT_DEVICE_CHANGED, {
      eventType: msg.data.eventType,
      deviceInstanceId: msg.data.deviceInstanceId
    });
  }

  function onDriverInstalled() {
    fireEvent(DriverManager.EVENT_DRIVER_INSTALLED);
    fireEvent(DriverManager.EVENT_DEVICE_READY);
  }

  function checkAndInstallDrivers() {
    client.sendCommand('list', function(message) {
      if (message.data.length == 0) {
        fireEvent(DriverManager.EVENT_NO_DEVICE_FOUND);
        return;
      }

      // TODO handle all devices
      if (message.data[0].state == 'installed') {
        fireEvent(DriverManager.EVENT_DEVICE_READY);
        return;
      }

      var instanceId = message.data[0].deviceInstanceId;
      var driverPath = navigator.mozFFOSAssistant.sendCmdToDriverDownloader({
        command: 'getInstallerPath',
        deviceInstanceId: instanceId
      });

      fireEvent(DriverManager.EVENT_INSTALLING_DRIVER, {
        deviceInstanceId: instanceId
      });

      client.sendCommand('install', instanceId, driverPath, function(message) {
        console.log('Receive install message: ' + JSON.stringify(message));
      });
    });
  }

  function onopen() {
    console.log('Telnet client is opened.');
    client.sendCommand("info", function(message) {
      console.log("info: " + message);
    });

    checkAndInstallDrivers();
  }

  function onclose() {
    console.log('telnet client is closed.');
  }

  function checkNotification() {
    // Check the message, and decide what to do next.
    client.sendCommand('message', handleMessage);
  }

  function fireEvent(name, data) {
    console.log(name);
    var evt = document.createEvent('Event');
    evt.initEvent(name, true, true);
    evt.data = data;
    document.dispatchEvent(evt);
  }

  window.addEventListener('load', function(event) {
    window.setTimeout(function() {
      // TODO Check peirodically
      // Check if the process is running, start it if not
      if (!navigator.mozFFOSAssistant.isDriverManagerRunning) {
        navigator.mozFFOSAssistant.startDriverManager();
        // FIXME 1000 may not enough when running on a lower computer.
        window.setTimeout(connectToDriverManager, 1000);
      } else {
        connectToDriverManager();
      }
    }, 1000);
  });

  return {
    EVENT_INSTALLING_DRIVER: 'DriverManager:installingDriver',
    EVENT_DRIVER_INSTALLED: 'DriverManager:driverInstalled',
    EVENT_DEVICE_CHANGED: 'DriverManager:deviceChanged',
    EVENT_NO_DEVICE_FOUND: 'DriverManager:noDeviceFound',
    EVENT_DEVICE_READY: 'DriverManager:deviceReady',

    sendCommand: function() {
      if (client) {
        client.sendCommand.apply(client, arguments);
      }
    }
  };
})();

