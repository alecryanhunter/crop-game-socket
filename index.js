
// importing required dependencies and modules
const { createServer } = require("http");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const app = express();

const localUrl = process.env.URL || "http://localhost:3000";
const deployedUrl = "https://cropposition.netlify.app";


// Local
app.use(cors());

/*
// Deployed
app.use(
    cors({
        origin: deployedUrl,
    })
);
*/

const PORT = process.env.PORT || 3001;

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: localUrl, // need to change to deployedUrl before merging to main
    },
});

const rooms = {};

const emitUpdatedPlayers = (room) => {
  io.to(room).emit("players_updated", rooms[room].players);
};

// handles socket events
io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    let playerTurn = null;
    let board = null;
    let scores = null;
    let gameOver = false;
    let winner = null;

    // host game
    socket.on("create_room", ({ username, room }) => {
      if(rooms[room] && rooms[room].players && rooms[room].players.length >= 2) {
        socket.emit("room_full");
        return;
      }

      rooms[room] = {
        host: socket.id,
        players: [{ id: socket.id, username }],
        gameStarted: false,
      };

      socket.join(room);
      console.log(`user with ID: ${socket.id} created and joined room: ${room}`);

      socket.emit("host_registered", { host: socket.id });
      console.log(rooms[room].host);

      emitUpdatedPlayers(room);
    });

    // join game
    socket.on("join_room", (data) => {
      const { username, room } = data;
      if (!rooms[room]) {
        socket.emit("room_not_found");
        return;
      }
      if (rooms[room].players.length >= 2) {
        socket.emit("room_full");
        return;
      }
      
      socket.join(room);
      rooms[room].players.push({ id: socket.id, username });
      console.log(`User with ID: ${socket.id} joined room: ${room}`);

      emitUpdatedPlayers(room);
    });
  
    // message event
    socket.on("send_message", (data) => {
      const { room, message, author } = data;
      const messageData = { room, message, author }
      socket.to(room).emit("receive_message", messageData);
    });

    //start game
    socket.on("start_game", (room) => {
      if(socket.id === room.host) {
        rooms[room].gameStarted = true;

        playerTurn = 1;
        board = initializeBoard();
        scores = [0, 0];

        io.to(room).emit("game_started")
        io.to(room).emit("navigate_to_game");
        io.to(room).emit("player_turn", playerTurn);
        io.to(room).emit("update_board", board);
        io.to(room).emit("update_scores", scores);
      }
    });

    // game play
    socket.on("handle_tile", (data) => {
      const { room, y, x } = data;

      if (gameOver || playerTurn !== socket.id) {
        return;
      }
  
      if (isValidMove(board, y, x)) { 
        makeMove(board, y, x, playerTurn); 
        const pointsScored = calculatePointsScored(board); 
        scores[playerTurn - 1] += pointsScored;
  
        playerTurn = getNextPlayerTurn(playerTurn); 

        io.to(room).emit("player_turn", playerTurn);
        io.to(room).emit("update_board", board);
        io.to(room).emit("update_scores", scores);
  
        // end game
        if (isGameOver(board)) { 
          gameOver = true;
          winner = calculateWinner(scores); 

          io.to(room).emit("game_over", winner);
        }
      }
    });
  
    socket.on("disconnect", () => {
      console.log("User Disconnected", socket.id);
    });

});
  
  // starts server
  server.listen(PORT, () => {
    console.log(`listening on ${PORT} 🚀`);
  });
