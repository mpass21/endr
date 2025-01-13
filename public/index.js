const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playerWidth = 50
const playerHeight = 100
const playerNorth = new Image()
const gameText = document.getElementById('gameText')

let gameRunning = false

playerNorth.src = '/images/char1North.png'

const playerNorthF = new Image()
playerNorthF.src = '/images/char1NorthF.png'

const playerEast = new Image()
playerEast.src = '/images/char1NorthF.png'

const playerWest = new Image()
playerWest.src = '/images/char1North.png'

const playerSouth = new Image()
playerSouth.src = '/images/char1.png'

const playerSouthF = new Image()
playerSouthF.src = '/images/char1f.png'

const playerMoving = new Image()
playerMoving.src = '/images/char1M.png'

const playerMovingF = new Image()
playerMovingF.src = '/images/char1Mf.png'

// stock image used for uncreated states
const playerStock = new Image()
playerStock.src = '/images/char1.png'

const playerStockF = new Image()
playerStockF.src = '/images/char1f.png'

const hand = new Image()
hand.src = '/images/hand.png'

const handf = new Image()
handf.src = '/images/handf.png'

let players = {};
let bullets = {}
let mouseX = 0; 
let mouseY = 0;


const barrier = {
  x: 800 / 2 - 25,   // Example center position for the barrier
  y: 600 / 2 - 100,  // Example center position for the barrier
  width: 50,              // Barrier width
  height: 200              // Barrier height
};

const platform = {
  x: 0,
  y: canvas.height/2 + playerHeight/2,
  width: 50,
  height: 5,
}

const platform2 = {
  x: canvas.width - platform.width,
  y: platform.y,
  width: platform.width,
  height: platform.height,
}

const draw = ()=> {
  if (!gameRunning) {
    ctx.clearRect(0,0,canvas.width, canvas.height)
    console.log('game not runiing so canvas cleared')
    return
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'black'
  ctx.fillRect(barrier.x, barrier.y, barrier.width, barrier.height)

  ctx.fillStyle = 'black'
  ctx.fillRect(platform.x, platform.y, platform.width, platform.height)

  ctx.fillStyle = 'black'
  ctx.fillRect(platform2.x, platform2.y, platform2.width, platform2.height)
  
  for (const id in bullets) {
    const bullet = bullets[id]
    const player = players[bullet.shotBy]
    
    ctx.beginPath()
    ctx.arc(bullet.x, bullet.y, 10, 0, Math.PI * 2)
    ctx.fillStyle = player.p1? 'red' : 'blue'
    ctx.fill()
    ctx.closePath()
    ctx.fillStyle = 'black'
  }

  for (const id in players) {
    const player = players[id];
    const isFlipped = player.mouseX < player.x + playerWidth / 2
    if (player.id === socket.id) {
      console.log(isFlipped)
    }

    if (player.p1) {
      ctx.fillStyle = 'red'
      ctx.fillText('Player 1', player.x + 2, player.y - 15)
    } else {
      ctx.fillStyle = 'blue'
      ctx.fillText('Player 2', player.x + 2, player.y - 15)
    }

    ctx.fillStyle = 'black'
    switch (player.state) {
      case "north":{
        if (isFlipped) {
          ctx.drawImage(playerNorthF, player.x, player.y, 50, 100)
        } else {
          ctx.drawImage(playerNorth, player.x, player.y, 50, 100)
        }  
        break
      }
      case "east":{
        ctx.drawImage(playerEast, player.x, player.y, 50, 100)
        break
      }
      case "west":{
        ctx.drawImage(playerWest, player.x, player.y, 50, 100)
        break
      }
      case "south": {
        if (isFlipped) {
          ctx.drawImage(playerSouthF, player.x, player.y, 50, 100)
        } else {
          ctx.drawImage(playerSouth, player.x, player.y, 50, 100)
        }  
        break
      }
      case "moving": {
        let curHand = null
        let handY = null

        if (isFlipped) {
          ctx.drawImage(playerMovingF, player.x, player.y, 50, 100)
          curHand = handf

          // adding 20 to account for the width of the hand
          handY = player.y + 50
        } else {
          curHand = hand
          handY = player.y + 30
          ctx.drawImage(playerMoving, player.x, player.y, 50, 100)
        }

        const handX = player.x + playerWidth / 2
        const angle = Math.atan2(mouseY - handY, mouseX - handX)

        ctx.save()
        ctx.translate(handX, handY)
        ctx.rotate(angle)
        ctx.drawImage(curHand, 0, 0, 50, 20)
        ctx.restore()

        break
      }
      default: {
        if (isFlipped) {
          ctx.drawImage(playerStockF, player.x, player.y, 50, 100)
        } else {
          ctx.drawImage(playerStock, player.x, player.y, 50, 100)
        }  
        break
      }
    }
  }
}

canvas.addEventListener("mousedown", () => {
  if (gameRunning) {
    const player = players[socket.id];

    const centerX = player.x + playerWidth / 2
    const centerY = player.y + playerHeight / 2

    const dirX = mouseX - centerX
    const dirY = mouseY - centerY;
    const length = Math.sqrt(dirX * dirX + dirY * dirY);

    const dx = (dirX / length)
    const dy = (dirY / length)
    
    if (player.state !== 'moving') {
      socket.emit('setMove', { dx,dy })
    } else {
      let canShoot = true
      for (const bulletId in bullets) {
        const bullet = bullets[bulletId]
        
        if (bullet.shotBy === socket.id) {
          canShoot = false
          break
        }
      } 
      
      if (canShoot) {
        socket.emit('shoot', { x: centerX + dx * 75, y: centerY + dy * 75, dx, dy, shotBy: socket.id})
      }
    }
  }
});


canvas.addEventListener("mousemove", (event) => {
  if (gameRunning) {
    mouseX = event.clientX - canvas.getBoundingClientRect().left;
    mouseY = event.clientY - canvas.getBoundingClientRect().top;
    socket.emit('mouseMove', { mouseX: mouseX, mouseY: mouseY })
    draw();
  }
});

socket.on('startGame', () => {
  console.log('game started woooo')
  gameRunning = true
  draw()
})

socket.on('endGame', (text) => {
  gameRunning = false
  gameText.innerText = text
  draw()
})

socket.on('timerUpdate',(time) => {
  gameText.innerText = `Game ends in ${time}`
}) 

socket.on('startTimer', (time) => {
  let timerCount = time

  const timerInterval = setInterval(() => {
    gameText.textContent = `Game Starting in ${timerCount}`
    timerCount--
  }, 1000)

  setTimeout(() => {
    clearInterval(timerInterval)
    gameText.innerText = 'Game Started'
  }, (time+1) * 1000)


})

socket.on('currentPlayers', (currentPlayers) => {
  players = { ...currentPlayers };
});

socket.on('newPlayer', (player) => {
  players[player.id] = player;
});

socket.on('newBullet', (bullet) => {
  bullets[bullet.id] = bullet
})

socket.on('deleteBullet', (id) => {
  delete bullets[id]
})

socket.on('bulletMove', (data) => {
  let bullet = bullets[data.id]
  if (!bullet) return 
  bullet.x = data.x
  bullet.y = data.y 
})

socket.on('playerMoved', (data) => {
  const player = players[data.id]
  if (player) {
    player.x = data.x
    player.y = data.y
    player.state = data.state
    player.mouseX = data.mouseX
    player.mouseY = data.mouseY
  }
  draw();
});

socket.on('playerDisconnected', (id) => {
  delete players[id];
  draw()
});

socket.on('serverFull', () => {
  alert('server is full try again later')
})

