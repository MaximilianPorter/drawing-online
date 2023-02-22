# DRAWING ONLINE PROJECT

This is a small project I'm working on to get the handles of using socket.io and peerjs

This will probably turn into a battle royale of sorts:

### PLAN

- players in a **room** will get a word prompt and will have **60 seconds** to draw that word
- at the end of 60 seconds all the drawings will be displayed and you'll have the chance to vote
- You can vote for 3 drawings (not your own) with 1st, 2nd, and 3rd
- after the voting is complete, all drawings are given a **voteScore**, everyone with a _voteScore_ of 0 will be eliminated as well as the person with the least _voteScore_
- this will continue until there are 2 players left (players that are eliminated can still vote)
- if enough players disconnect and there's only 2 players left in the room at the end, both players win (because you can't have a winner in votes with 2 people)
