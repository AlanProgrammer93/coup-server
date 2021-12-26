const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDb = require('./config/connectDB');
connectDb()

const app = express();

// Config Use
app.use(cors());
app.use(express.json());
app.use('*', express.static('public') );

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
            attackGlobal: 0,
            mazo: ['asesina', 'asesina', 'asesina', 'condesa', 'condesa', 'condesa', 'duque', 'duque', 'duque', 'embajador', 'embajador', 'embajador', 'capitan', 'capitan', 'capitan']
        }
        games.push(newGame)

        var gamesInitial = games.filter(
            (g) => g.state === 'initial'
        );
        socket.broadcast.emit("gameCreated", gamesInitial)
    });

    socket.on("deleteGame", (data) => {
        games = games.filter(
            (u) => u.idGame != data.idGame
        );
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
                existUser[0].connectionId = socket.id
                game[0].gamer.forEach((v) => {
                    socket.to(v.connectionId).emit("getGame", game[0])
                });
                socket.emit("getGame", game[0])
            } else {
                socket.emit("getGame", null)
            }
            
        } catch (error) {
            socket.emit("getGame", null)
        }
    });

    socket.on("getGames", () => {
        var gamesInitial = games.filter(
            (g) => g.state === 'initial' && g.gamer.length < 3
        );
        socket.emit("gameCreated", gamesInitial)
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

        var gamesInitial = games.filter(
            (g) => g.state === 'initial' && g.gamer.length < 3
        );

        socket.broadcast.emit("gameCreated", gamesInitial)
        
        game[0].gamer.forEach((v) => {
            socket.to(v.connectionId).emit("getGame", game[0])
        });
        socket.emit("getGame", game[0])
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

        if(data.card === 'coup') {
            userAttacker[0].money.splice(0, 7)
            socket.to(userAttacked[0].connectionId).emit("coup", atack)

            const msg = `${data.attacker} atacó a ${data.username} con ${data.card}`
            game[0].gamer.filter((u) => u.user !== data.username).forEach((v) => {
                socket.to(v.connectionId).emit("actionOtherUser", msg)
            });
            return
        }

        const msg = `${data.attacker} atacó a ${data.username} con ${data.card}`

        game[0].gamer.filter((u) => u.user !== data.username).forEach((v) => {
            socket.to(v.connectionId).emit("actionOtherUser", msg)
        });

        socket.to(userAttacked[0].connectionId).emit("attacked", atack)
        
    });

    // Functions Cards Global
    socket.on("useCardGlobal", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        game[0].attackGlobal = 1
        
        const atack = {
            attackedBy: data.attacker,
            card: data.card
        }

        game[0].gamer.forEach((v) => {
            socket.to(v.connectionId).emit("attackedGlobal", atack)
        });
    });

    socket.on("useReturnCardAmbassador", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );
        var user = game[0].gamer.filter(
            (u) => u.user == data.user
        );
        user[0].cards = data.cards
        game[0].mazo.push(data.returnCard)

        handleTurn(game[0])
        
        game[0].gamer.forEach((v) => {
            socket.to(v.connectionId).emit("getGame", game[0])
        });
        socket.emit("getGame", game[0])
    });

    // End Functions Cards Global

    socket.on("blockCard", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        var userAttacker = game[0].gamer.filter(
            (u) => u.user == data.attacker
        );

        if(data.card === 'duque') {
            game[0].attackGlobal = 0
        }

        const block = {
            blockedBy: data.blocker,
            card: data.card
        }

        const msg = `${data.blocker} bloqueo a ${data.attacker} con ${data.card}`

        game[0].gamer.filter((u) => u.user !== data.attacker).forEach((v) => {
            socket.to(v.connectionId).emit("actionOtherUser", msg)
        });
        
        socket.to(userAttacker[0].connectionId).emit("blocked", block)
    });

    socket.on("blockCardAttackGlobal", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );

        game[0].attackGlobal = 0
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
                
                if(attacked[0].money.length < 2) {
                    attacked[0].money.pop()
                    attacker[0].money.push(1)
                } else {
                    attacked[0].money.pop()
                    attacked[0].money.pop()
    
                    attacker[0].money.push(1)
                    attacker[0].money.push(1)
                }
                
                handleTurn(game[0])

                game[0].gamer.forEach((v) => {
                    socket.to(v.connectionId).emit("getGame", game[0])
                });
                socket.emit("getGame", game[0])
                break;

            case 'embajador':
                if(game[0].attackGlobal) {
                    var attacker = game[0].gamer.filter(
                        (u) => u.user == data.attackedBy
                    );
                    const newCard = getOneCard(game[0]);
                    attacker[0].cards.push(newCard);
    
                    socket.to(attacker[0].connectionId).emit("descartOneCard", attacker[0])
                    game[0].attackGlobal = 0
                }
                break;
            case 'duque':
                if(game[0].attackGlobal) {
                    var attacker = game[0].gamer.filter(
                        (u) => u.user == data.attackedBy
                    );
                    attacker[0].money.push(1);
                    attacker[0].money.push(1);
                    attacker[0].money.push(1);
    
                    handleTurn(game[0])
    
                    game[0].gamer.forEach((v) => {
                        socket.to(v.connectionId).emit("getGame", game[0])
                    });
                    socket.emit("getGame", game[0])
                    game[0].attackGlobal = 0
                }
                
                break;
            default:
                break;
        }

    });

    socket.on("allowBlock", (data) => {
        var game = games.filter(
            (g) => g.idGame == data.idGame
        );
        game[0].attackGlobal = 0
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
        
        if(loser[0].cards.length === 1) {
            socket.to(loser[0].connectionId).emit("lostGame", game[0])
        }

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

            if(loser[0].connectionId === socket.id) {
                socket.emit("lostGame", game[0])
            } else {
                socket.emit("getGame", game[0])
            }
            
            return
        }

        if(loser[0].connectionId === socket.id) {
            socket.emit("lostGame", game[0])
            socket.to(game[0].gamer[0].connectionId).emit("win", game[0])
        } else {
            socket.emit("win", game[0])
            socket.to(loser[0].connectionId).emit("lostGame", game[0])
        }
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
function getOneCard (game) {
    const card = Math.floor(Math.random() * game.mazo.length);
    const nameCard = game.mazo[card];
    game.mazo.splice(card, 1)
    return nameCard
}
