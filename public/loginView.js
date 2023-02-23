const usernameForm = document.querySelector(".submit-name-form");
const usernameInputEl = document.getElementById("username-input");
const createPrivateGameBtn = document.querySelector(
  ".btn--create-private-game"
);
const quickMatchBtn = document.querySelector(".btn--quick-match");
const gameSettingsSection = document.querySelector(".section-game-settings");
const gameSettingsForm = document.querySelector(".game-settings-form");
const submitCreatePrivateGameBtn = document.querySelector(
  ".submit-create-game"
);
const gameNameInputEl = document.getElementById("game-name");
const btnCloseGameSettings = document.querySelector(".close-create-game");

localStorage.removeItem("username");
let username = "";

usernameInputEl.focus();

usernameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  setUsername();

  if (document.activeElement === createPrivateGameBtn)
    gameSettingsSection.classList.remove("settings-hidden");
  else if (document.activeElement === quickMatchBtn) findRandomRoom();
});

// click outside the settings box
gameSettingsSection.addEventListener("click", (e) => {
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
  console.log(gameSettings);
  createRoom();
});

btnCloseGameSettings.addEventListener("click", (e) => {
  // hide game settings section
  gameSettingsSection.classList.add("settings-hidden");
});

function setUsername() {
  username = usernameInputEl.value;
  localStorage.setItem("username", username);
  gameNameInputEl.value = username + "'s game";
}

function createRoom() {
  document.location.href = "/create-random-room";
}

function findRandomRoom() {
  document.location.href = "/room/find";
}
