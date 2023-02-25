const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

const rooms = new Map();

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/create-random-room", (req, res) => {
  res.redirect(`../room/${uuidV4().split("-").at(-1)}`);
});

app.get("/room/:room", (req, res) => {
  res.sendFile(__dirname + "/public/drawing.html");
});

class UserData {
  constructor(userId, username) {
    this.userId = userId;
    this.username = username;
    this.isReady = false;
  }
}

const defaultGameSettings = {
  name: "Random Game",
  password: "",
  maxPlayers: 20,
  drawTime: 60,
};

io.on("connection", (socket) => {
  socket.on("join-random-room", (userId) => {
    let foundRoomId = null;
    for (const [roomId, roomData] of rooms) {
      // get active clients in room (including me)
      const socketRoom = io.sockets.adapter.rooms.get(roomId);
      const numClients = socketRoom ? socketRoom.size : 0;

      // if room is not full, join it
      if (
        numClients > 0 &&
        numClients <
          (roomData?.settings.maxPlayers ?? defaultGameSettings.maxPlayers)
      ) {
        foundRoomId = roomId;
        break;
      }
    }

    // if no room is found, create a new one
    if (!foundRoomId) {
      foundRoomId = uuidV4().split("-").at(-1);
    }
    socket.emit("found-random-room", foundRoomId);
  });

  socket.on(
    "connection-request",
    (roomId, userId, playerUsername, gameSettings) => {
      gameSettings = rooms.has(roomId)
        ? rooms.get(roomId).settings
        : gameSettings ?? defaultGameSettings;

      // don't join if room is full
      const socketRoom = io.sockets.adapter.rooms.get(roomId);
      const numClients = socketRoom ? socketRoom.size : 0;
      // this is checking after the user has already joined the room
      if (
        numClients >
        (gameSettings?.maxPlayers ?? defaultGameSettings.maxPlayers)
      ) {
        socket.emit("room-full");
        return;
      }

      socket.to(roomId).emit("new-user-connected", userId, playerUsername);

      const userData = new UserData(userId, playerUsername);
      // create room if it doesn't exist
      const roomData = {
        roomId,
        settings: { ...gameSettings },
        users: [userData],
      };
      if (!rooms.has(roomId)) rooms.set(roomId, roomData);
      else rooms.get(roomId).users.push(userData);
    }
  );

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);

    socket.on("get-users-in-room", () => {
      socket.emit("get-users-in-room", rooms.get(roomId).users);
    });

    socket.on("get-open-rooms", () => {
      socket.emit("get-open-rooms", [...rooms]);
    });

    socket.on("get-game-settings", () => {
      socket.emit("get-game-settings", rooms.get(roomId).settings);
    });

    socket.on("color-change", (data) => {
      socket.to(roomId).emit("color-change", data);
    });

    socket.on("brush-size-change", (data) => {
      socket.to(roomId).emit("brush-size-change", data);
    });

    socket.on("draw", (data) => {
      socket.to(roomId).emit("draw", data);
    });

    socket.on("end-path", (data) => {
      socket.to(roomId).emit("end-path", data);
    });

    socket.on("ready-up", (userId) => {
      socket.to(roomId).emit("user-ready", userId);
      getUserInRoom(roomId, userId).isReady = true;

      // check if all users are ready
      const allUsersReady = rooms
        .get(roomId)
        .users.every((user) => user.isReady);
      if (allUsersReady) {
        // send the event to everyone in the room
        io.in(roomId).emit("all-users-ready");
      }
    });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);

      removeUserFromRoom(roomId, userId);
    });
  });
});

function getUserInRoom(roomId, userId) {
  return rooms.get(roomId)?.users.find((user) => user.userId === userId);
}

function removeUserFromRoom(roomId, userId) {
  if (!rooms.get(roomId)) return;

  rooms.get(roomId).users = rooms
    .get(roomId)
    ?.users.filter((user) => user.userId !== userId);
}

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
server.listen(port);
