import express from 'express'
import http from 'http'
import { Server } from 'socket.io'

const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const io = new Server(server);

// Game engine related import below
import Player from "./shared/player.js"
import Bullet from "./shared/bullet.js"
import Barrier from "./shared/barrier.js"
import Collisions from "./shared/collisions.js"

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


// creating the collision manager, storing game height and width
const collisions = new Collisions(mapWidth, mapHeight)

// adding game objects to the collision manager
const barrier = new Barrier(mapWidth / 2 - 25, mapHeight / 2 - 100, 50, 200,)
const platform = new Barrier( 0, mapHeight/2 + playerHeight/2, 50, 5 )
const platform2 = new Barrier(mapWidth - platform.width, platform.y, 50, 5)

collisions.addGameObject(barrier)
collisions.addGameObject(platform)
collisions.addGameObject(platform2)

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

        bullets[bulletId] = new Bullet(bulletId, data.x, data.y, data.dx, data.dy, socket.id)
        io.emit('newBullet', bullets[bulletId])
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

    players[pList[0]] = new Player(pList[0], 10, mapHeight/2 - playerHeight/2 - 3, true)

    players[pList[1]] = new Player(pList[1], mapWidth - playerWidth - 10 ,mapHeight/2 - playerHeight/2 - 3, false)

    gameRunning = true
    io.emit('currentPlayers', players)
    io.emit('startGame')

    gameInterval = setInterval(() => {

        // checking for the win condtion of the game
        for (const id in players) {
            const player = players[id]
            if (player.p1 && player.x >= mapWidth) {
                endGame('Player one is the winner!')
            } else if (!player.p1 && player.x < 0) { 
                endGame('Player two is the winner!')
            }
        }
        
        // this first for loop handles updating the players for collisions
        for (const id in players) {
            const player = players[id];

            if (player.state === 'moving') {

                // if out of bounds player snaps to border
                if (collisions.outOfBounds(player)) {
                    if (player.x <= 0) player.x = 1;
                    if (player.x + playerWidth >= mapWidth) player.x = mapWidth - playerWidth - 1;
                    if (player.y <= 0) player.y = 1;
                    if (player.y + playerHeight >= mapHeight) player.y = mapHeight - playerHeight - 1;
                    collisions.stopPlayer(player)

                // if colides with object player moves back and stops outside of object
                } else if (collisions.playerCollision(player)){
                    player.x -= player.dx * 5
                    player.y -= player.dy * 5
                    collisions.stopPlayer(player)

                // player moves if there is no collision
                } else {
                    player.x += player.dx * 5
                    player.y += player.dy * 5
                }
            }

            io.emit('playerMoved', player); 
        }

        // bullet logic
        for (const id in bullets) {
            const bullet = bullets[id]

            const outOfBounds = collisions.outOfBounds(bullet) 
            const collidesWithBarrier = collisions.playerCollision(bullet)

            // checking if bullet collides with every player
            for (const id in players) {
                const player = players[id]

                if (collisions.bulletCollidesWithPlayer(bullet, player)) {
                    const [centerX, centerY] = player.center

                    const dirX = centerX - bullet.x
                    const dirY = centerY - bullet.y

                    const magnitude = Math.sqrt(dirX * dirX + dirY * dirY)
                    player.dx = dirX / magnitude 
                    player.dy = dirY / magnitude 
                    bullet.ttl = 0
                }
            }

            // checking if bullet hits walls or objects
            if (collidesWithBarrier || outOfBounds) {
                if (collisions.bulletCollidesHorizontal(bullet, barrier)) {
                    bullet.dy = -bullet.dy
                } else {
                    bullet.dx = -bullet.dx
                }
                bullet.ttl--
            } 

            // if the bullet has no lifes left delete, otherwise move
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
