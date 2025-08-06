const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));
app.listen(PORT, () => console.log(`App started at http://localhost:${PORT}`))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/frontend/index.html');
});