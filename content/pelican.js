function PelicanClient(option) {
  this.initialize(option);
}

PelicanClient.prototype = {
  lobbyConn: null,
  gameConn: null,

  initialize: function(option) {
    this.option = option;

    var self = this;
    this.lobbyConn = new SocketConn({
      host: "127.0.0.1",
      port: 6888,
      onStartRequest: function() {
        _log("Connect to lobby start");
      },
      onStopRequest: function() {
        _log("Lobby connection stop");
      },
      onMessage: function(message) {
        self._onServerMessage(message)
      }
    });

    var self = this;
    window.addEventListener("unload", function() {
      self.stop();
      window.removeEventListener("unload", arguments.callee, false);
    }, false);
  },

  _onServerMessage: function(message) {
    if (!message || !message.act) {
      return;
    }
    var code = getServerCode(message.act);
    if (!code) {
      return;
    }
    switch (code.id) {
      case SERVER_CODE.LOGIN.id:
        // Record client id which is the identity of the player.
        this.clientId = message.clientId;
        break;
      case SERVER_CODE.GAME_LOAD.id:
        this._gameLoad(message);
        break;
      case SERVER_CODE.GAME_END.id:
        this._gameEnd(message);
        break;
      case SERVER_CODE.ROOM_ADD_PLAYER.id:
        if (message.clientId == this.clientId) {
          this._position = message.pos;
        }
        break;
      case SERVER_CODE.GAME_SUSPEND.id:
        _info("Game is suspended.");
        break;
      case SERVER_CODE.GAME_RESUME.id:
        _info("Game is resumed");
        break;
      case SERVER_CODE.GAME_ITEMS.id:
        this.items = [];
        var self = this;
        var _iMessage = [];
        _iMessage.push("I got items");
        message.tools.forEach(function(t) {
          self.items.push({
            uid: t.uid,
            fid: t.fid,
            type: t.type,
            title: t.title
          });
          _iMessage.push(t.title);
        });
        _info(_iMessage.join(","));
        break;
    }

    if (typeof this.option.onMessage == 'function') {
      this.option.onMessage(message, code);
    }
  },

  _gameEnd: function(message) {
    if (this.gameConn) {
      this.gameConn.stop();
      this.gameConn = null;
    }
  },

  _gameLoad: function(message) {
    if (!message.server) {
      _error("No game server is defined: " + JSON.stringify(message));
      return;
    }

    var gameServer = message.server.split(":");
    if (this.gameConn) {
      this.gameConn.stop();
    }

    // Initialize game server connection
    var self = this;
    this.gameConn = new SocketConn({
      host: gameServer[0],
      port: parseInt(gameServer[1]),
      onStartRequest: function() {
        _log("Game Server connection start.")
      },

      onStopRequest: function() {
        _log("Game Server connection stop.");
      },

      onMessage: function(message) {
        self._onServerMessage(message);
      }
    });

    // Connect to game server
    this.gameConn.connect();

    // Send join game protocol.
    this._sendDataToGameServer({
      act: CLIENT_CODE.JOIN_GAME.id,
      position: message.position,
      token: message.token,
      token2: message.token2,
      roomId: message.roomId,
      clientId: this.clientId
    });

    // Update resource loading state
  window.clearTimeout(this._updLoadingStateTimeout);
    this._updLoadingStateTimeout = window.setTimeout(function() {
      self.updateLoadingState(100);
    }, 1000);
  },

  _sendData: function(obj, conn) {
    if (conn) {
      try {
        conn.sendData(obj);
      } catch (e) {
        _error(e);
      }
    }
  },

  _sendDataToLobby: function(str) {
    this._sendData(str, this.lobbyConn);
  },

  _sendDataToGameServer: function(str) {
    this._sendData(str, this.gameConn);
  },

  /********* functions to send data to lobby servr *********/
  login: function(id) {
    if (isNaN(id)) {
      alert("You have to input an integer.");
      return;
    }

    // Demo user id
    this.id = id;
    this.stop();
    this.lobbyConn.connect();
    this.lobbyConn.sendData({
      act: CLIENT_CODE.LOGIN.code,
      uid: id,
      sessionKey: 'b4fec1dc3f921e6440e92f71e40d6c9e6e4aaf7e_1346398748_1874427951',
      sns: 'WEIYOUXI'
    });
  },

  stop: function() {
    if (this.lobbyConn) {
      this.lobbyConn.stop();
    }

    if (this.gameConn) {
      this.gameConn.stop();
    }

    window.clearTimeout(this._updLoadingStateTimeout);
  },

  getQuests: function() {
    this._sendDataToLobby({
      act: CLIENT_CODE.GET_QUESTS.id
    });
  },

  pickupAward: function(questId) {
    if (!questId) {
      alert("No quest is selected.")
      return;
    }

    this._sendDataToLobby({
      act: CLIENT_CODE.PICKUP_QUEST_AWARD.id,
      questId: parseInt(questId)
    })
  },

  getRoomList: function() {
    this._sendDataToLobby({
      act: CLIENT_CODE.SCENE_LOGIN.id
    });
  },

  createRoom: function() {
    this._sendDataToLobby({
      act: CLIENT_CODE.CREATE_ROOM.id
    });
  },

  joinRoom: function(roomId) {
    if (!roomId) {
      alert("No room is selectd.");
      return;
    }

    this._sendDataToLobby({
      act: CLIENT_CODE.JOIN_ROOM.id,
      roomId: parseInt(roomId)
    });
  },

  changeState: function(state) {
    this._sendDataToLobby({
      act: CLIENT_CODE.CHANGE_STATE.id,
        ready: state
    });
  },

  setReady: function() {
    this.changeState(1);
  },

  cancelReady: function() {
    this.changeState(0);
  },

  startRoomGame: function() {
    this._sendDataToLobby({
      act: CLIENT_CODE.START_GAME.id
    });
  },

  /********* functions to send data to ganme server ************/
  updateLoadingState: function(state) {
    this._sendDataToGameServer({
      act: CLIENT_CODE.UPDATE_LOADING_STATE.id,
      state: state
    });
  },

  /**
   * isAdd: 1 or -1
   *
   */
  setGunLevel: function(level) {
    this._sendDataToGameServer({
      act: CLIENT_CODE.SET_GUN_LEVEL.id,
      lv: level
    })
  },

  fire: function(pos) {
    //_log("Client " + this.id + " fire from pos: " + this._position);
    // Get random angle and fire
    this._sendDataToGameServer({
      act: CLIENT_CODE.FIRE.id,
      value: Math.floor(Math.random() * 180) + ((this._position == 1 || this._position == 3) ? 180 : 0),
      type: 0   // normal weapon.
    });
  },

  useItem: function(itemId, targetClientId, type) {
    this._sendDataToGameServer({
      act: CLIENT_CODE.GAME_USE_ITEM.id,
      itemId: itemId,
      type: type,
      targetClientId: targetClientId
    });
  },

  suspendGame: function() {
    this._sendDataToGameServer({
      act: CLIENT_CODE.GAME_SUSPEND.id
    });
  },

  resumeGame: function() {
    this._sendDataToGameServer({
      act: CLIENT_CODE.GAME_RESUME.id
    });
  },

  /********* functions to send admin data to lobby server *********/
  adminGetRoomInfo: function() {
    this._sendDataToLobby({
      act: CLIENT_CODE.ADMIN_ROOM_INFO.id
    });
  },

  startHttpServer: function() {
    this._sendDataToLobby({
      act: CLIENT_CODE.ADMIN_HTTP_SERVER.id,
      enable: true
    });
  },

  stopHttpServer: function() {
    this._sendDataToLobby({
      act: CLIENT_CODE.ADMIN_HTTP_SERVER.id,
      enable: false
    });
  },

  queryHttpServerState: function() {
    this._sendDataToLobby({
      act: CLIENT_CODE.ADMIN_HTTP_SERVER.id,
      queryState: true
    });
  }
};

