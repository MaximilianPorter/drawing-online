// run nodemon server.js
// and peerjs --port 3001

const GameSettings = require("./public/gameSettings.js");

const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");
const words = require("./fullWordList.json");

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
    this.votes = 0;
    this.isEliminated = false;
  }
}

const defaultGameSettings = new GameSettings();

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
          (roomData.settings.maxPlayers ?? defaultGameSettings.maxPlayers) &&
        roomData.settings.privateRoom === false &&
        roomData.settings.gameStarted === false
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
      if (numClients > gameSettings.maxPlayers) {
        socket.emit("room-error", "Room is full");
        return;
      } else if (gameSettings.gameStarted) {
        socket.emit("room-error", "Game has already started");
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
      if (!rooms.has(roomId) && roomId !== "find") rooms.set(roomId, roomData);
      else rooms.get(roomId).users.push(userData);
    }
  );

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);

    socket.on("get-users-in-room", () => {
      socket.emit("get-users-in-room", rooms.get(roomId).users);
    });

    socket.on("get-open-rooms", () => {
      let port = process.env.PORT;
      if (port == null || port == "") {
        socket.emit("get-open-rooms", [...rooms]);
      } else {
        socket.emit("get-open-rooms", "not the local host");
      }
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

    socket.on("drawing-data", (userId, drawingURL) => {
      // return if user is eliminated
      if (getUserInRoom(roomId, userId).isEliminated) return;

      socket.to(roomId).emit("drawing-data", userId, drawingURL);
      // socket.to(roomId).emit('drawing-data', data)
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
        rooms.get(roomId).settings.gameStarted = true;

        // send the event to everyone in the room
        startGameCountdown(roomId);
      }
    });

    socket.on("vote", (userId) => {
      getUserInRoom(roomId, userId).votes++;
    });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);

      removeUserFromRoom(roomId, userId);
    });
  });
});

function startGameCountdown(roomId) {
  const roomData = rooms.get(roomId);
  const gameSettings = roomData.settings;

  // start game countdown
  let countdown = gameSettings.countdownTime;
  const gameCountdownInterval = setInterval(() => {
    if (countdown <= 0) {
      startDrawCountdown(roomId, gameSettings.drawTime);
      io.in(roomId).emit("start-game", randomWord());
      clearInterval(gameCountdownInterval);
      return;
    }

    countdown--;
    io.in(roomId).emit("countdown", countdown);
  }, 1000);
}

function startDrawCountdown(roomId, countdownTime) {
  rooms.get(roomId).settings.gamePhase = "drawing";
  let countdown = countdownTime;
  const drawCountdownInterval = setInterval(() => {
    if (countdown <= 0) {
      endDrawingPhase(roomId);
      clearInterval(drawCountdownInterval);
      return;
    }

    countdown--;
    io.in(roomId).emit("draw-countdown", countdown);
  }, 1000);
}

function endDrawingPhase(roomId) {
  io.in(roomId).emit("end-drawing-phase");
  startVotingCountdown(roomId, rooms.get(roomId).settings.votingTime);
}

function startVotingCountdown(roomId, countdownTime) {
  rooms.get(roomId).settings.gamePhase = "voting";

  let countdown = countdownTime;
  const votingCountdownInterval = setInterval(() => {
    if (countdown <= 0) {
      endVotingPhase(roomId);
      clearInterval(votingCountdownInterval);
      return;
    }

    countdown--;
    io.in(roomId).emit("voting-countdown", countdown);
  }, 1000);
}
function endVotingPhase(roomId) {
  io.in(roomId).emit(
    "end-voting-phase",
    rooms.get(roomId).users.filter((user) => !user.isEliminated)
  );

  // wait 3 seconds before displaying who got eliminated
  setTimeout(() => {
    eliminateUsers(roomId);
  }, 3000);
}

function eliminateUsers(roomId) {
  // check if there's already 1 person left (idk why this would happen tho)
  if (
    rooms.get(roomId).users.length === 1 ||
    rooms.get(roomId).users.filter((user) => !user.isEliminated).length === 1
  ) {
    io.in(roomId).emit("game-over", rooms.get(roomId).users[0].userId);
    return;
  }

  const users = rooms.get(roomId).users.filter((user) => !user.isEliminated);
  const lowestVotes = Math.min(...users.map((user) => user.votes));
  const highestVotes = Math.max(...users.map((user) => user.votes));
  const eliminatedUserIds = [];

  if (users.length <= 3) {
    // if votes are all tied, nobody gets eliminated
    if (users.every((user) => user.votes === lowestVotes)) {
      // nothing
    } else {
      // if votes are not tied, eliminate everyone except the user with the most votes
      users.forEach((user) => {
        if (user.votes !== highestVotes) {
          user.isEliminated = true;
          eliminatedUserIds.push(user.userId);
        }
      });
    }
    io.in(roomId).emit("users-eliminated", eliminatedUserIds);
  } else if (users.length === 4) {
    // only eliminate 1 person if there are 4 players
    for (const user of users) {
      if (user.votes === lowestVotes) {
        user.isEliminated = true;
        io.in(roomId).emit("users-eliminated", [user.userId]);
        // eliminatedUserIds.push(user.userId);
        break;
      }
    }
  } else {
    // if votes are not tied, eliminate the user with the least votes and everyone with 0 votes
    users.forEach((user) => {
      if (
        (user.votes === lowestVotes || user.votes === 0) &&
        eliminatedUserIds.length < users.length - 3
      ) {
        user.isEliminated = true;
        eliminatedUserIds.push(user.userId);
      }
    });
    io.in(roomId).emit("users-eliminated", eliminatedUserIds);
  }

  // check if everyone is eliminated except 1 person
  const remainingUsers = rooms
    .get(roomId)
    .users.filter((user) => !user.isEliminated);
  if (remainingUsers.length === 1) {
    io.in(roomId).emit("game-over", remainingUsers[0].userId);
    return;
  }

  // reset votes
  users.forEach((user) => (user.votes = 0));

  // start another round
  setTimeout(() => {
    startGameCountdown(roomId);
  }, 3000);
}

function getUserInRoom(roomId, userId) {
  return rooms.get(roomId)?.users.find((user) => user.userId === userId);
}

function removeUserFromRoom(roomId, userId) {
  if (!rooms.get(roomId)) return;

  rooms.get(roomId).users = rooms
    .get(roomId)
    .users.filter((user) => user.userId !== userId);
}

function randomWord() {
  return words[Math.floor(Math.random() * words.length)];
}

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
server.listen(port);
