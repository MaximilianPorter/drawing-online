class GameSettings {
  gameStarted = false;
  countdownTime = 10;
  gamePhase = "lobby";

  constructor(
    privateRoom = false,
    name = "Public Lobby",
    maxPlayers = 20,
    drawTime = 60,
    votingTime = 60
  ) {
    this.privateRoom = privateRoom;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.drawTime = drawTime;
    this.votingTime = votingTime;
  }
}

// Export the GameSettings class using CommonJS module syntax for Node.js
if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = GameSettings;
}

// "Export" the GameSettings class using ES6 module syntax for frontend scripts
if (typeof window !== "undefined") {
  window.GameSettings = GameSettings;
}