function _updateRoomList(roomList) {
  $("#room-list").html("");
  roomList.forEach(function(room) {
    $("#room-list").append($("<option></option>").text(room.name + " (" + room.id + ")").attr("value", room.id));
  });
}

function _updateQuestList(quests) {
  $("#quest-list").html("");
  quests.forEach(function(q) {
    $("#quest-list").append($("<option></option>").text(q.title + "[" + (q.status == 2 ? "finished" : q.status) + "]").attr("value", q.quest_id));
  });
}

var pelican = null;

window.addEventListener("load", function() {
  pelican = new PelicanClient({
    onMessage: function(message, code) {
      switch (code.id) {
        case SERVER_CODE.ROOM_CREATE.id:
          _log("You have create room");
          break;
        case SERVER_CODE.JOIN_ROOM.id:
          _log("You have join room!");
          break;
        case SERVER_CODE.UPDATE_ROOM_LIST.id:
          _log("You get room list.");
          _updateRoomList(message.roomList);
          break;
        case SERVER_CODE.GET_QUESTS.id:
          _log("You get quest list.");
          _updateQuestList(message.quests);
          break;
        case SERVER_CODE.GAME_USE_ITEM.id:
          message.results.forEach(function(r) {
            if (pelican.clientId == r.targetId) {
              switch (message.itemType) {
              case 20:
                _log("I am frozen!!");
                break;
              case 28:
                _log("WTF, You are using dump gun!");
                break;
              case 30:
                _log("OMG, Buffers!!!");
              }
            } else {
              switch (message.itemType) {
              case 20:
                _log("You are frozen, ahaha!");
                break;
              case 28:
                _log("Use dump gun!");
                break;
              case 30:
                _log("Sommon buffers!");
                break;
              }
            }
          });
          break;
      }
    }
  });
});

