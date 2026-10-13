const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const Booking = require('../models/Booking');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function isValidStart(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) &&
    /^\d{4}-\d\d-\d\dT\d\d:00:00(?:\.000)?(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    date.getTime() > Date.now();
}

router.post('/', async (req, res) => {
  const { courtId, startsAt } = req.body || {};
  if (typeof courtId !== 'string' || !courtId.trim()) return res.status(400).json({ error: 'courtId is required' });
  if (!isValidStart(startsAt)) return res.status(400).json({ error: 'startsAt must be a future ISO date exactly on the hour' });

  let court;
  try {
    if (!process.env.VENUE_SERVICE_URL) throw new Error('VENUE_SERVICE_URL is not set');
    const response = await axios.get(`${process.env.VENUE_SERVICE_URL.replace(/\/$/, '')}/courts/${encodeURIComponent(courtId)}`, { timeout: 5000 });
    court = response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) return res.status(404).json({ error: 'Court not found' });
    console.error('Venue service request failed');
    return res.status(502).json({ error: 'Venue service unavailable' });
  }

  const start = new Date(startsAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  try {
    const existing = await Booking.exists({ courtId: courtId.trim(), startsAt: start, status: { $in: ['pending', 'confirmed'] } });
    if (existing) return res.status(409).json({ error: 'Slot already booked' });

    const booking = await Booking.create({
      courtId: courtId.trim(),
      courtName: court.name,
      userId: req.user.id,
      startsAt: start,
      endsAt: end,
    });
    return res.status(201).json(booking);
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'Slot already booked' });
    console.error('Booking creation failed');
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json(bookings);
  } catch (err) {
    console.error('Booking list failed');
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid booking id' });
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.id });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    return res.json(booking);
  } catch (err) {
    console.error('Booking lookup failed');
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

router.patch('/:id/cancel', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid booking id' });
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user.id });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'Booking already cancelled' });
    booking.status = 'cancelled';
    await booking.save();
    return res.json(booking);
  } catch (err) {
    console.error('Booking cancellation failed');
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
