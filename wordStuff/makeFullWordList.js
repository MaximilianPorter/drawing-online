// from https://github.com/nick-aschenbach/game-words/blob/master/assets/game_words/game_words.yaml
const fs = require("fs");
const words = require("./words.json");
const fullWordList = [];
console.log(
  "-------------------------------------------------------------------"
);
Object.values(words).forEach((wordList) => {
  Object.values(wordList).forEach((word) => fullWordList.push(...word));
});

fs.writeFile("./fullWordList.json", JSON.stringify(fullWordList), (err) => {
  if (err) throw err;
  console.log("The file has been saved!");
});
