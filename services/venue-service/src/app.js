const express = require('express');
const cors = require('cors');
const courtRoutes = require('./routes/court');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/courts', courtRoutes);

module.exports = app;