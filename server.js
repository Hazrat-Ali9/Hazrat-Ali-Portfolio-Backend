const express = require('express')
const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')
const cors = require('cors')
const mongoose = require('mongoose')
const app = express()
app.use(bodyParser.json())
app.use(cors())
require('dotenv').config()

const mail = 'hazrataliein@gmail.com';
const password = 'abvk dimq kzxk fulk';

const transporter = nodemailer.createTransport({
    service: 'Gmail', // Use the email service you prefer (e.g., 'Outlook', 'Yahoo', etc.)
    auth: {
        user: mail,
        pass: password
    },
});

transporter.verify(function (error, success) {
    if (error) {
        console.log(error);
    } else {
        console.log("Server is ready to take our messages");
    }
});

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Get the default connection
const db = mongoose.connection;

// Bind connection to error event
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// Bind connection to open event
db.once('open', function () {
    console.log('Connected to MongoDB');

    // Your code here, e.g., define and use Mongoose models
});

app.post('/send', (req, res) => {
    const data = req.body;
    // console.log(data)
    // required Data in body: email, subject, text
    const mailOptions = {
        from: mail,
        to: 'hazrataliein@gmail.com',
        subject: data.subject,
        text: `You have rechived a new message from ${data.name} \n\n Message: ${data.message} \n\n Reply to: ${data.email}`,
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            res.send({ not_sent: error, status: "!sent" })
        } else {
            // console.log(info.response);
            res.send({ Email_sent: info.response, status: "sent" })
        }
    });
});

app.get('/', (req, res) => {
    res.send({ status: "Server Is Running" })
})

app.use('/feedback', require('./routes/feedback'))

app.listen(8000, () => {
    console.log("Server Is Running")
})