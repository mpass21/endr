import express from 'express'
import http from 'http'
import { Server } from 'socket.io'

import Bullet from "../shared/bullet.js"
import Game from "./game.js"

const app = express();
app.use(express.static('../Client/public'));
const server = http.createServer(app);
const io = new Server(server);

const game = new Game(io)

io.on('connection', (socket) => {
    game.players[socket.id] = null


    if (!game.gameRunning && io.engine.clientsCount == 2) {
      game.startTimer()
    }

    socket.on('setMove', (data) => {
        let player = game.players[socket.id]
        if (player) {
            player = game.players[socket.id]
            player.dx = data.dx
            player.dy = data.dy
            player.state = 'moving'
            io.emit('updateMoving',{
                id: socket.id,
                dx:player.dx,
                dy:player.dy,
                state:'moving'
            })
        }
    });

    socket.on('disconnect', () => {
        if (game.players[socket.id]) {
            delete game.players[socket.id];
            game.endGame()
        }
        io.emit('playerDisconnected', socket.id);
    });

    socket.on('mouseMove', (data) => {
        let player = game.players[socket.id]
        player.mouseX = data.mouseX
        player.mouseY = data.mouseY
    })

    socket.on('shoot', (data) => {
        const bulletId = game.bulletIdCounter++

        game.bullets[bulletId] = new Bullet(bulletId, data.x, data.y, data.dx, data.dy, socket.id)
        io.emit('newBullet', game.bullets[bulletId])
    })
})


server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
    console.log();
    console.log('---- Endr Server Stats ----');

    // Log the connected client count every second
    setInterval(() => {
        process.stdout.write(`Connections: ${io.engine.clientsCount}\r`)
    },500)
});
