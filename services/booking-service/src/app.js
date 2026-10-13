const express = require('express');
const cors = require('cors');
const bookingRoutes = require('./routes/bookings');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/bookings', bookingRoutes);

module.exports = app;
