const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const playerWidth = 10
const playerHeight = 20

const mapWidth = 600
const mapHeight = 400
let players = {};
let bullets = {}
let bulletIdCounter = 0;

const barrier = {
  x: mapWidth / 2 - 25,   // Example center position for the barrier
  y: mapHeight / 2 - 25,  // Example center position for the barrier
  width: 50,              // Barrier width
  height: 50              // Barrier height
};

const bulletSample = {
  x: 0,
  y: 0,
  radius: 10,
  dx: 0, // Horizontal speed
  dy: 0  // Vertical speed
};

app.use(express.static('public'));

io.on('connection', (socket) => {
  players[socket.id] = { id: socket.id, x: 100, y: 100, dx: 0, dy: 0, moving: false, ball: null};
  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', { id: socket.id, x: 100, y: 100, dx: 0, dy: 0, moving: false, ball: null});

  socket.on('setMove', (data) => {
    if (players[socket.id]) {
      p = players[socket.id]
      p.dx = data.dx
      p.dy = data.dy
      p.moving = true
      io.emit('updateMoving',{
        dx:p.dx,
        dy:p.dy,
        moving:p.moving
      })
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });

  socket.on('shoot', (data) => {
    const bulletId = bulletIdCounter++
    bullets[bulletId] = {
      id: bulletId,
      x: data.x,
      y: data.y,
      radius: 10,
      dx: data.dx, 
      dy: data.dy,
      player: data.player
    };

    io.emit('newBullet',{
      id: bulletId,
      x: data.x,
      y:data.y,
      radious: 10,
      dx: 0,
      dy: 0,
      player: data.player
    })
  })
});

setInterval(() => {
  for (const id in players) {
    const player = players[id];

    if (player.moving) {
      const outOfBounds = player.x <= 0 ||
        player.x + playerWidth >= mapWidth ||
        player.y <= 0 ||
        player.y + playerHeight >= mapHeight;

      const collidesWithBarrier = player.x + player.dx * 4 + playerWidth > barrier.x &&
        player.x + player.dx * 4 < barrier.x + barrier.width &&
        player.y + player.dy * 4 + playerHeight > barrier.y &&
        player.y + player.dy * 4 < barrier.y + barrier.height;

      if (!outOfBounds && !collidesWithBarrier) {
        player.x += player.dx * 5
        player.y += player.dy * 5
      } else {
        if (player.x <= 0) player.x = 1;
        if (player.x + playerWidth >= mapWidth) player.x = mapWidth - playerWidth - 1;
        if (player.y <= 0) player.y = 1;
        if (player.y + playerHeight >= mapHeight) player.y = mapHeight - playerHeight - 1;

        if (collidesWithBarrier) {
          player.x -= player.dx * 5
          player.y -= player.dy * 5
        }
        player.moving = false;  // Stop moving after collision

      }
    io.emit('playerMoved', { id: player.id, x: player.x, y: player.y, moving: player.moving }); 
    }
  }



  // bullet logic
  for (const id in bullets) {
    const bullet = bullets[id]
    
    const outOfBounds = bullet.x <= 0 ||
      bullet.x >= mapWidth ||
      bullet.y <= 0 ||
      bullet.y >= mapHeight;

    if (!outOfBounds) {
      bullet.x += bullet.dx * 5
      bullet.y += bullet.dy * 5
      io.emit('bulletMove', {id, x: bullet.x, y: bullet.y })
    } else {
      delete bullets[id]
      io.emit('deleteBullet', id)
    }
  }
}, 33);

server.listen(3000, () => console.log('Server running on http://localhost:3000'));

