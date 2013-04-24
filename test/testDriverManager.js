'strict'

var net = require('net');

var HOST = 'localhost';
var PORT = 10012;

console.log("LISTON: " + HOST + ":" + PORT);
net.createServer(function(socket) {
  console.log('CONNECTED: ' +
    socket.remoteAddress + ':' + socket.remotePort);

  socket.on('data', function(data) {
    console.log('Receive data: ' + data);
    socket.write(data);
  });

}).listen(PORT, HOST);

