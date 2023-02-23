const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

const rooms = new Set();

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

io.on("connection", (socket) => {
  socket.on("join-random-room", (userId) => {
    let roomId;
    for (const room of rooms) {
      const socketRoom = io.sockets.adapter.rooms.get(room);
      const numClients = socketRoom ? socketRoom.size : 0;
      if (numClients > 0) {
        roomId = room;
        break;
      }
    }

    // if no room is found, create a new one
    if (!roomId) {
      roomId = uuidV4().split("-").at(-1);
    }
    socket.emit("found-random-room", roomId);
  });

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    rooms.add(roomId);

    socket.on("get-open-rooms", (userId) => {
      socket.to(roomId).emit("get-open-rooms", [...rooms]);
    });

    socket.on("connection-request", (roomId, userId, playerUsername) => {
      socket.to(roomId).emit("new-user-connected", userId, playerUsername);
    });

    socket.on("send-username", (joiningUserId, sendersUsername) => {
      socket.to(roomId).emit("send-username", joiningUserId, sendersUsername);
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

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
});

server.listen(3000);
