const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.redirect(`${uuidV4()}`);
});

app.get("/:room", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    // socket.to(roomId).emit("user-connected", userId);

    socket.on("connection-request", () => {
      socket.to(roomId).emit("new-user-connected", userId);
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
