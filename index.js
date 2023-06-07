
// importing required dependencies and modules
const { createServer } = require("http");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const app = express();

const localUrl = process.env.URL || "http://localhost:3000";
const deployedUrl = "https://cropposition.netlify.app";
const PORT = process.env.PORT || 3001;

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

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: localUrl, // need to change to deployedUrl before merging to main
  },
});

// lobby functions
const rooms = {};
//const players = [];
const emitUpdatedPlayers = (room) => {
  io.to(room).emit("players_updated", rooms[room].players);
};

// handles socket events
io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  let board = null;
  let redScore = null;
  let blueScore = null;
  let gameOver = false;
  let winner = null;
  let turn = null;

  // host game
  socket.on("create_room", ({ username, room }) => {
    if (rooms[room] && rooms[room].players && rooms[room].players.length >= 2) {
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

    socket.emit("join_room_success", { host: rooms[room].host });
  });

  // message event
  socket.on("send_message", (data) => {
    const { room, message, author } = data;
    const messageData = { room, message, author };
    socket.to(room).emit("receive_message", messageData);
  });

  // game handlers
  socket.on("player_turn", (data) => {
    turn = data.turn;
  });

  socket.on("update_board", (data) => {
    board = data.updatedBoard;
  });

  socket.on("update_scores", (data) => {
    redScore = data.updatedRedScore;
    blueScore = data.updatedBlueScore;
  });

  socket.on("game_over", (data) => {
    gameOver = true;
    winner = data.winner;
  });

  // start game
  socket.on("start_game", (room) => {
    if (socket.id === rooms[room].host) {
      rooms[room].gameStarted = true;

      io.to(room).emit("game_started");
      io.to(room).emit("update_board", { updatedBoard: board });
      io.to(room).emit("update_scores", { updatedRedScore: redScore, updatedBlueScore: blueScore });
      io.to(room).emit("player_turn", { turn });
    }
  });

  // game play
  socket.on("handle_tile", (data) => {
    const { room, y, x, edges, redScore, blueScore } = data;

    if (gameOver || turn !== socket.id) {
      return;
    }

    board[y][x].edges = edges;
    redScore += redScore;
    blueScore += blueScore;

    io.to(room).emit("update_board", { updatedBoard: board });
    io.to(room).emit("update_scores", { updatedRedScore: redScore, updatedBlueScore: blueScore });

    // end game
    if (gameOver) {
      io.to(room).emit("game_over", { winner });
      // somehow render lobby again
    } else {
      io.to(room).emit("player_turn", { turn });
    }
  });

  socket.on("disconnect", () => {
    const room = Object.keys(rooms).find((room) => {
      const playerIndex = rooms[room].players.findIndex((player) => player.id === socket.id);
      return playerIndex !== -1;
    });

    if (room) {
      const playerIndex = rooms[room].players.findIndex((player) => player.id === socket.id);
      if (playerIndex !== -1) {
        rooms[room].players.splice(playerIndex, 1);
        io.to(room).emit("player_left", { players: rooms[room].players });

        if (rooms[room].players.length === 0) {
          delete rooms[room];
        }
      }
    }
  });
});

// starts server
server.listen(PORT, () => {
  console.log(`listening on ${PORT} 🚀`);
});