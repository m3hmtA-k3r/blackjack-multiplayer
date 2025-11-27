const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
  });
});

// Start server
server.listen(port, () => {
  console.log(`🎰 Blackjack server listening on http://localhost:${port}`);
});
