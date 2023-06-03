
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
        origin: localUrl,
    },
});

const rooms = {};

// handles socket events
io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    // host game
    socket.on("create_room", ({ username, room }) => {
      if(rooms[room] && rooms[room].players && rooms[room].players.length >= 4) {
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
    });

    // join game
    socket.on("join_room", (data) => {
      const { username, room } = data;
      if (!rooms[room]) {
        socket.emit("room_not_found");
        return;
      }
      if (rooms[room].players.length >= 4) {
        socket.emit("room_full");
        return;
      }
      socket.join(room);
      rooms[room].players.push({ id: socket.id, username });
      console.log(`User with ID: ${socket.id} joined room: ${room}`);
    });
  
    // message event
    socket.on("send_message", (data) => {
      const { room, message } = data;
      socket.to(room).emit("receive_message", message);
    });

    //start game
    socket.on("start_game", (room) => {
      if(socket.id === rooms[room].host) {
        rooms[room].gameStarted = true;
        io.to(room).emit("game_started")
        io.to(room).emit("navigate_to_game");
      }
    })

    // game play

    // end game
  
    socket.on("disconnect", () => {
      console.log("User Disconnected", socket.id);
    });

});
  
  // starts server
  server.listen(PORT, () => {
    console.log(`listening on ${PORT} 🚀`);
  });
