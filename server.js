const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const playerWidth = 50
const playerHeight = 100

const mapWidth = 800
const mapHeight = 600
let players = {};
let bullets = {}
let bulletIdCounter = 0;

const barrier = {
  x: mapWidth / 2 - 25,   // Example center position for the barrier
  y: mapHeight / 2 - 50,  // Example center position for the barrier
  width: 50,              // Barrier width
  height: 100              // Barrier height
};

const bulletSample = {
  x: 0,
  y: 0,
  radius: 10,
  dx: 0, // Horizontal speed
  dy: 0  // Vertical speed
};


function bulletCollides(bullet) {
  // Check each player for a potential collision
  for (let id in players) {
    let player = players[id];

    // Check if the bullet collides with the player
    const distX = bullet.x - Math.max(player.x, Math.min(bullet.x, player.x + playerWidth));
    const distY = bullet.y - Math.max(player.y, Math.min(bullet.y, player.y + playerHeight));

    // Calculate the distance between the bullet and the player (including bullet radius)
    const distance = Math.sqrt(distX * distX + distY * distY);

    // If the distance between the bullet's center and the player is less than the bullet's radius, it's a collision
    if (distance < bullet.radius && bullet.shotBy != player.id) {
      console.log('collision');
      // Handle the collision logic (e.g., removing the bullet, damaging the player, etc.)
    }
  }
}

//call this function when player movement state changes to update image

function stopAndUpdateState(player) {
  player.state = 'stopped'  
    if (player.x < 2) {
    player.state = 'west';
  } else if (player.x + playerWidth > mapWidth - 2) {
    player.state = 'east';
  } else if (player.y < 2) {
    player.state = 'north';
  } else if (player.y + playerHeight > mapHeight - 2) {
    player.state = 'south';
  }
  
  io.emit('updatePlayerState', { id: player.id, state: player.state });
}
app.use(express.static('public'));

io.on('connection', (socket) => {
  players[socket.id] = { id: socket.id, x: 100, y: 100, dx: 0, dy: 0, ball: null, state: ''};
  socket.emit('currentPlayers', players)
  io.emit('newPlayer', players[socket.id])
  
  socket.on('setMove', (data) => {
    if (players[socket.id]) {
      p = players[socket.id]
      p.dx = data.dx
      p.dy = data.dy
      p.state = 'moving'
      io.emit('updateMoving',{
        id: socket.id,
        dx:p.dx,
        dy:p.dy,
        state:'moving'
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
      shotBy: socket.id
    };

    io.emit('newBullet',{
      id: bulletId,
      x: data.x,
      y:data.y,
      radius: 10,
      dx: data.dx,
      dy: data.dy,
      shotBy: socket.id
    })
  })
});

setInterval(() => {
  for (const id in players) {
    const player = players[id];

    if (player.state === 'moving') {
      const outOfBounds = player.x <= 0 ||
        player.x + playerWidth >= mapWidth ||
        player.y <= 0 ||
        player.y + playerHeight >= mapHeight;

      const collidesWithBarrier = player.x + playerWidth > barrier.x &&
        player.x < barrier.x + barrier.width &&
        player.y + playerHeight > barrier.y &&
        player.y < barrier.y + barrier.height;

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
        stopAndUpdateState(player)
      }
    io.emit('playerMoved', { id: player.id, x: player.x, y: player.y }); 
    }
  }



  // bullet logic
  for (const id in bullets) {
    const bullet = bullets[id]
    
    const outOfBounds = bullet.x <= 0 ||
      bullet.x >= mapWidth ||
      bullet.y <= 0 ||
      bullet.y >= mapHeight;

    const collidesWithBarrier = bullet.x + bullet.dx * 4 > barrier.x &&
      bullet.x + bullet.dx * 4 < barrier.x + barrier.width &&
      bullet.y + bullet.dy * 4 > barrier.y &&
      bullet.y + bullet.dy * 4 < barrier.y + barrier.height;


    bulletCollides(bullet)


    if (!outOfBounds && !collidesWithBarrier) {
      bullet.x += bullet.dx * 9
      bullet.y += bullet.dy * 9
      io.emit('bulletMove', {id, x: bullet.x, y: bullet.y })
    } else {
      delete bullets[id]
      io.emit('deleteBullet', id)
    }

  }
}, 33);

server.listen(3000, () => console.log('Server running on http://localhost:3000'));

