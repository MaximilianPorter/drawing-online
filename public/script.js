const socket = io("/");
const pageContainer = document.querySelector(".page-container");
const canvas = document.querySelector("#canvas");
const context = canvas.getContext("2d");

const colorPickerForm = document.querySelector(".color-picker");

const myPeer = new Peer(undefined, {
  host: "/",
  port: "3001",
});
const peers = {};
const paths = {};

let painting = false;

// Set the canvas dimensions to match the window size
// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;

myPeer.on("open", (id) => {
  console.log(`Peer ID: ${id}`);

  // Redirect to a random room ID if none is specified in the URL
  if (!window.location.pathname.slice(1)) {
    window.location.pathname = `/${Math.random().toString(36).substring(2, 8)}`;
  }

  const roomId = window.location.pathname.slice(1);
  socket.emit("join-room", roomId, id);

  socket.on("user-connected", (userId) => {
    console.log("New user connected: " + userId);
    peers[userId] = connectToNewUser(userId);
  });

  socket.on("user-disconnected", (userId) => {
    if (peers[userId]) peers[userId].close();
  });

  // listen for other users to start their paths
  socket.on("mousemove", (data) => {
    if (data.id !== myPeer.id) {
      draw(data.id, data.x, data.y);
    }
  });

  // listen for other users to end their paths
  socket.on("end-path", (data) => {
    if (data.id !== myPeer.id) {
      if (paths[data]) paths[data] = new Path2D();
    }
  });

  document.addEventListener("mousedown", startPath);
  document.addEventListener("mouseup", endPath);
  canvas.addEventListener("mouseleave", () => {
    paths[myPeer.id] = new Path2D();
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
  console.log(paths[myPeer.id]);
  // paths[myPeer.id].strokeStyle = colorPickerForm.color.value;
  // console.log("color changed to: " + colorPickerForm.color.value);
});

function createCanvas() {
  const localCanvas = document.createElement("canvas");
  localCanvas.id = "canvas";
  localCanvas.width = 500;
  localCanvas.height = 500;
  pageContainer.insertAdjacentElement("beforeend", localCanvas);

  return localCanvas;
}

function connectToNewUser(userId) {
  console.log("Connecting to new user: " + userId);
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
  paths[myPeer.id] = new Path2D();
  socket.emit("end-path", myPeer.id);
}

function draw(userId, x, y) {
  context.strokeStyle = colorPickerForm.color.value;
  context.lineCap = "round";
  context.lineWidth = 10;
  context.lineJoin = "round";

  if (!paths[userId]) {
    console.log("Creating new path for user: " + userId);
    paths[userId] = new Path2D();
  }

  paths[userId].lineTo(x, y);
  context.stroke(paths[userId]);
  paths[userId].moveTo(x, y);

  // context.lineTo(x, y);
  // context.stroke();
  // context.beginPath();
  // context.moveTo(x, y);

  // context.arc(x, y, 10, 0, 2 * Math.PI);
  // context.fill();
}
