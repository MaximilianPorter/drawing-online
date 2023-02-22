const socket = io("/");
const pageContainer = document.querySelector(".page-container");
const colorPickerForm = document.querySelector(".color-picker");

// these are set later in myPeer open event

const myPeer = new Peer(undefined, {
  host: "/",
  port: "3001",
});

let canvas = createCanvas(myPeer.id);
const peers = {};
const userData = {};

let painting = false;

// Set the canvas dimensions to match the window size
// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;

myPeer.on("open", (id) => {
  console.log(`Peer ID: ${id}`);

  userData[myPeer.id] = {
    context: canvas.getContext("2d"),
    color: black,
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
        color: black,
      };
    }
  });

  myPeer.on("connection", (data) => {
    id = data.peer;
    console.log(`OTHER USER: `, id);
    data[id] = {
      context: createCanvas(id).getContext("2d"),
      color: black,
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
  // console.log(userData[myPeer.id].context);
  // paths[myPeer.id].strokeStyle = colorPickerForm.color.value;
  // console.log("color changed to: " + colorPickerForm.color.value);
  userData[myPeer.id].color = colorPickerForm.color.value;
  socket.emit("color-change", {
    id: myPeer.id,
    color: colorPickerForm.color.value,
  });
});

function createCanvas(userId) {
  const localCanvas = document.createElement("canvas");
  localCanvas.classList.add("canvas");
  localCanvas.id = userId;
  localCanvas.width = 500;
  localCanvas.height = 500;
  pageContainer.insertAdjacentElement("beforeend", localCanvas);

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
  userData[userId].context.lineWidth = 10;
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