/**
 * Auto fire client.
 * If id is odd, the client creates an room automatically.
 * If id is even, the client joins the room which created by the client with even id.
 *
 */
function AutoFireClient(id) {
  this.initialize(id);
  this.addEventListeners();
}

AutoFireClient.prototype = {
  initialize: function(id) {
    var self = this;
    this.id = id;
    this._autoFire = false;
    this._fireInterval = null;
    this._client = new PelicanClient({
      onMessage: function(message, code) {
        switch (code.id) {
          case SERVER_CODE.LOGIN.id:
            if (0 == id % 2) {
              _log("Client " + id + " create room ...");
              self._client.createRoom();
            } else {
              self._getRoomByHost(id - 1);
            }
            break;
          case SERVER_CODE.UPDATE_ROOM_LIST.id:
            if (!message.roomList || message.roomList.length == 0) {
              _log("Client " + id + " can not get room created by " + (id - 1) + ", wait for another 3 seconds");
              self._getRoomByHost(id - 1);
            } else {
              _log("client " + id + " join room ...");
              // Get room id
              var roomId = message.roomList[0].id;
              // Join room
              self._client.joinRoom(roomId);
            }
            break;
          case SERVER_CODE.ROOM_CREATE.id:
            // If client id is even, then set ready
            if (1 == id % 2) {
              _log("Client " + id + " set ready ...");
              self._client.setReady();
            }
            break;
          case SERVER_CODE.ROOM_CHANGE_STATE.id:
            // If client is odd which means the client is host
            // then start game
            if (0 == id % 2) {
              // Check if other player is ready
              if (message.states[1] == 1) {
                _log("Client" + id + " start room game.");
                self._client.startRoomGame();
              }
            }
            break;
          case SERVER_CODE.GAME_PLAYER_CONNECTED.id:
            if (message.clientId == self._client.clientId) {
              // Update resource loading state after connected with game server.
              self._client.updateLoadingState(100);
              // Start fire, clear fire interval first
              // FIXME receive GAME_PLAYER_CONNECTED more than once?
              window.clearInterval(self._fireInterval);
              self._fireInterval = window.setInterval(function() {
                self._client.fire();

                // update div class
                var _div = $("#client-" + id);
                if (!_div.hasClass("fire1")) {
                  _div.removeClass("fire1");
                  _div.addClass("fire2");
                } else {
                  _div.removeClass("fire2");
                  _div.addClass("fire1");
                }

                window.clearTimeout(self._blingClientDivTimeout);
                self._blingClientDivTimeout = window.setTimeout(function() {
                  $("#client-" + id).removeClass("fire1");
                  $("#client-" + id).removeClass("fire2");
                }, 500);
              }, 1000 + Math.random() * 2000);


              var startRandomItem = false;
              // Set an interval to use different items
              window.clearInterval(self._useItemInterval);
              self._useItemInterval = window.setInterval(function() {
                // Item: 20, 22, 24, 26, 28, 30
                var itemType = 20 + Math.floor(Math.random() * 6) * 2;

                // Summon buffer first
                if (!startRandomItem) {
                  startRandomItem = true;
                  itemType = 30;
                }

                self._client.useItem(1, 10000, itemType);
                _log("client " + self._client.id + " use item " + itemType);
              }, 5000 + Math.random() * 1000);
            }
            break;
          case SERVER_CODE.GAME_USE_ITEM.id:
            message.results.forEach(function(r) {
              if (r.targetId == self._client.clientId) {
                if (message.itemType == 30) {
                  _log("OMG, puffers!!!");
                } else {
                  // If competitor use some item on me, use item to remove the effect
                  _log("client " + self._client.id + " was used item " + message.itemType + ", remove it!!!!");
                  var itemType = message.itemType;
                  self._client.useItem(1, self._client.id, itemType + 1);
                }
              }
            });
            break;
          case SERVER_CODE.GAME_END.id:
            // Stop auto fire
            window.clearInterval(self._fireInterval);
            message.results.forEach(function(result) {
              if (result.clientId == self._client.clientId) {
                if (result.isWin == 0) {
                  _info("Client " + id + " lose ............");
                } else if (result.isWin == 1) {
                  _info("Client " + id + "  win!!!!!!!!");
                } else {
                  _info("Client " + id + " 打成平手.");
                }
              }
            });
            // If client id is even, then set ready
            if (1 == id % 2) {
              window.clearTimeout(self._setReadyTimeout);
              self._setReadyTimeout = window.setTimeout(function() {
                _log("Client " + id + " set ready ...");
                self._client.setReady();
              }, 3000);
            }
            break;
        }
      }
    });
    self._client.login(id);
  },

  _getRoomByHost: function(hostId) {
    var self = this;
    window.clearTimeout(this._fetchRoomTimeout);
    this._fetchRoomTimeout = setTimeout(function() {
      _log("Client " + self.id + " get room created by host " + hostId);
      self._client._sendDataToLobby({
        act: CLIENT_CODE.GET_ROOM_BY_HOST.id,
        hostId: hostId
      });
    }, 3000);
  },

  autoFire: function(autoFire) {
    this._autoFire = autoFire;
  },

  stop: function() {
    window.clearInterval(this._fireInterval);
    window.clearTimeout(this._setReadyTimeout);
    window.clearTimeout(this._fetchRoomTimeout);
    this._client.stop();
  },

  addEventListeners: function() {
    var self = this;
    window.addEventListener("stop-client", function() {
      self.stop();
      window.removeEventListener("stop-client", arguments.callee, false);
    }, false);
  }
}

