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
        handleTurn(game[0])

        game[0].gamer.forEach((v) => {
            socket.to(v.connectionId).emit("getGame", game[0])
        });
        socket.emit("getGame", game[0])
    });

    socket.on("useCard", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        var userAttacked = game[0].gamer.filter(
            (u) => u.user == data.username
        );
        var userAttacker = game[0].gamer.filter(
            (u) => u.user == data.attacker
        );

        if(data.card === 'asesina') {
            userAttacker[0].money.pop()
            userAttacker[0].money.pop()
            userAttacker[0].money.pop()
        }
        
        const atack = {
            attackedBy: data.attacker,
            card: data.card
        }
        
        socket.to(userAttacked[0].connectionId).emit("attacked", atack)
    });

    socket.on("blockCard", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        var userAttacker = game[0].gamer.filter(
            (u) => u.user == data.attacker
        );

        const block = {
            blockedBy: data.blocker,
            card: data.card
        }
        
        socket.to(userAttacker[0].connectionId).emit("blocked", block)
    });


    socket.on("allow", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        switch (data.card) {
            case 'capitan':
                var attacked = game[0].gamer.filter(
                    (u) => u.user == data.attacked
                );
                var attacker = game[0].gamer.filter(
                    (u) => u.user == data.attackedBy
                );
                // aqui puede fallar si tiene una sola moneda
                attacked[0].money.pop()
                attacked[0].money.pop()

                attacker[0].money.push(1)
                attacker[0].money.push(1)

                handleTurn(game[0])

                game[0].gamer.forEach((v) => {
                    socket.to(v.connectionId).emit("getGame", game[0])
                });
                socket.emit("getGame", game[0])
                break;

            case 'embajador':
                
                break;
            case 'duke':
                
                break;
            default:
                break;
        }

    });
    socket.on("allowBlock", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        handleTurn(game[0])

        game[0].gamer.forEach((v) => {
            socket.to(v.connectionId).emit("getGame", game[0])
        });
        socket.emit("getGame", game[0])

    });

    // LOST CARD
    socket.on("lostCard", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );
        var loser = game[0].gamer.filter(
            (u) => u.user == data.loser
        );
        socket.to(loser[0].connectionId).emit("lostCard")
    });
    socket.on("lostCardSelected", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );
        var loser = game[0].gamer.filter(
            (u) => u.user == data.loser
        );
        // SI SOLO TIENE UNA CARTA DEBE COMUNICAR QUE PERDIO
        /* loser[0].cards = loser[0].cards.filter(
            (c) => c != data.card
        ) */
        loser[0].cards[0] = loser[0].cards.pop(data.card)
        
        handleTurn(game[0])

        game[0].gamer.forEach((v) => {
            socket.to(v.connectionId).emit("getGame", game[0])
        });
        socket.emit("getGame", game[0])
    });


    socket.on("endGame", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );
        var loser = game[0].gamer.filter(
            (u) => u.user == data.loser
        );

        game[0].gamer = game[0].gamer.filter(
            (u) => u.user != data.loser
        );

        if(game[0].gamer.length > 1){
            handleTurn(game[0])
            
            game[0].gamer.forEach((v) => {
                socket.to(v.connectionId).emit("getGame", game[0])
            });

            socket.to(loser[0].connectionId).emit("lostGame", game[0])
            socket.emit("getGame", game[0])
            return
        }
        console.log("HAY GANADOR", game[0]);
        console.log("socketId del ganador", game[0].gamer[0].connectionId);
        console.log(loser[0]);
        socket.to(loser[0].connectionId).emit("lostGame", game[0])
        socket.emit("win", game[0])
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
function handleTurn (game) {
    let nextTurn = game.turnNumber;
    nextTurn = nextTurn + 1
    if(nextTurn < game.gamer.length) {
        game.turnNumber = nextTurn
        game.turn = game.gamer[nextTurn].user
    } else {
        game.turnNumber = 0
        game.turn = game.gamer[0].user
    }
    return game
}
