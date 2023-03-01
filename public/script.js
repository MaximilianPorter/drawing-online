class UserData {
  constructor(canvasContext) {
    this.context = canvasContext;
    this.color = "#000000";
    this.brushSize = 0.25;
  }
}

const socket = io("/");
const canvasContainer = document.querySelector(".canvas-container");
const colorPickerForm = document.querySelector(".color-picker-form");
const colorPickerInput = document.querySelector("#picker");
const sizeSliderEl = document.querySelector(".size-slider");
const sizeSliderFillEl = document.querySelector(".size-slider--fill");
// const saveDrawingBtn = document.querySelector(".save-drawing");
// const usernameDisplayEl = document.querySelector(".username-display");

const sectionLobby = document.querySelector(".section-lobby");
const playersHeaderEl = document.querySelector(".players-header");
const lobbyMembersEl = document.querySelector(".lobby-members");
const btnReadyUp = document.querySelector(".btn-ready-up");
const countdownEl = document.querySelector(".countdown");

const drawSpaceEl = document.querySelector(".draw-space");
const wordToDrawEl = document.querySelector(".word-to-draw");
const inGameCountdownEl = document.querySelector(".in-game-countdown");
const roomDrawingsEl = document.querySelector(".room-drawings");

// const debugLogRoomsBtn = document.querySelector(".debug-log-rooms");

// these are set later in myPeer open event

const windowHostName = window.location.hostname;
const myPeer =
  windowHostName === "localhost" || windowHostName === "127.0.0.1"
    ? new Peer(undefined, { host: "localhost", port: 3001 })
    : new Peer();

// only needed when game starts
let canvas = createCanvas(null);
const peers = {};
const otherUsers = new Map();
const userData = {};

const myUsername = localStorage.getItem("username");
// usernameDisplayEl.textContent = myUsername;

let painting = false;
let localBrushSize = 0.25;
let colorPickerFocused = false;

// Set the canvas dimensions to match the window size
// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;

myPeer.on("open", (id) => {
  console.log(`MY PEER ID: ${id}`);

  // listen for other users to start their paths (on client)
  myPeer.on("connection", (conn) => {
    const otherid = conn.peer;
    if (otherid === myPeer.id) return;

    console.log(`OTHER USER: `, otherid);
  });

  // create a new user data object for the local user
  userData[myPeer.id] = new UserData(canvas.getContext("2d"));

  // get the room id from the url
  const roomId = window.location.pathname.slice(6);

  // if we find a random room, redirect to that room
  socket.on("found-random-room", (randomRoomId) => {
    window.location.pathname = `/room/${randomRoomId}`;
    return;
  });

  // listen for a room full response
  socket.on("room-error", (message) => {
    roomError(message);
  });

  // if we're not in the 'find' room, join the room with the id from the url
  if (roomId !== "find") {
    socket.emit("join-room", roomId, id);
  } else {
    socket.emit("join-random-room", id);
    return;
  }
  console.log("Room ID: " + roomId);

  // sends to: new-user-connected on everyone already in the room
  socket.emit(
    "connection-request",
    roomId,
    id,
    myUsername,
    JSON.parse(localStorage.getItem("gameSettings"))
  );

  // add myself to the lobby list
  addPlayerToLobbyListUI(myPeer.id, myUsername);

  // listen for other users joining the room (when you're already in the room)
  socket.on("new-user-connected", (userId, playerUsername) => {
    if (userId === myPeer.id) return; // ignore the rest if it's us

    initializePlayerInLobby({
      userId,
      username: playerUsername,
      isReady: false,
    });
  });

  // when you join the lobby, initialize every user that's already in the room
  socket.emit("get-users-in-room");
  socket.on("get-users-in-room", (users) => {
    console.log(`users in room: `, users);
    users.forEach((user) => {
      if (user.userId !== myPeer.id) {
        initializePlayerInLobby(user);
      }
    });
  });

  socket.emit("get-game-settings");
  socket.on("get-game-settings", (gameSettings) => {
    playersHeaderEl.textContent = `${gameSettings.name}`;
    console.log(`game settings: `, gameSettings);
  });

  // recieved from the server when a user is ready
  socket.on("user-ready", (userId) => {
    if (userId !== myPeer.id) {
      togglePlayerReady(userId, true);
    }
  });

  socket.on("countdown", (countdown) => {
    console.log(`game starting in: `, countdown);
    countdownEl.classList.remove("visually-hidden");
    countdownEl.textContent = countdown;
  });

  socket.on("start-game", (wordToDraw) => {
    startGame(wordToDraw);
  });

  socket.on("draw-countdown", (countdown) => {
    inGameCountdownEl.classList.remove("visually-hidden");
    inGameCountdownEl.textContent = countdown;
  });

  socket.on("end-drawing-phase", () => {
    inGameCountdownEl.classList.add("visually-hidden");
    drawSpaceEl.classList.add("visually-hidden");

    roomDrawingsEl.classList.remove("visually-hidden");

    // send the drawing data to the server
    socket.emit("drawing-data", myPeer.id, canvas.toDataURL());
  });
  socket.on("drawing-data", (userId, drawingURL) => {
    if (userId === myPeer.id) return;

    // add the drawing to the room drawings
    const markup = `<img src="${drawingURL}" alt="drawing from ${
      otherUsers.get(userId).username
    }" class="room-img" data-user-id="${userId}" />`;
    roomDrawingsEl.insertAdjacentHTML("beforeend", markup);
  });

  socket.on("voting-countdown", (countdown) => {
    inGameCountdownEl.classList.remove("visually-hidden");
    inGameCountdownEl.textContent = countdown;
  });

  socket.on("end-voting-phase", () => {
    inGameCountdownEl.classList.add("visually-hidden");
    roomDrawingsEl.classList.add("visually-hidden");
    roomDrawingsEl.querySelectorAll("img").forEach((img) => img.remove());

    // TODO display players who are out
  });

  socket.on("user-disconnected", (userId) => {
    if (peers[userId]) {
      // document.querySelector(`.canvas[data-user-id='${userId}']`).remove();
      document
        .querySelector(`.lobby-member[data-user-id='${userId}']`)
        .remove();
      peers[userId].close();
      otherUsers.delete(userId);
      delete peers[userId];
    }
  });

  manageSocketDrawingData();
  socket.on("get-open-rooms", (rooms) => {
    console.log(`rooms: `, rooms);
  });
});