function stopClient() {
  var evt = document.createEvent("Event");
  evt.initEvent("stop-client", true, true);
  window.dispatchEvent(evt);
}

function autoPair() {
  var ids = $("#autopairids")[0].value.split("-");
  for (var i = parseInt(ids[0]); i < parseInt(ids[1]); i++,i++) {
    window.open("chrome://pelicanclient/content/client.html?" + i + "-" + (i + 1));
  }
}

function createClientDiv(id) {
  if ($("#client-" + id).length == 0) {
    $("#clients").append('<div id="client-' + id + '">' + id + '</div>');
  }
}

window.addEventListener("load", function() {
  window.removeEventListener("load", arguments.callee, false);
  var idx = document.location.href.indexOf("?");
  if (idx > 0) {
    var ids = document.location.href.substring(idx + 1).split("-");
    ids.forEach(function(id) {
      if (isNaN(id)) {
        return;
      }

      createClientDiv(id);
      new AutoFireClient(parseInt(id)).autoFire(true);

        // set a time out to refresh the page to simulate abnormal disconnection
        window._refreshTimeout = window.setTimeout(function() {
          document.location.reload(true);
        }, Math.random() * 60 * 1000 + 60 * 1000);

        window.addEventListener("stop-client", function() {
          window.clearTimeout(window._refreshTimeout);
        }, false);
    });
  }
}, false);
