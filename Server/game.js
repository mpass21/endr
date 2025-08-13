import Player from "../shared/player.js";
import Barrier from "../shared/barrier.js";
import Collisions from "../shared/collisions.js";

export default function Game(io, playerIds) {
    this.io = io;
    this.startDelay = 3; // seconds
    this.gameLength = 60; // seconds
    this.playerWidth = 50;
    this.playerHeight = 100;
    this.mapWidth = 800;
    this.mapHeight = 600;

    this.players = {};
    this.bullets = {};
    this.bulletIdCounter = 0;
    this.gameRunning = false;
    this.gameInterval = null;
    this.startTimeout = null;
    this.endTimeout = null;

    this.playerIds = playerIds;

    this.startTimer = function() {
        let timer = this.gameLength;

        // Notify players the game will start soon
        this.playerIds.forEach(id => {
            const socket = this.io.sockets.sockets.get(id);
            if (socket) socket.emit('startTimer', this.startDelay);
        });

        setTimeout(() => {
            this.startGame();

            const endGameTimer = setInterval(() => {
                this.playerIds.forEach(id => {
                    const socket = this.io.sockets.sockets.get(id);
                    if (socket) socket.emit('timerUpdate', timer);
                });
                timer--;
            }, 1000);

            this.startTimeout = setTimeout(() => {
                clearInterval(endGameTimer);
                this.endGame('Game ended due to time');
            }, (this.gameLength + 1) * 1000);

        }, (this.startDelay + 1) * 1000);
    };

    this.updateGameState = () => {
        this.playerIds.forEach(id => {
            const socket = this.io.sockets.sockets.get(id);
            if (socket) socket.emit('gameState', this.gameRunning);
        });
    };

    this.startGame = function () {
        const collisions = new Collisions(this.mapWidth, this.mapHeight);

        const barrier = new Barrier(this.mapWidth / 2 - 25, this.mapHeight / 2 - 100, 50, 200);
        const platform = new Barrier(0, this.mapHeight / 2 + this.playerHeight / 2, 50, 5);
        const platform2 = new Barrier(this.mapWidth - platform.width, platform.y, 50, 5);

        collisions.addGameObject(barrier);
        collisions.addGameObject(platform);
        collisions.addGameObject(platform2);

        const [p1Id, p2Id] = this.playerIds;
        this.players[p1Id] = new Player(p1Id, 10, this.mapHeight / 2 - this.playerHeight / 2 - 3, true);
        this.players[p2Id] = new Player(p2Id, this.mapWidth - this.playerWidth - 10, this.mapHeight / 2 - this.playerHeight / 2 - 3, false);

        this.gameRunning = true;

        // Notify only the players in this game
        this.playerIds.forEach(id => {
            const socket = this.io.sockets.sockets.get(id);
            if (socket) {
                socket.emit('currentPlayers', this.players);
                socket.emit('startGame');
            }
        });

        this.gameInterval = setInterval(() => {
            // Check win condition
            for (const id in this.players) {
                const player = this.players[id];
                if (player.p1 && player.x >= this.mapWidth) this.endGame('Player one is the winner!');
                if (!player.p1 && player.x < 0) this.endGame('Player two is the winner!');
            }

            // Update player positions
            for (const id in this.players) {
                const player = this.players[id];
                if (player.state === 'moving') {
                    if (collisions.outOfBounds(player)) {
                        if (player.x <= 0) player.x = 1;
                        if (player.x + this.playerWidth >= this.mapWidth) player.x = this.mapWidth - this.playerWidth - 1;
                        if (player.y <= 0) player.y = 1;
                        if (player.y + this.playerHeight >= this.mapHeight) player.y = this.mapHeight - this.playerHeight - 1;
                        collisions.stopPlayer(player);
                    } else if (collisions.playerCollision(player)) {
                        player.x -= player.dx * 5;
                        player.y -= player.dy * 5;
                        collisions.stopPlayer(player);
                    } else {
                        player.x += player.dx * 5;
                        player.y += player.dy * 5;
                    }
                }

                // Emit to only players in this game
                this.playerIds.forEach(pid => {
                    const socket = this.io.sockets.sockets.get(pid);
                    if (socket) socket.emit('playerMoved', player);
                });
            }

            // Update bullets
            for (const id in this.bullets) {
                const bullet = this.bullets[id];

                const outOfBounds = collisions.outOfBounds(bullet);
                const collidesWithBarrier = collisions.playerCollision(bullet);

                for (const pid in this.players) {
                    const player = this.players[pid];
                    if (collisions.bulletCollidesWithPlayer(bullet, player)) {
                        const [centerX, centerY] = player.center;
                        const dirX = centerX - bullet.x;
                        const dirY = centerY - bullet.y;
                        const magnitude = Math.sqrt(dirX * dirX + dirY * dirY);
                        player.dx = dirX / magnitude;
                        player.dy = dirY / magnitude;
                        bullet.ttl = 0;
                    }
                }

                if (collidesWithBarrier || outOfBounds) {
                    if (collisions.bulletCollidesHorizontal(bullet, barrier)) {
                        bullet.dy = -bullet.dy;
                    } else {
                        bullet.dx = -bullet.dx;
                    }
                    bullet.ttl--;
                }

                if (bullet.ttl < 1) {
                    delete this.bullets[id];
                    this.playerIds.forEach(pid => {
                        const socket = this.io.sockets.sockets.get(pid);
                        if (socket) socket.emit('deleteBullet', id);
                    });
                } else {
                    bullet.x += bullet.dx * 9;
                    bullet.y += bullet.dy * 9;
                    this.playerIds.forEach(pid => {
                        const socket = this.io.sockets.sockets.get(pid);
                        if (socket) socket.emit('bulletMove', { id, x: bullet.x, y: bullet.y });
                    });
                }
            }
        }, 33);
    };

    this.endGame = function(text) {
        this.gameRunning = false;
        clearTimeout(this.startTimeout);
        clearTimeout(this.endTimeout);
        clearInterval(this.gameInterval);

        for (const id in this.players) {
            this.players[id] = null;
        }

        this.playerIds.forEach(id => {
            const socket = this.io.sockets.sockets.get(id);
            if (socket) socket.emit('endGame', text);
        });

        this.updateGameState();
    };
}
