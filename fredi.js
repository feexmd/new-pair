// fredi.js
const express = require('express');
const app = express();
__path = process.cwd();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let server = require('./qr'),
    code = require('./pair');
require('events').EventEmitter.defaultMaxListeners = 500;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/qr', server);
app.use('/code', code);

app.get('/pair', async (req, res) => {
    res.sendFile(__path + '/pair.html');
});

app.get('/', async (req, res) => {
    res.sendFile(__path + '/main.html');
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║    🚀 FEE XMD BOT SERVER 🚀         ║
║                                      ║
║    Server running on:                ║
║    http://localhost:${PORT}           ║
║                                      ║
║    ✨ Created by Fredi AI Tech       ║
╚══════════════════════════════════════╝
`);
});

module.exports = app;