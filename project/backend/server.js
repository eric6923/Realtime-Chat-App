import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "https://backend-socket-io.onrender.com",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());

// Store messages and active users in memory (per room)
const roomMessages = new Map();
const roomUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentRoom = '';
  let currentUsername = '';

  // Handle joining a room
  socket.on('join_room', (data) => {
    try {
      const { room, username } = data;
      
      if (!room || !username) {
        console.error('Invalid join room data:', data);
        return;
      }

      currentRoom = room;
      currentUsername = username;
      
      // Leave previous room if any
      if (socket.rooms.size > 1) {
        const rooms = Array.from(socket.rooms);
        rooms.forEach(r => {
          if (r !== socket.id) socket.leave(r);
        });
      }
      
      socket.join(room);
      
      // Initialize room data if not exists
      if (!roomMessages.has(room)) {
        roomMessages.set(room, []);
      }
      if (!roomUsers.has(room)) {
        roomUsers.set(room, new Set());
      }
      
      // Add user to room
      roomUsers.get(room).add(username);

      // Send message history
      socket.emit('message_history', roomMessages.get(room));

      // Broadcast user joined message
      const joinMessage = {
        id: Date.now().toString(),
        room,
        username: 'System',
        content: `${username} joined the room`,
        timestamp: new Date()
      };
      
      roomMessages.get(room).push(joinMessage);
      io.to(room).emit('receive_message', joinMessage);

      // Log room status
      console.log(`User ${username} joined room ${room}`);
      console.log(`Room ${room} users:`, Array.from(roomUsers.get(room)));
    } catch (error) {
      console.error('Error in join_room:', error);
    }
  });

  // Handle new messages
  socket.on('send_message', (data) => {
    try {
      const { room, username, content } = data;
      
      if (!room || !username || !content) {
        console.error('Invalid message data:', data);
        return;
      }

      const messageData = {
        id: Date.now().toString(),
        room,
        username,
        content,
        timestamp: new Date()
      };
      
      // Store message in memory
      if (roomMessages.has(room)) {
        roomMessages.get(room).push(messageData);
        // Keep only last 50 messages
        if (roomMessages.get(room).length > 50) {
          roomMessages.get(room).shift();
        }
      }

      // Broadcast message to room
      io.to(room).emit('receive_message', messageData);
      console.log(`Message sent in room ${room} by ${username}`);
    } catch (error) {
      console.error('Error in send_message:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    try {
      console.log('User disconnected:', socket.id);
      
      if (currentRoom && currentUsername) {
        // Remove user from room
        const users = roomUsers.get(currentRoom);
        if (users) {
          users.delete(currentUsername);
          
          // Send user left message
          const leftMessage = {
            id: Date.now().toString(),
            room: currentRoom,
            username: 'System',
            content: `${currentUsername} left the room`,
            timestamp: new Date()
          };
          
          if (roomMessages.has(currentRoom)) {
            roomMessages.get(currentRoom).push(leftMessage);
            io.to(currentRoom).emit('receive_message', leftMessage);
          }

          console.log(`User ${currentUsername} left room ${currentRoom}`);
          console.log(`Room ${currentRoom} users:`, Array.from(users));
        }
      }
    } catch (error) {
      console.error('Error in disconnect:', error);
    }
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Error handling for the server
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});