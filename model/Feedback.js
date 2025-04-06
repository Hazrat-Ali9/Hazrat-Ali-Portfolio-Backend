const mongoose = require('mongoose')
// fadebook js
const schema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    ratings: {
        type: Number,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    photoURL: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
})

const Feedback = mongoose.model('Feedback', schema)

module.exports = Feedback