// EVENT LISTENERS----------------------------------------------------------------------------------------
// debugLogRoomsBtn.addEventListener("click", () => {
//   console.log("request open rooms...");
//   socket.emit("get-open-rooms");
// });

// change color of path to selected color
colorPickerForm.addEventListener("change", () => {
  userData[myPeer.id].color = colorPickerForm.color.value;
  // socket.emit("color-change", {
  //   id: myPeer.id,
  //   color: colorPickerForm.color.value,
  // });
});
colorPickerInput.addEventListener("focus", () => {
  colorPickerFocused = true;
});
colorPickerInput.addEventListener("blur", () => {
  colorPickerFocused = false;
});

// BRUSH SIZE SETTINGS
let changingBrushSize = false;
sizeSliderEl.addEventListener("mousedown", () => {
  changingBrushSize = true;
});
document.addEventListener("mousemove", (event) => {
  if (changingBrushSize) {
    let percentage01 = clamp(
      (event.pageX - sizeSliderEl.offsetLeft) /
        sizeSliderEl.getBoundingClientRect().width,
      0.01,
      1
    );
    localBrushSize = percentage01;
    sizeSliderFillEl.style.width = `${percentage01 * 100}%`;
  }
});
document.addEventListener("mouseup", () => {
  if (changingBrushSize) {
    changingBrushSize = false;
    userData[myPeer.id].brushSize = localBrushSize;
    // socket.emit("brush-size-change", {
    //   id: myPeer.id,
    //   brushSize: localBrushSize,
    // });
  }
});

// open canvas content in new window as image when save button is clicked
// saveDrawingBtn.addEventListener("click", () => {
//   const dataUrl = canvas.toDataURL("image/png");
//   const newWindow = window.open();
//   newWindow.document.write(
//     `<img style="display: block;-webkit-user-select: none;margin: auto;background-color: hsl(0, 0%, 90%);transition: background-color 300ms;" src="${dataUrl}">`
//   );
//   newWindow.document.querySelector(
//     "body"
//   ).style = `margin: 0px; background: #0e0e0e; height: 100%;display:flex;align-items:center;justify-content:center;`;
// });

btnReadyUp.addEventListener("click", () => {
  // if there's less than 3 players in the room, don't let them ready up
  if (Object.keys(peers).length < 2) return;

  if (socket) socket.emit("ready-up", myPeer.id);
  btnReadyUp.classList.add("visually-hidden");
  togglePlayerReady(myPeer.id, true);
});

// if color picker form is open, disabled canvas mouse events
// colorPickerForm.addEventListener("mousedown", () => {
//   canvas.classList.add("pointer-events-none");
// });

function initializePlayerInLobby(userInfo) {
  console.log("user data received: ", userInfo);
  // add other user to peers object
  peers[userInfo.userId] = connectToNewUser(userInfo.userId);
  otherUsers.set(userInfo.userId, userInfo);

  // add other user to lobby list
  addPlayerToLobbyListUI(userInfo.userId, userInfo.username);

  // if other user is ready, set them as ready
  togglePlayerReady(userInfo.userId, userInfo.isReady);
}

