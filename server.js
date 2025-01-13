const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const io = new Server(server);


const startDelay = 3 // seconds
const gameLength = 60// seconds
const playerWidth = 50
const playerHeight = 100
const mapWidth = 800
const mapHeight = 600 

let players = {};
let bullets = {}
let bulletIdCounter = 0;
let gameRunning = false
let gameInterval = null
let startTimeout = null
let endTimeout = null
let connections = 0

const barrier = {
  x: mapWidth / 2 - 25,   // Example center position for the barrier
  y: mapHeight / 2 - 100,  // Example center position for the barrier
  width: 50,              // Barrier width
  height: 200,             // Barrier height
  name: 'barrier'
};


const platform = {
  x: 0,
  y: mapHeight/2 + playerHeight/2,
  width: 50,
  height: 5,
  name: 'platform'
}

const platform2 = {
  x: mapWidth - platform.width,
  y: platform.y,
  width: platform.width,
  height: platform.height,
  name: 'platform2'
}

const gameObjs = [
  barrier,
  platform,
  platform2
]

const playerCollision = (player) => {
  for (let i = 0; i < gameObjs.length; i++) {
    let o = gameObjs[i]
    if (
      player.x + playerWidth > o.x &&
      player.x < o.x + o.width &&
      player.y + playerHeight > o.y &&
      player.y < o.y + o.height
    ) {
      return o.name
    }
  }
  return null
}

const getPlayerCenter = (player) => {
  return [
    player.x + playerWidth / 2,
    player.y + playerHeight / 2
  ]
}

const startTimer = () => {
  let timer = gameLength
  io.emit('startTimer', startDelay)

  setTimeout(() => {
    startGame()
    let endGameTimer = setInterval(() => {
      io.emit('timerUpdate', timer)
      timer--
    }, 1000)

    startTimeout = setTimeout(() => {
      clearInterval(endGameTimer)
      endGame('Game ended due to time')
    }, (gameLength + 1) * 1000) 
    
  }, (startDelay + 1) * 1000)
}


const bulletCollidesHorizontal = (bullet, obj) => {
  const overLapTop = Math.abs(bullet.y - obj.y)
  const overLapBottom = Math.abs(bullet.y - (obj.y + obj.height))
  const overLapRight = Math.abs(bullet.x - (obj.x + obj.width))
  const overLapLeft = Math.abs(bullet.x - obj.x)
  const smallestOverlap = Math.min(overLapTop, overLapBottom, overLapRight, overLapLeft)

  if (bullet.x < 0 || bullet.x > mapWidth) {
    return false
  } else if (bullet.y > mapHeight || bullet.y < 0){
    return true
  }

  if (smallestOverlap === overLapBottom || smallestOverlap === overLapTop) {
    return true 
  } else {
    return false
  }
};

const bulletCollidesWithPlayer = (bullet, player) => {
  const distX = bullet.x - Math.max(player.x, Math.min(bullet.x, player.x + playerWidth));
  const distY = bullet.y - Math.max(player.y, Math.min(bullet.y, player.y + playerHeight));

  const distance = Math.sqrt(distX * distX + distY * distY);

  if (distance < bullet.radius) {
    return true
  }
  return false
}

const stopAndUpdateState = (player) => {
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
}  

const updateGameState = () => {
  io.emit('gameState', gameRunning)
}

io.on('connection', (socket) => {
  players[socket.id] = null
  connections++
  
  if (!gameRunning && connections === 2) {
    startTimer()
  }
  
  socket.on('setMove', (data) => {
    let p = players[socket.id]
    if (p) {
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
    if (players[socket.id]) {
      delete players[socket.id];
      connections--
      endGame()
    }
    io.emit('playerDisconnected', socket.id);
  });

  socket.on('mouseMove', (data) => {
    let p = players[socket.id]
    p.mouseX = data.mouseX
    p.mouseY = data.mouseY
  })

  socket.on('shoot', (data) => {
    const bulletId = bulletIdCounter++
    let bullet = {
      id: bulletId,
      x: data.x,
      y: data.y,
      radius: 10,
      dx: data.dx, 
      dy: data.dy,
      shotBy: socket.id,
      ttl: 2
    };

    bullets[bulletId] = bullet
    io.emit('newBullet', bullet)
  })
})

const endGame = (text) => {
  gameRunning = false
  clearTimeout(startTimeout)
  clearTimeout(endTimeout)
  clearInterval(gameInterval)

  for (const id in players) {
    players[id] = null
  }

  io.emit('endGame', text)
  updateGameState()
}

const startGame = () => {
  let pList = Object.keys(players)
  // player 1
  players[pList[0]] = { id: pList[0], x: 10, y: mapHeight/2 - playerHeight/2 - 3, dx: 0, dy: 0, mouseX:0, mouseY:0, ball: null, state: '', p1: true};

  // player 2
  players[pList[1]] = { id: pList[1], x: mapWidth - playerWidth - 10 , y: mapHeight/2 - playerHeight/2 - 3, dx: 0, dy: 0, mouseX:0, mouseY:0, ball: null, state: '', p1: false};
  gameRunning = true
  io.emit('currentPlayers', players)
  io.emit('startGame')

  gameInterval = setInterval(() => {
    for (const id in players) {
      const player = players[id]
      if (player.p1 && player.x >= mapWidth) {
        endGame('Player one is the winner!')
      } else if (!player.p1 && player.x < 0) { 
        endGame('Player two is the winner!')
      }

    }
    for (const id in players) {
      const player = players[id];
      const collides = playerCollision(player)
      
      if (player.state === 'moving') {
        const outOfBounds = player.x <= 0 ||
          player.x + playerWidth >= mapWidth ||
          player.y <= 0 ||
          player.y + playerHeight >= mapHeight;

        if (!outOfBounds && !collides) {
          player.x += player.dx * 5
          player.y += player.dy * 5

        } else {
          if (player.x <= 0) player.x = 1;
          if (player.x + playerWidth >= mapWidth) player.x = mapWidth - playerWidth - 1;
          if (player.y <= 0) player.y = 1;
          if (player.y + playerHeight >= mapHeight) player.y = mapHeight - playerHeight - 1;

          if (collides) {
            player.x -= player.dx * 5
            player.y -= player.dy * 5
          }
          stopAndUpdateState(player)
        }
      }
      io.emit('playerMoved', { id: player.id, x: player.x, y: player.y, mouseX: player.mouseX, mouseY: player.mouseY, state: player.state}); 
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

      // bullet hit with player
      for (const id in players) {
        const p = players[id]

        if (bulletCollidesWithPlayer(bullet, p)) {
          const [centerX, centerY] = getPlayerCenter(p)

          const dirX = centerX - bullet.x
          const dirY = centerY - bullet.y

          const magnitude = Math.sqrt(dirX * dirX + dirY * dirY)
          p.dx = dirX / magnitude 
          p.dy = dirY / magnitude 
          bullet.ttl = 0
        }
      }
      
      if (collidesWithBarrier || outOfBounds) {
        if (bulletCollidesHorizontal(bullet, barrier)) {
          bullet.dy = -bullet.dy
        } else {
          bullet.dx = -bullet.dx
        }
        bullet.ttl--
      } 
   

      if (bullet.ttl < 1 ) {
        delete bullets[id]
        io.emit('deleteBullet', id)
      } else {
        bullet.x += bullet.dx * 9
        bullet.y += bullet.dy * 9
        io.emit('bulletMove', {id, x: bullet.x, y: bullet.y })
      }
    }
  }, 33);
}

server.listen(3000, () => console.log('Server running on http://localhost:3000'))
