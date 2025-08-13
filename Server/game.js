import Player from "../shared/player.js"
import Barrier from "../shared/barrier.js"
import Collisions from "../shared/collisions.js"

export default function Game(io) {
    this.io = io
    this.startDelay = 3 // seconds
    this.gameLength = 60// seconds
    this.playerWidth = 50
    this.playerHeight = 100
    this.mapWidth = 800
    this.mapHeight = 600 

    this.players = {};
    this.bullets = {}
    this.bulletIdCounter = 0;
    this.gameRunning = false
    this.gameInterval = null
    this.startTimeout = null
    this.endTimeout = null
    this.connections = 0

    this.startTimer = function() {
        let timer = this.gameLength
        this.io.emit('startTimer', this.startDelay)

        setTimeout(() => {
            this.startGame()
            let endGameTimer = setInterval(() => {
                this.io.emit('timerUpdate', timer)
                timer--
            }, 1000)

            this.startTimeout = setTimeout(() => {
                clearInterval(endGameTimer)
                this.endGame('Game ended due to time')
            }, (this.gameLength + 1) * 1000) 

        }, (this.startDelay + 1) * 1000)
    }

    this.updateGameState = () => {
        this.io.emit('gameState', this.gameRunning)
    }


    this.startGame = function () {

        // creating the collision manager, storing game height and width
        const collisions = new Collisions(this.mapWidth, this.mapHeight)

        // adding game objects to the collision manager
        const barrier = new Barrier(this.mapWidth / 2 - 25, this.mapHeight / 2 - 100, 50, 200,)
        const platform = new Barrier(0, this.mapHeight/2 + this.playerHeight/2, 50, 5 )
        const platform2 = new Barrier(this.mapWidth - platform.width, platform.y, 50, 5)

        collisions.addGameObject(barrier)
        collisions.addGameObject(platform)
        collisions.addGameObject(platform2)

        // creating the players
        let pList = Object.keys(this.players)

        this.players[pList[0]] = new Player(pList[0], 10, this.mapHeight/2 - this.playerHeight/2 - 3, true)

        this.players[pList[1]] = new Player(pList[1], this.mapWidth - this.playerWidth - 10 ,this.mapHeight/2 - this.playerHeight/2 - 3, false)

        this.gameRunning = true
        this.io.emit('currentPlayers', this.players)
        this.io.emit('startGame')

        this.gameInterval = setInterval(() => {

            // checking for the win condtion of the game
            for (const id in this.players) {
                const player = this.players[id]
                if (player.p1 && player.x >= this.mapWidth) {
                    this.endGame('Player one is the winner!')
                } else if (!player.p1 && player.x < 0) { 
                    this.endGame('Player two is the winner!')
                }
            }

            // this first for loop handles updating the players for collisions
            for (const id in this.players) {
                const player = this.players[id];

                if (player.state === 'moving') {

                    // if out of bounds player snaps to border
                    if (collisions.outOfBounds(player)) {
                        if (player.x <= 0) player.x = 1;
                        if (player.x + this.playerWidth >= this.mapWidth) player.x = this.mapWidth - this.playerWidth - 1;
                        if (player.y <= 0) player.y = 1;
                        if (player.y + this.playerHeight >= this.mapHeight) player.y = this.mapHeight - this.playerHeight - 1;
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

                this.io.emit('playerMoved', player); 
            }

            // bullet logic
            for (const id in this.bullets) {
                const bullet = this.bullets[id]

                const outOfBounds = collisions.outOfBounds(bullet) 
                const collidesWithBarrier = collisions.playerCollision(bullet)

                // checking if bullet collides with every player
                for (const id in this.players) {
                    const player = this.players[id]

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
                    delete this.bullets[id]
                    this.io.emit('deleteBullet', id)

                } else {
                    bullet.x += bullet.dx * 9
                    bullet.y += bullet.dy * 9
                    this.io.emit('bulletMove', {id, x: bullet.x, y: bullet.y })
                }
            }
        }, 33);
    }

    this.endGame = function(text) {
        this.gameRunning = false
        clearTimeout(this.startTimeout)
        clearTimeout(this.endTimeout)
        clearInterval(this.gameInterval)

        for (const id in this.players) {
            this.players[id] = null
        }

        this.io.emit('endGame', text)
        this.updateGameState()
    }
}

