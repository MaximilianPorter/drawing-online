const socket = io("/");
const canvasContainer = document.querySelector(".canvas-container");
const colorPickerForm = document.querySelector(".color-picker-form");
const sizeSliderEl = document.querySelector(".size-slider");
const sizeSliderFillEl = document.querySelector(".size-slider--fill");

// these are set later in myPeer open event

const myPeer = new Peer(undefined, {
  host: "/",
  port: "3001",
});

let canvas = createCanvas(myPeer.id);
const peers = {};
const userData = {};

let painting = false;
let localBrushSize = 0.5;

// Set the canvas dimensions to match the window size
// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;

myPeer.on("open", (id) => {
  console.log(`Peer ID: ${id}`);

  userData[myPeer.id] = {
    context: canvas.getContext("2d"),
    color: "#000000",
    brushSize: 0.5,
  };

  // Redirect to a random room ID if none is specified in the URL
  if (!window.location.pathname.slice(1)) {
    window.location.pathname = `/${Math.random().toString(36).substring(2, 8)}`;
  }

  const roomId = window.location.pathname.slice(1);
  socket.emit("join-room", roomId, id);
  socket.emit("connection-request", roomId, id);

  socket.on("new-user-connected", (userId) => {
    if (userId != myPeer.id) {
      console.log("New user connected: " + userId);
      peers[userId] = connectToNewUser(userId);

      userData[userId] = {
        context: createCanvas(userId).getContext("2d"),
        color: "#000000",
        brushSize: 0.5,
      };
    }
  });

  myPeer.on("connection", (conn) => {
    id = conn.peer;
    if (id === myPeer.id) return;

    console.log(`OTHER USER: `, id);
    userData[id] = {
      context: createCanvas(id).getContext("2d"),
      color: "#000000",
      brushSize: 0.5,
    };
  });

  socket.on("user-disconnected", (userId) => {
    if (peers[userId]) {
      document.getElementById(userId).remove();
      peers[userId].close();
    }
  });

  // listen for other users to start their paths
  socket.on("mousemove", (data) => {
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

  document.addEventListener("mousedown", startPath);
  document.addEventListener("mouseup", endPath);
  canvas.addEventListener("mouseleave", () => {
    userData[myPeer.id].context.beginPath();
    socket.emit("end-path", myPeer.id);
  });

  canvas.addEventListener("mousemove", (event) => {
    if (!painting) return;
    const x = event.clientX - canvas.offsetLeft;
    const y = event.clientY - canvas.offsetTop;

    // Draw a red circle at the current mouse position
    draw(myPeer.id, x, y);

    // Send the mouse position to other clients in the same room
    socket.emit("mousemove", { id: myPeer.id, x, y });
  });
});

// change color of path to selected color
colorPickerForm.addEventListener("change", () => {
  userData[myPeer.id].color = colorPickerForm.color.value;
  socket.emit("color-change", {
    id: myPeer.id,
    color: colorPickerForm.color.value,
  });
});

let changingBrushSize = false;
sizeSliderEl.addEventListener("mousedown", () => {
  changingBrushSize = true;
});
document.addEventListener("mousemove", (event) => {
  if (changingBrushSize) {
    let percentage01 = clamp(
      (event.pageX - sizeSliderEl.offsetLeft) /
        sizeSliderEl.getBoundingClientRect().width,
      0,
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
    socket.emit("brush-size-change", {
      id: myPeer.id,
      brushSize: localBrushSize,
    });
  }
});

function createCanvas(userId) {
  const localCanvas = document.createElement("canvas");
  localCanvas.classList.add("canvas");
  localCanvas.id = userId;
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

  // if (!paths[userId]) {
  //   console.log("Creating new path for user: " + userId);
  //   paths[userId] = new Path2D();
  // }

  // paths[userId].lineTo(x, y);
  // context.stroke(paths[userId]);
  // paths[userId].moveTo(x, y);

  userData[userId].context.lineTo(x, y);
  userData[userId].context.stroke();
  userData[userId].context.beginPath();
  userData[userId].context.moveTo(x, y);

  // context.arc(x, y, 10, 0, 2 * Math.PI);
  // context.fill();
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}
