import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let connections = 0;
let rooms = {}

io.on('connection', (socket) => {
    connections++;
    updateClients();
    updateTerminal();

    socket.on('disconnect', () => {
        connections--;
        updateClients();
        updateTerminal();
    });
});

function updateClients() {
    io.emit('updateCount', connections);
}

function updateTerminal() {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`Active Connections: ${connections}`);
}

// Serve HTML directly
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Connection Count</title>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        document.addEventListener("DOMContentLoaded", () => {
            const socket = io();
            const countDisplay = document.getElementById("count");

            socket.on("updateCount", (count) => {
                countDisplay.innerText = count;
            });
        });
    </script>
</head>
<body>
    <h1>Live Connection Count: <span id="count">0</span></h1>
</body>
</html>`);
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));

