const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDb = require('./config/connectDB');
connectDb()

const app = express();

// Config Use
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));

const PORT = process.env.PORT || 5000
var server = app.listen(PORT, () => console.log(`Server running port ${PORT}`))


// Config Socket
const io = require("socket.io")(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    allowEIO3: true, 
});

var games = [];
io.on("connection", (socket) => {

    /* socket.on("mostrarID", () => {
        console.log("mostrando", socket.id);
        socket.emit("mostrando", socket.id)
    }) */

    socket.on("createGame", (data) => {
        let newGame = {
            idGame: data.idGame,
            gamer: [{
                connectionId: socket.id,
                user: data.username,
                money: [1,1],
                cards: []
            }],
            createdBy: data.username,
            state: 'initial',
            turn: data.username,
            turnNumber: 0,
            mazo: ['asesina', 'asesina', 'asesina', 'condesa', 'condesa', 'condesa', 'duque', 'duque', 'duque', 'embajador', 'embajador', 'embajador', 'capitan', 'capitan', 'capitan']
        }
        games.push(newGame)
        socket.broadcast.emit("gameCreated", games)
    });

    socket.on("getGame", (data) => {
        console.log("datos que llegan al server getGame", data, "games ", games);
        try {
            var game = games.filter(
                (g) => g.idGame == data.idGame
            );

            var existUser = game[0].gamer.filter(
                (u) => u.user == data.username
            );
            
            if(existUser) {
                socket.emit("getGame", game[0])
            } else {
                socket.emit("getGame", null)
            }
            
        } catch (error) {
            socket.emit("getGame", null)
        }
    });

    socket.on("joinGame", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        game[0].gamer.push({
            connectionId: socket.id,
            user: data.username,
            money: [1,1],
            cards: []
        })
        socket.broadcast.emit("gameCreated", games)
    });

    socket.on("startGame", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        // METODO PARA ASIGNAR LAS CARTAS
        getCards(game[0])

        game[0].state = 'progressing';
        game[0].gamer.forEach((v) => {
            socket.to(v.connectionId).emit("getGame", game[0])
        });
        socket.emit("getGame", game[0])
    });

    // ACCIONES DEL JUEGO
    socket.on("takeMoney", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        var existUser = game[0].gamer.filter(
            (u) => u.user == data.username
        );
        existUser[0].money.push(1)

        // metodo next turn
        let nextTurn = game[0].turnNumber;
        nextTurn = nextTurn + 1
        if(nextTurn < game[0].gamer.length) {
            game[0].turnNumber = nextTurn
            game[0].turn = game[0].gamer[nextTurn].user
        } else {
            game[0].turnNumber = 0
            game[0].turn = game[0].gamer[0].user
        }

        game[0].gamer.forEach((v) => {
            socket.to(v.connectionId).emit("getGame", game[0])
        });
        socket.emit("getGame", game[0])
    });

})

function getCards (game) {
    game.gamer.forEach((g) => {
        const card1 = Math.floor(Math.random() * game.mazo.length);
        const nameCard = game.mazo[card1];
        game.mazo.splice(card1, 1)

        const card2 = Math.floor(Math.random() * game.mazo.length);
        const nameCard2 = game.mazo[card2];
        game.mazo.splice(card2, 1)

        g.cards.push(nameCard)
        g.cards.push(nameCard2)
    })
}
