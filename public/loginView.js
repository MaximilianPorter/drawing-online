const usernameForm = document.querySelector(".submit-name-form");
const usernameInputEl = document.getElementById("username-input");
const createPrivateGameBtn = document.querySelector(
  ".btn--create-private-game"
);
const quickMatchBtn = document.querySelector(".btn--quick-match");
const gameSettingsSection = document.querySelector(".section-game-settings");
const gameSettingsForm = document.querySelector(".game-settings-form");
const submitCreatePrivateGameBtn = document.querySelector(
  ".btn--submit-create-game"
);
const gameNameInputEl = document.getElementById("game-name");
const btnCloseGameSettings = document.querySelector(".close-create-game");

const roomErrorEl = document.querySelector(".room-error");
const roomErrorMessageEl = document.querySelector(".room-error--message");

localStorage.removeItem("gameSettings");
let myUsername = localStorage.getItem("username");
usernameInputEl.value = myUsername;

const roomError = localStorage.getItem("roomError");
if (roomError) {
  displayRoomError(roomError);
  localStorage.removeItem("roomError");
}

usernameInputEl.focus();

usernameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  setUsername();

  if (document.activeElement === createPrivateGameBtn)
    gameSettingsSection.classList.remove("settings-hidden");
  else if (document.activeElement === quickMatchBtn) findRandomRoom();
});

// click outside the settings box
gameSettingsSection.addEventListener("mousedown", (e) => {
  if (e.target === gameSettingsSection) {
    // hide game settings section
    gameSettingsSection.classList.add("settings-hidden");
  }
});

submitCreatePrivateGameBtn.addEventListener("click", (e) => {
  e.preventDefault();
  const gameSettings = {
    name: gameSettingsForm.elements["game-name"]?.value,
    password: gameSettingsForm.elements["game-password"]?.value,
    maxPlayers: gameSettingsForm.elements["max-players"].value,
    drawTime: gameSettingsForm.elements["draw-time"].value,
  };
  createRoom(gameSettings);
});

btnCloseGameSettings.addEventListener("click", (e) => {
  // hide game settings section
  gameSettingsSection.classList.add("settings-hidden");
});

function setUsername() {
  myUsername = usernameInputEl.value;
  localStorage.setItem("username", myUsername);
  gameNameInputEl.value = myUsername + "'s game";
}

function createRoom(gameSettings) {
  localStorage.setItem("gameSettings", JSON.stringify(gameSettings));
  document.location.href = "/create-random-room";
}

function findRandomRoom() {
  document.location.href = "/room/find";
}

function displayRoomError(message) {
  roomErrorEl.classList.remove("error-hidden");
  roomErrorMessageEl.textContent = `ERROR: ${message}`;
  setTimeout(() => {
    roomErrorEl.classList.add("error-hidden");
  }, 3000);
}
