import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import Bullet from "../shared/bullet.js";
import Game from "./game.js";

const app = express();
app.use(express.static('../Client/public'));
const server = http.createServer(app);
const io = new Server(server);

// Queue for matchmaking
const queue = [];

// Active games map
const games = {}; // key: gameId, value: Game instance
let gameIdCounter = 1;

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    queue.push(socket.id);

    // Check if we can start a new game (2 players per game)
    if (queue.length >= 2) {
        const player1Id = queue.shift();
        const player2Id = queue.shift();
        const newGameId = gameIdCounter++;
        const game = new Game(io, [player1Id, player2Id]);
        games[newGameId] = game;

        // Assign game reference to sockets
        io.sockets.sockets.get(player1Id).gameId = newGameId;
        io.sockets.sockets.get(player2Id).gameId = newGameId;

        game.startGame();
        console.log(`Game ${newGameId} started with players: ${player1Id}, ${player2Id}`);
    }

    // Player movement
    socket.on('setMove', (data) => {
        const game = games[socket.gameId];
        if (!game) return;

        const player = game.players[socket.id];
        if (!player) return;

        player.dx = data.dx;
        player.dy = data.dy;
        player.state = 'moving';

        io.to(socket.id).emit('updateMoving', {
            id: socket.id,
            dx: player.dx,
            dy: player.dy,
            state: 'moving'
        });
    });

    // Mouse movement
    socket.on('mouseMove', (data) => {
        const game = games[socket.gameId];
        if (!game) return;
        const player = game.players[socket.id];
        if (player) {
            player.mouseX = data.mouseX;
            player.mouseY = data.mouseY;
        }
    });

    // Shooting
    socket.on('shoot', (data) => {
        const game = games[socket.gameId];
        if (!game) return;

        const bulletId = game.bulletIdCounter++;
        game.bullets[bulletId] = new Bullet(bulletId, data.x, data.y, data.dx, data.dy, socket.id);

        io.emit('newBullet', game.bullets[bulletId]);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Remove from queue if still waiting
        const queueIndex = queue.indexOf(socket.id);
        if (queueIndex !== -1) {
            queue.splice(queueIndex, 1);
        }

        // Remove from game if in one
        const game = games[socket.gameId];
        if (game) {
            delete game.players[socket.id];
            game.endGame(); // Optional: could also handle partially remaining players

            // Remove game if empty
            if (Object.keys(game.players).length === 0) {
                delete games[socket.gameId];
            }
        }

        io.emit('playerDisconnected', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
    console.log('---- Endr Server Stats ----');

    setInterval(() => {
        process.stdout.write(`Connections: ${io.engine.clientsCount}\r`);
    }, 500);
});
