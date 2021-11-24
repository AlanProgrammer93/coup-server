const mongoose = require("mongoose");

function connectDb() {
    mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('Mongodb connected'))
    .catch(err => console.log('Error ', err))
}

module.exports = connectDb;
