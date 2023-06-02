// importing required dependencies and modules
const { createServer } = require("http");
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const app = express();

const localUrl = process.env.URL || "http://localhost:3000";
const deployedUrl = "https://Cropposition.netlify.app";


// Local
//app.use(cors());


// Deployed
app.use(
    cors({
        origin: deployedUrl,
    })
);


const PORT = process.env.PORT || 3001;

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: localUrl,
    },
});

// handles socket events
io.on("connection", (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on("join_room", (data) => {
      socket.join(data);
      console.log(`User with ID: ${socket.id} joined room: ${data}`);
    });
  
    // message event ------------------------- will need to add events for game play
    socket.on("send_message", (data) => {
      socket.to(data.room).emit("receive_message", data);
    });
  
    socket.on("disconnect", () => {
      console.log("User Disconnected", socket.id);
    });


});
  
  // starts server
  server.listen(PORT, () => {
    console.log(`listening on ${PORT} 🚀`);
  });
