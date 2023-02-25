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
const saveDrawingBtn = document.querySelector(".save-drawing");
const usernameDisplayEl = document.querySelector(".username-display");

const sectionLobby = document.querySelector(".section-lobby");
const playersHeaderEl = document.querySelector(".players-header");
const lobbyMembersEl = document.querySelector(".lobby-members");
const btnReadyUp = document.querySelector(".btn-ready-up");

const debugLogRoomsBtn = document.querySelector(".debug-log-rooms");

// these are set later in myPeer open event

const myPeer = new Peer();

// only needed when game starts
let canvas = createCanvas(null);
const peers = {};
const userData = {};

const myUsername = localStorage.getItem("username");
usernameDisplayEl.textContent = myUsername;

let painting = false;
let localBrushSize = 0.25;
let colorPickerFocused = false;
let localPlayerReady = false;

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
  socket.on("found-random-room", (roomId) => {
    window.location.pathname = `/room/${roomId}`;
  });

  // listen for a room full response
  socket.on("room-full", () => {
    localStorage.setItem("roomError", "Room is full");
    window.location.pathname = "/";
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

  socket.on("all-users-ready", () => {
    console.log("all users ready");
    startGame();
  });

  socket.on("user-disconnected", (userId) => {
    if (peers[userId]) {
      // document.querySelector(`.canvas[data-user-id='${userId}']`).remove();
      document
        .querySelector(`.lobby-member[data-user-id='${userId}']`)
        .remove();
      peers[userId].close();
    }
  });

  // manageSocketDrawingData();
  socket.on("get-open-rooms", (rooms) => {
    console.log(`rooms: `, rooms);
  });
});

// EVENT LISTENERS----------------------------------------------------------------------------------------
debugLogRoomsBtn.addEventListener("click", () => {
  console.log("request open rooms...");
  socket.emit("get-open-rooms");
});

// change color of path to selected color
colorPickerForm.addEventListener("change", () => {
  userData[myPeer.id].color = colorPickerForm.color.value;
  socket.emit("color-change", {
    id: myPeer.id,
    color: colorPickerForm.color.value,
  });
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
saveDrawingBtn.addEventListener("click", () => {
  const dataUrl = canvas.toDataURL("image/png");
  const newWindow = window.open();
  newWindow.document.write(
    `<img style="display: block;-webkit-user-select: none;margin: auto;background-color: hsl(0, 0%, 90%);transition: background-color 300ms;" src="${dataUrl}">`
  );
  newWindow.document.querySelector(
    "body"
  ).style = `margin: 0px; background: #0e0e0e; height: 100%;display:flex;align-items:center;justify-content:center;`;
});

btnReadyUp.addEventListener("click", () => {
  if (socket) socket.emit("ready-up", myPeer.id);
  btnReadyUp.classList.add("visually-hidden");
  togglePlayerReady(myPeer.id, true);
});

// if color picker form is open, disabled canvas mouse events
// colorPickerForm.addEventListener("mousedown", () => {
//   canvas.classList.add("pointer-events-none");
// });

function initializePlayerInLobby(userData) {
  console.log("user data received: ", userData);
  // add other user to peers object
  peers[userData.userId] = connectToNewUser(userData.userId);

  // add other user to lobby list
  addPlayerToLobbyListUI(userData.userId, userData.username);

  // if other user is ready, set them as ready
  togglePlayerReady(userData.userId, userData.isReady);
}

function startGame() {
  console.log("game starting");
}

function manageSocketDrawingData() {
  // SENDING MOUSE EVENTS---------------------------------------------------------------
  document.addEventListener("mousedown", startPath);
  document.addEventListener("mouseup", endPath);
  canvas.addEventListener("mouseleave", () => {
    userData[myPeer.id].context.beginPath();
    socket.emit("end-path", myPeer.id);
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!painting || colorPickerFocused) return;
    const x = event.clientX - canvas.offsetLeft;
    const y = event.clientY - canvas.offsetTop;

    // Draw a red circle at the current mouse position
    draw(myPeer.id, x, y);

    // Send the mouse position to other clients in the same room
    socket.emit("draw", { id: myPeer.id, x, y });
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
  // context.beginPath();
  userData[myPeer.id].context.beginPath();
  socket.emit("end-path", myPeer.id);
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

  localPlayerReady = isReady;
}
function allPlayersReady() {
  sectionLobby.classList.remove("section-lobby-not-ready");
  lobbyMembersEl.classList.remove("lobby-members-not-ready");
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