function startGame(wordToDraw) {
  console.log("game starting");
  countdownEl.classList.add("visually-hidden");

  // hide lobby
  sectionLobby.classList.add("visually-hidden");
  drawSpaceEl.classList.remove("visually-hidden");
  wordToDrawEl.textContent = wordToDraw;
}
function manageSocketDrawingData() {
  // SENDING MOUSE EVENTS---------------------------------------------------------------
  document.addEventListener("mousedown", startPath);
  document.addEventListener("mouseup", endPath);
  canvas.addEventListener("mouseleave", () => {
    userData[myPeer.id].context.beginPath();
    // socket.emit("end-path", myPeer.id);
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!painting || colorPickerFocused) return;
    const x = event.clientX - canvas.offsetLeft;
    const y = event.clientY - canvas.offsetTop;

    // Draw a red circle at the current mouse position
    draw(myPeer.id, x, y);

    // Send the mouse position to other clients in the same room
    // socket.emit("draw", { id: myPeer.id, x, y });
  });

  // RECIEVING MOUSE EVENTS---------------------------------------------------------------
  // listen for other users to start their paths
  socket.on("draw", (data) => {
    if (data.id !== myPeer.id) {
      draw(data.id, data.x, data.y);
    }
  });

  // listen for other users to end their paths
  socket.on("end-path", (data) => {
    if (data !== myPeer.id) {
      // console.log(data);
      if (userData[data]) userData[data].context.beginPath();
    }
  });

  socket.on("color-change", (data) => {
    if (data.id !== myPeer.id) {
      userData[data.id].color = data.color;
    }
  });

  socket.on("brush-size-change", (data) => {
    if (data.id !== myPeer.id) {
      userData[data.id].brushSize = data.brushSize;
    }
  });
}

function createCanvas(userId) {
  const localCanvas = document.createElement("canvas");
  localCanvas.classList.add("canvas");
  localCanvas.dataset.userId = userId;
  if (userId !== myPeer.id) {
    localCanvas.classList.add("pointer-events-none");
  }
  localCanvas.width = 500;
  localCanvas.height = 500;

  // initialize context with a white background
  const localContext = localCanvas.getContext("2d");
  localContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
  localContext.fillStyle = "rgba(255,255,255,1)";
  localContext.fillRect(0, 0, window.innerWidth, window.innerHeight);

  canvasContainer.insertAdjacentElement("beforeend", localCanvas);

  return localCanvas;
}

function connectToNewUser(userId) {
  // console.log("Connecting to new user: " + userId);
  const conn = myPeer.connect(userId);
  conn.on("open", () => {
    console.log("Connected to new user: " + userId);
  });

  return conn;
}

function startPath(event) {
  if (colorPickerFocused) return;
  painting = true;
  draw(
    myPeer.id,
    event.clientX - canvas.offsetLeft,
    event.clientY - canvas.offsetTop
  );
}
function endPath() {
  painting = false;
  userData[myPeer.id].context.beginPath();
  // socket.emit("end-path", myPeer.id);
}

function draw(userId, x, y) {
  userData[userId].context.strokeStyle = userData[userId].color;
  userData[userId].context.lineCap = "round";
  userData[userId].context.lineWidth = userData[userId].brushSize * 50;
  userData[userId].context.lineJoin = "round";

  userData[userId].context.lineTo(x, y);
  userData[userId].context.stroke();
  userData[userId].context.beginPath();
  userData[userId].context.moveTo(x, y);
}

function addPlayerToLobbyListUI(userId, playerUsername) {
  // if it's the first time adding a player to the lobby list, remove the loading message
  if (!lobbyMembersEl.querySelector(".lobby-member")) {
    lobbyMembersEl.innerHTML = "";
  }

  const markup = `
    <div class="lobby-member" data-user-id="${userId}">
      <p class="lobby-member--username">${playerUsername}</p>
      <div class="lobby-member--drawing">
        <!-- <canvas class="lobby-member--canvas" height="100" width="100"></canvas> -->
      </div>
    </div>
  `;
  lobbyMembersEl.insertAdjacentHTML("beforeend", markup);
}

function togglePlayerReady(userId, isReady = true) {
  const playerEl = document.querySelector(
    `.lobby-member[data-user-id="${userId}"]`
  );
  playerEl.classList.toggle("user-ready", isReady);
}
function allPlayersReady() {
  sectionLobby.classList.remove("section-lobby-not-ready");
  lobbyMembersEl.classList.remove("lobby-members-not-ready");
}

function roomError(errMsg) {
  localStorage.setItem("roomError", errMsg);
  window.location.pathname = "/";
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
