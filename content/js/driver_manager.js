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
      window.setTimeout(connectToDriverManager, 1000);
      console.log("DriverManager process is not running, try to connect it again!");
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
        onDriverInstalled(msg);
        break;
    }
  }

  function onDeviceChanged(msg) {
    fireEvent(DriverManager.EVENT_DEVICE_CHANGED, {
      eventType: msg.data.eventType,
      deviceInstanceId: msg.data.deviceInstanceId
    });

    checkDriverStatus();
  }

  function onDriverInstalled(msg) {
    // `driverInstalled` means the driver installer running completes, however it
    // does not mean the driver for the plugged device is installed, so it's not
    // a reliable event for ensuring driver-failed-to-be-installed, we need to try
    // to connect to the device and double check `adbConnected`.
    //
    // We don't need to fire device-ready-event here, we will receive an device-change
    // event if driver is installed successfully.
    if (msg.data.errorName && !navigator.mozFFOSAssistant.adbConnected) {
      fireEvent(DriverManager.EVENT_DRIVER_FAIL_INSTALLED, {
        errorMessage: msg.data.errorMessage,
        errorCode: msg.data.errorCode
      });
    }
  }

  var _doubleCheckTimeout = null;
  function checkDriverStatus() {
    client.sendCommand('list', function(message) {
      if (message.data.length == 0) {
        fireEvent(DriverManager.EVENT_NO_DEVICE_FOUND);
        return;
      } else {
        fireEvent(DriverManager.EVENT_DEVICE_FOUND);
      }

      // TODO handle all devices
      if (message.data[0].state == 'installed') {
        fireEvent(DriverManager.EVENT_DEVICE_READY);
        return;
      }

      // Windows need to load the driver when USB connected, so sometimes
      // the message told us it's not installed, we need wait for seconds
      // and query again to double check the status.
      window.clearTimeout(_doubleCheckTimeout);

      _doubleCheckTimeout = window.setTimeout(doCheckAndInstallDrivers, 5000);
    });
  }

  function doCheckAndInstallDrivers() {
    console.log('Double check the driver installation state.');
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

    checkDriverStatus();
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
    if (!os.isWindows) {
      return;
    }

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
    EVENT_DRIVER_FAIL_INSTALLED: 'DriverManager:driverFailInstalled',

    EVENT_DEVICE_CHANGED: 'DriverManager:deviceChanged',

    EVENT_DEVICE_FOUND: 'DriverManager:deviceFound',
    EVENT_NO_DEVICE_FOUND: 'DriverManager:noDeviceFound',
    EVENT_DEVICE_READY: 'DriverManager:deviceReady',

    sendCommand: function() {
      if (client) {
        client.sendCommand.apply(client, arguments);
      }
    }
  };
})();

